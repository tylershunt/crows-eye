//! Reading, validating, and writing the section config.

use crate::error::{AppError, Result};
use crate::types::{AppConfig, ConfigResponse, GlobalFilter, SectionConfig};
use serde_json::Value;
use std::collections::HashSet;
use std::path::{Path, PathBuf};

const FALLBACK_COLOR: &str = "#9292ad";

pub fn default_config() -> AppConfig {
    AppConfig {
        refresh_interval_seconds: 120,
        global_filters: Vec::new(),
        sections: vec![
            section("needs-your-review", "Needs your review", "is:open is:pr review-requested:@me archived:false", 50, false, "#f5c451"),
            section("changes-requested", "Changes requested", "is:open is:pr author:@me review:changes-requested archived:false", 50, false, "#e5484d"),
            section("ready-to-merge", "Ready to merge", "is:open is:pr author:@me review:approved -is:draft archived:false", 50, false, "#3dd68c"),
            section("waiting-on-reviewers", "Waiting on reviewers", "is:open is:pr author:@me -review:approved -review:changes-requested -is:draft archived:false", 50, false, "#4f8cff"),
            section("mentions-you", "Mentions you", "is:open is:pr mentions:@me -author:@me archived:false", 25, false, "#a78bfa"),
            section("your-drafts", "Your drafts", "is:open is:pr author:@me is:draft archived:false", 25, true, "#9292ad"),
            section("recently-merged", "Recently merged", "is:pr author:@me is:merged archived:false", 10, true, "#2dd4bf"),
        ],
    }
}

fn section(id: &str, title: &str, query: &str, limit: u32, collapsed: bool, color: &str) -> SectionConfig {
    SectionConfig {
        id: id.into(),
        title: title.into(),
        query: query.into(),
        limit,
        collapsed,
        color: color.into(),
    }
}

/// The config file, which is created with the defaults the first time it is read.
pub struct ConfigStore {
    path: PathBuf,
}

impl ConfigStore {
    pub fn new(path: PathBuf) -> Self {
        Self { path }
    }

    pub fn location(&self) -> &Path {
        &self.path
    }

    pub fn read(&self) -> Result<AppConfig> {
        match std::fs::read_to_string(&self.path) {
            Ok(text) => parse_config(&serde_json::from_str::<Value>(&text).map_err(|error| {
                AppError::new(format!("Config at {} is not valid JSON: {error}", self.path.display()))
            })?),
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
                self.write(&serde_json::to_value(default_config()).expect("config serializes"))
            }
            Err(error) => Err(AppError::from(error)),
        }
    }

    pub fn write(&self, raw: &Value) -> Result<AppConfig> {
        let normalized = parse_config(raw)?;
        if let Some(parent) = self.path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        let mut text = serde_json::to_string_pretty(&normalized).expect("config serializes");
        text.push('\n');
        std::fs::write(&self.path, text)?;
        Ok(normalized)
    }

    pub fn respond(&self, config: AppConfig) -> ConfigResponse {
        ConfigResponse { config, path: self.location().display().to_string() }
    }
}

fn parse_config(raw: &Value) -> Result<AppConfig> {
    let object = raw.as_object().ok_or_else(|| AppError::new("Config must be an object."))?;

    let sections = object
        .get("sections")
        .and_then(Value::as_array)
        .ok_or_else(|| AppError::new("Config field `sections` must be an array."))?;

    let no_filters = Vec::new();
    let global_filters = match object.get("globalFilters") {
        None | Some(Value::Null) => &no_filters,
        Some(Value::Array(filters)) => filters,
        Some(_) => return Err(AppError::new("Config field `globalFilters` must be an array.")),
    }
    .iter()
    .enumerate()
    .map(|(index, filter)| parse_global_filter(filter, index))
    .collect::<Result<Vec<_>>>()?;

    let mut seen = HashSet::new();
    let sections = sections
        .iter()
        .enumerate()
        .map(|(index, section)| {
            let parsed = parse_section(section, index)?;
            if !seen.insert(parsed.id.clone()) {
                return Err(AppError::new(format!("Duplicate section id `{}`.", parsed.id)));
            }
            Ok(parsed)
        })
        .collect::<Result<Vec<_>>>()?;

    Ok(AppConfig {
        sections,
        global_filters,
        refresh_interval_seconds: clamp(number(object.get("refreshIntervalSeconds")).unwrap_or(120.0), 15, 3600),
    })
}

fn parse_global_filter(raw: &Value, index: usize) -> Result<GlobalFilter> {
    let object = raw
        .as_object()
        .ok_or_else(|| AppError::new(format!("Global filter at index {index} must be an object.")))?;

    let query = trimmed(object.get("query"));
    if query.is_empty() {
        return Err(AppError::new(format!("Global filter at index {index} needs a query.")));
    }

    Ok(GlobalFilter {
        id: some_or(trimmed(object.get("id")), || format!("global-{index}")),
        query,
        enabled: object.get("enabled") != Some(&Value::Bool(false)),
    })
}

