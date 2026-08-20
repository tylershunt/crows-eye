//! The GitHub GraphQL calls behind the dashboard.

use crate::error::{AppError, Result};
use crate::types::{
    effective_query, Actor, AppConfig, DashboardResponse, Label, PullRequest, Review, SectionConfig,
    SectionResult,
};
use serde::Deserialize;
use serde_json::{json, Value};

const GRAPHQL_ENDPOINT: &str = "https://api.github.com/graphql";

const PR_FRAGMENT: &str = r#"
fragment PullRequestFields on PullRequest {
  id
  number
  title
  url
  isDraft
  state
  createdAt
  updatedAt
  additions
  deletions
  changedFiles
  totalCommentsCount
  isReadByViewer
  reviewDecision
  mergeable
  baseRefName
  headRefName
  repository { nameWithOwner isPrivate defaultBranchRef { name } }
  author { login avatarUrl url }
  labels(first: 10) { nodes { name color } }
  reviewRequests(first: 10) {
    nodes {
      requestedReviewer {
        ... on User { login }
        ... on Team { name }
      }
    }
  }
  latestReviews(first: 10) {
    nodes { state author { login avatarUrl url } }
  }
  commits(last: 1) {
    nodes { commit { statusCheckRollup { state } } }
  }
}"#;

const VIEWER_DOCUMENT: &str = "query { viewer { login avatarUrl url } rateLimit { remaining } }";

fn search_document() -> String {
    format!(
        r#"query SectionSearch($query: String!, $limit: Int!) {{
  rateLimit {{ remaining }}
  search(query: $query, type: ISSUE, first: $limit) {{
    issueCount
    nodes {{ ...PullRequestFields }}
  }}
}}
{PR_FRAGMENT}"#
    )
}

/// Resolves each section's search concurrently.
///
/// A section whose query GitHub rejects yields a `SectionResult` with `error` set
/// rather than failing the whole dashboard.
pub async fn fetch_dashboard(
    client: &reqwest::Client,
    token: &str,
    config: &AppConfig,
) -> Result<DashboardResponse> {
    let viewer_request = graphql::<ViewerData>(client, token, VIEWER_DOCUMENT, json!({}));
    let section_requests = futures::future::join_all(config.sections.iter().map(|section| {
        fetch_section(client, token, section, effective_query(&section.query, &config.global_filters))
    }));

    let (viewer, sections) = futures::join!(viewer_request, section_requests);
    let viewer = viewer?;

    Ok(DashboardResponse {
        rate_limit_remaining: sections
            .iter()
            .map(|section| section.remaining)
            .chain(std::iter::once(viewer.rate_limit.remaining))
            .min()
            .unwrap_or(i64::MAX),
        sections: sections.into_iter().map(|section| section.result).collect(),
        viewer: viewer.viewer,
    })
}

struct Fetched {
    result: SectionResult,
    remaining: i64,
}

async fn fetch_section(
    client: &reqwest::Client,
    token: &str,
    config: &SectionConfig,
    query: String,
) -> Fetched {
    let variables = json!({ "query": query, "limit": config.limit });

    match graphql_allowing_partial::<SearchData>(client, token, &search_document(), variables).await {
        Ok((Some(data), _)) if data.search.is_some() => {
            let search = data.search.expect("checked above");
            Fetched {
                remaining: data.rate_limit.map_or(i64::MAX, |limit| limit.remaining),
                result: SectionResult {
                    config: config.clone(),
                    effective_query: query,
                    pull_requests: search.nodes.iter().filter_map(into_pull_request).collect(),
                    total_count: search.issue_count,
                    error: None,
                    home_sections: None,
                },
            }
        }
        Ok((_, errors)) => failed(config, query, first_message(&errors)),
        Err(error) => failed(config, query, error.to_string()),
    }
}

fn failed(config: &SectionConfig, query: String, message: String) -> Fetched {
    Fetched {
        remaining: i64::MAX,
        result: SectionResult {
            config: config.clone(),
            effective_query: query,
            pull_requests: Vec::new(),
            total_count: 0,
            error: Some(message),
            home_sections: None,
        },
    }
}

fn first_message(errors: &[GraphQLError]) -> String {
    errors
        .first()
        .map(|error| error.message.clone())
        .unwrap_or_else(|| "GitHub returned no results.".to_string())
}

