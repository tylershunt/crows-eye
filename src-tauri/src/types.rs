//! The wire contract with the web view, mirroring `shared/types.ts`.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Actor {
    pub login: String,
    pub avatar_url: String,
    pub url: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Label {
    pub name: String,
    pub color: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Review {
    pub state: String,
    pub author: Option<Actor>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PullRequest {
    pub id: String,
    pub number: u64,
    pub title: String,
    pub url: String,
    pub repo: String,
    pub is_private: bool,
    pub is_draft: bool,
    /// The branch this pull request merges into.
    pub base_ref: String,
    /// The branch holding this pull request's commits.
    pub head_ref: String,
    /// Whether `base_ref` is a branch other than the repository's default.
    pub targets_non_default_branch: bool,
    pub state: String,
    pub created_at: String,
    pub updated_at: String,
    pub additions: i64,
    pub deletions: i64,
    pub changed_files: i64,
    pub comment_count: i64,
    /// False when the pull request has activity the viewer has not looked at yet.
    pub is_read: bool,
    pub check_state: String,
    pub review_decision: String,
    pub mergeable: String,
    pub author: Option<Actor>,
    pub labels: Vec<Label>,
    /// Reviewers with an outstanding request, by login for users and by name for teams.
    pub requested_reviewers: Vec<String>,
    pub latest_reviews: Vec<Review>,
}

/// A user-configured group of pull requests, defined by a GitHub search query.
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SectionConfig {
    pub id: String,
    pub title: String,
    /// GitHub issue-search syntax, e.g. `is:open is:pr review-requested:@me`.
    pub query: String,
    /// Maximum pull requests to fetch and display; GitHub caps a search page at 100.
    pub limit: u32,
    pub collapsed: bool,
    /// Hex accent color for the section header dot.
    pub color: String,
    /// Whether this section's matches are added into the badge on the dock icon.
    pub counts_toward_badge: bool,
}

impl SectionConfig {
    /// The same section, counted on the dock badge.
    pub fn on_the_badge(self) -> Self {
        Self { counts_toward_badge: true, ..self }
    }
}

/// Search terms ANDed into every section's query, narrowing all sections at once.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct GlobalFilter {
    pub id: String,
    pub query: String,
    pub enabled: bool,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppConfig {
    pub sections: Vec<SectionConfig>,
    pub global_filters: Vec<GlobalFilter>,
    pub refresh_interval_seconds: u32,
}

/// One section's config paired with the pull requests its query returned.
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SectionResult {
    pub config: SectionConfig,
    /// The section's own query combined with the enabled global filters.
    pub effective_query: String,
    pub pull_requests: Vec<PullRequest>,
    /// Total matches on GitHub, which may exceed `pull_requests.len()` when capped by `limit`.
    pub total_count: i64,
    pub error: Option<String>,
    /// For a section assembled out of the others, the section each pull request
    /// would sit in if this one were not holding it, keyed by pull request id.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub home_sections: Option<HashMap<String, SectionConfig>>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DashboardResponse {
    pub viewer: Actor,
    pub sections: Vec<SectionResult>,
    pub rate_limit_remaining: i64,
}

/// A config paired with the file it was read from, which the settings panel shows.
#[derive(Clone, Debug, Serialize)]
pub struct ConfigResponse {
    pub config: AppConfig,
    pub path: String,
}

/// Combines a section's query with the enabled global filters into the single
/// query sent to GitHub.
///
/// GitHub's issue search ANDs its terms, so appending a global filter narrows
/// the section rather than widening it.
pub fn effective_query(section_query: &str, global_filters: &[GlobalFilter]) -> String {
    std::iter::once(section_query)
        .chain(
            global_filters
                .iter()
                .filter(|filter| filter.enabled)
                .map(|filter| filter.query.as_str()),
        )
        .map(str::trim)
        .filter(|part| !part.is_empty())
        .collect::<Vec<_>>()
        .join(" ")
}

#[cfg(test)]
mod tests {
    use super::*;

    fn filter(query: &str, enabled: bool) -> GlobalFilter {
        GlobalFilter { id: query.into(), query: query.into(), enabled }
    }

    #[test]
    fn enabled_global_filters_narrow_a_section() {
        let filters = vec![filter("-author:app/dependabot", true), filter("org:acme", true)];

        assert_eq!(
            effective_query("is:open is:pr", &filters),
            "is:open is:pr -author:app/dependabot org:acme"
        );
    }

    #[test]
    fn a_disabled_filter_leaves_the_query_alone() {
        assert_eq!(effective_query("is:open", &[filter("org:acme", false)]), "is:open");
    }

    #[test]
    fn a_blank_filter_adds_no_separator() {
        assert_eq!(effective_query("is:open", &[filter("   ", true)]), "is:open");
    }
}