fn parse_section(raw: &Value, index: usize) -> Result<SectionConfig> {
    let object = raw
        .as_object()
        .ok_or_else(|| AppError::new(format!("Section at index {index} must be an object.")))?;

    let title = trimmed(object.get("title"));
    if title.is_empty() {
        return Err(AppError::new(format!("Section at index {index} needs a title.")));
    }

    let query = trimmed(object.get("query"));
    if query.is_empty() {
        return Err(AppError::new(format!("Section \"{title}\" needs a search query.")));
    }

    Ok(SectionConfig {
        id: some_or(trimmed(object.get("id")), || format!("section-{index}")),
        title,
        query,
        limit: clamp(number(object.get("limit")).unwrap_or(50.0), 1, 100),
        collapsed: object.get("collapsed") == Some(&Value::Bool(true)),
        color: hex_color(object.get("color")),
    })
}

fn trimmed(value: Option<&Value>) -> String {
    value.and_then(Value::as_str).unwrap_or_default().trim().to_string()
}

fn some_or(value: String, fallback: impl FnOnce() -> String) -> String {
    if value.is_empty() {
        fallback()
    } else {
        value
    }
}

fn number(value: Option<&Value>) -> Option<f64> {
    value.and_then(Value::as_f64)
}

fn hex_color(value: Option<&Value>) -> String {
    let color = value.and_then(Value::as_str).unwrap_or_default();
    let is_hex = color.len() == 7
        && color.starts_with('#')
        && color[1..].chars().all(|character| character.is_ascii_hexdigit());

    if is_hex {
        color.to_string()
    } else {
        FALLBACK_COLOR.to_string()
    }
}

fn clamp(value: f64, min: u32, max: u32) -> u32 {
    (value.round() as i64).clamp(min as i64, max as i64) as u32
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn the_defaults_survive_a_round_trip_through_validation() {
        let raw = serde_json::to_value(default_config()).unwrap();

        let parsed = parse_config(&raw).unwrap();

        assert_eq!(parsed.sections.len(), default_config().sections.len());
        assert_eq!(parsed.sections[0].id, "needs-your-review");
    }

    #[test]
    fn a_section_without_a_query_is_rejected_by_title() {
        let raw = json!({ "sections": [{ "title": "Mine", "query": "  " }] });

        let error = parse_config(&raw).unwrap_err();

        assert_eq!(error.to_string(), "Section \"Mine\" needs a search query.");
    }

    #[test]
    fn two_sections_may_not_share_an_id() {
        let raw = json!({ "sections": [
            { "id": "a", "title": "One", "query": "is:pr" },
            { "id": "a", "title": "Two", "query": "is:pr" },
        ] });

        assert_eq!(parse_config(&raw).unwrap_err().to_string(), "Duplicate section id `a`.");
    }

    #[test]
    fn a_missing_id_falls_back_to_the_position() {
        let raw = json!({ "sections": [{ "title": "One", "query": "is:pr" }] });

        assert_eq!(parse_config(&raw).unwrap().sections[0].id, "section-0");
    }

    #[test]
    fn limits_are_held_to_what_a_search_page_can_return() {
        let raw = json!({ "sections": [{ "title": "One", "query": "is:pr", "limit": 500 }] });

        assert_eq!(parse_config(&raw).unwrap().sections[0].limit, 100);
    }

    #[test]
    fn a_color_that_is_not_a_hex_triplet_falls_back() {
        let raw = json!({ "sections": [{ "title": "One", "query": "is:pr", "color": "red" }] });

        assert_eq!(parse_config(&raw).unwrap().sections[0].color, FALLBACK_COLOR);
    }

    #[test]
    fn refresh_intervals_are_held_between_fifteen_seconds_and_an_hour() {
        let sections = json!([{ "title": "One", "query": "is:pr" }]);

        let fast = json!({ "sections": sections.clone(), "refreshIntervalSeconds": 1 });
        let slow = json!({ "sections": sections, "refreshIntervalSeconds": 100_000 });

        assert_eq!(parse_config(&fast).unwrap().refresh_interval_seconds, 15);
        assert_eq!(parse_config(&slow).unwrap().refresh_interval_seconds, 3600);
    }

    #[test]
    fn a_global_filter_is_enabled_unless_it_says_otherwise() {
        let raw = json!({
            "sections": [{ "title": "One", "query": "is:pr" }],
            "globalFilters": [{ "query": "org:acme" }, { "query": "-org:other", "enabled": false }],
        });

        let parsed = parse_config(&raw).unwrap();

        assert!(parsed.global_filters[0].enabled);
        assert!(!parsed.global_filters[1].enabled);
        assert_eq!(parsed.global_filters[0].id, "global-0");
    }

    #[test]
    fn reading_a_missing_file_writes_the_defaults() {
        let directory = std::env::temp_dir().join(format!("crows-eye-test-{}", std::process::id()));
        let store = ConfigStore::new(directory.join("config.json"));

        let config = store.read().unwrap();

        assert_eq!(config.sections.len(), default_config().sections.len());
        assert!(store.location().exists());
        std::fs::remove_dir_all(&directory).ok();
    }
}