/// Search over `type: ISSUE` also matches issues, which arrive as nodes carrying
/// none of the pull request fields.
fn into_pull_request(node: &Value) -> Option<PullRequest> {
    let raw: RawPullRequest = serde_json::from_value(node.clone()).ok()?;

    Some(PullRequest {
        targets_non_default_branch: raw
            .repository
            .default_branch_ref
            .as_ref()
            .is_some_and(|default| default.name != raw.base_ref_name),
        id: raw.id,
        number: raw.number,
        title: raw.title,
        url: raw.url,
        repo: raw.repository.name_with_owner,
        is_private: raw.repository.is_private,
        is_draft: raw.is_draft,
        base_ref: raw.base_ref_name,
        head_ref: raw.head_ref_name,
        state: raw.state,
        created_at: raw.created_at,
        updated_at: raw.updated_at,
        additions: raw.additions,
        deletions: raw.deletions,
        changed_files: raw.changed_files,
        comment_count: raw.total_comments_count.unwrap_or(0),
        is_read: raw.is_read_by_viewer.unwrap_or(true),
        check_state: raw
            .commits
            .nodes
            .first()
            .and_then(|node| node.commit.status_check_rollup.as_ref())
            .map_or_else(|| "NONE".to_string(), |rollup| rollup.state.clone()),
        review_decision: raw.review_decision.unwrap_or_else(|| "NONE".to_string()),
        mergeable: raw.mergeable,
        author: raw.author,
        labels: raw.labels.nodes,
        requested_reviewers: raw
            .review_requests
            .nodes
            .into_iter()
            .filter_map(|node| node.requested_reviewer)
            .filter_map(|reviewer| reviewer.login.or(reviewer.name))
            .collect(),
        latest_reviews: raw.latest_reviews.map(|reviews| reviews.nodes).unwrap_or_default(),
    })
}

async fn graphql<T: for<'de> Deserialize<'de>>(
    client: &reqwest::Client,
    token: &str,
    document: &str,
    variables: Value,
) -> Result<T> {
    match graphql_allowing_partial::<T>(client, token, document, variables).await? {
        (_, errors) if !errors.is_empty() => Err(AppError::new(first_message(&errors))),
        (Some(data), _) => Ok(data),
        (None, _) => Err(AppError::new("GitHub returned no data.")),
    }
}

async fn graphql_allowing_partial<T: for<'de> Deserialize<'de>>(
    client: &reqwest::Client,
    token: &str,
    document: &str,
    variables: Value,
) -> Result<(Option<T>, Vec<GraphQLError>)> {
    let response = client
        .post(GRAPHQL_ENDPOINT)
        .bearer_auth(token)
        .header("Accept", "application/vnd.github+json")
        .header("User-Agent", "crows-eye")
        .json(&json!({ "query": document, "variables": variables }))
        .send()
        .await
        .map_err(|error| AppError::new(format!("Could not reach GitHub: {error}")))?;

    if response.status() == reqwest::StatusCode::UNAUTHORIZED {
        return Err(AppError::stale_credential(
            "GitHub rejected the token. Run `gh auth login` to refresh it.",
        ));
    }
    if !response.status().is_success() {
        let status = response.status().as_u16();
        let body = response.text().await.unwrap_or_default();
        return Err(AppError::new(format!("GitHub responded {status}: {}", truncate(&body, 300))));
    }

    let envelope: Envelope<T> = response
        .json()
        .await
        .map_err(|error| AppError::new(format!("GitHub sent a response we could not read: {error}")))?;

    Ok((envelope.data, envelope.errors.unwrap_or_default()))
}

fn truncate(text: &str, limit: usize) -> &str {
    match text.char_indices().nth(limit) {
        Some((index, _)) => &text[..index],
        None => text,
    }
}

#[derive(Deserialize)]
struct Envelope<T> {
    data: Option<T>,
    errors: Option<Vec<GraphQLError>>,
}

#[derive(Deserialize)]
struct GraphQLError {
    message: String,
}

#[derive(Deserialize)]
struct ViewerData {
    viewer: Actor,
    #[serde(rename = "rateLimit")]
    rate_limit: RateLimit,
}

#[derive(Deserialize)]
struct RateLimit {
    remaining: i64,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct SearchData {
    rate_limit: Option<RateLimit>,
    search: Option<SearchResult>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct SearchResult {
    issue_count: i64,
    nodes: Vec<Value>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct RawPullRequest {
    id: String,
    number: u64,
    title: String,
    url: String,
    is_draft: bool,
    state: String,
    created_at: String,
    updated_at: String,
    additions: i64,
    deletions: i64,
    changed_files: i64,
    total_comments_count: Option<i64>,
    is_read_by_viewer: Option<bool>,
    review_decision: Option<String>,
    mergeable: String,
    base_ref_name: String,
    head_ref_name: String,
    repository: RawRepository,
    author: Option<Actor>,
    labels: Nodes<Label>,
    review_requests: Nodes<RawReviewRequest>,
    latest_reviews: Option<Nodes<Review>>,
    commits: Nodes<RawCommitNode>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct RawRepository {
    name_with_owner: String,
    is_private: bool,
    default_branch_ref: Option<RawRef>,
}

#[derive(Deserialize)]
struct RawRef {
    name: String,
}

#[derive(Deserialize)]
struct Nodes<T> {
    nodes: Vec<T>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct RawReviewRequest {
    requested_reviewer: Option<RawReviewer>,
}

#[derive(Deserialize)]
struct RawReviewer {
    login: Option<String>,
    name: Option<String>,
}

#[derive(Deserialize)]
struct RawCommitNode {
    commit: RawCommit,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct RawCommit {
    status_check_rollup: Option<RawRollup>,
}

#[derive(Deserialize)]
struct RawRollup {
    state: String,
}

#[cfg(test)]
mod tests {
    use super::*;

    fn node() -> Value {
        json!({
            "id": "PR_1", "number": 7, "title": "Teach the crow to count", "url": "https://example.test/7",
            "isDraft": false, "state": "OPEN", "createdAt": "2026-08-01T00:00:00Z",
            "updatedAt": "2026-08-02T00:00:00Z", "additions": 3, "deletions": 1, "changedFiles": 2,
            "totalCommentsCount": null, "isReadByViewer": null, "reviewDecision": null,
            "mergeable": "MERGEABLE", "baseRefName": "main", "headRefName": "feature",
            "repository": { "nameWithOwner": "acme/rocket", "isPrivate": false, "defaultBranchRef": { "name": "main" } },
            "author": { "login": "wile", "avatarUrl": "a", "url": "u" },
            "labels": { "nodes": [] },
            "reviewRequests": { "nodes": [{ "requestedReviewer": { "name": "birds" } }, { "requestedReviewer": null }] },
            "latestReviews": null,
            "commits": { "nodes": [{ "commit": { "statusCheckRollup": null } }] },
        })
    }

    #[test]
    fn an_issue_among_the_results_is_not_a_pull_request() {
        assert!(into_pull_request(&json!({})).is_none());
    }

    #[test]
    fn a_pull_request_with_nothing_reported_reads_as_seen_and_unchecked() {
        let pull_request = into_pull_request(&node()).unwrap();

        assert!(pull_request.is_read);
        assert_eq!(pull_request.check_state, "NONE");
        assert_eq!(pull_request.review_decision, "NONE");
        assert_eq!(pull_request.comment_count, 0);
    }

    #[test]
    fn a_team_review_request_is_named_by_team() {
        assert_eq!(into_pull_request(&node()).unwrap().requested_reviewers, vec!["birds"]);
    }

    #[test]
    fn a_pull_request_onto_the_default_branch_is_not_stacked() {
        assert!(!into_pull_request(&node()).unwrap().targets_non_default_branch);
    }

    #[test]
    fn a_pull_request_onto_another_branch_is_stacked() {
        let mut stacked = node();
        stacked["baseRefName"] = json!("parent-branch");

        assert!(into_pull_request(&stacked).unwrap().targets_non_default_branch);
    }

    /// Run with `cargo test -- --ignored` and a GitHub credential to hand.
    #[tokio::test]
    #[ignore = "calls GitHub"]
    async fn a_live_search_names_the_viewer_and_fails_no_section() {
        let token = crate::token::TokenCache::default().resolve().await.unwrap();
        let config = crate::types::AppConfig {
            sections: vec![crate::types::SectionConfig {
                id: "mine".into(),
                title: "Mine".into(),
                query: "is:open is:pr author:@me archived:false".into(),
                limit: 5,
                collapsed: false,
                color: "#000000".into(),
            }],
            global_filters: Vec::new(),
            refresh_interval_seconds: 120,
        };

        let dashboard = fetch_dashboard(&reqwest::Client::new(), &token, &config).await.unwrap();

        assert!(!dashboard.viewer.login.is_empty());
        assert_eq!(dashboard.sections[0].error, None);
    }
}
