//! Borrowing a GitHub credential from the environment or the `gh` CLI.

use crate::error::{AppError, Result};
use std::path::Path;
use tokio::process::Command;
use tokio::sync::Mutex;

/// Where a login shell would have found `gh`, since an app launched from Finder
/// inherits a PATH that holds neither Homebrew prefix.
const GH_LOCATIONS: [&str; 3] = ["/opt/homebrew/bin/gh", "/usr/local/bin/gh", "/usr/bin/gh"];

#[derive(Default)]
pub struct TokenCache(Mutex<Option<String>>);

impl TokenCache {
    /// A GitHub API token, preferring `GITHUB_TOKEN`/`GH_TOKEN` and otherwise
    /// borrowing the credential already stored by the `gh` CLI.
    pub async fn resolve(&self) -> Result<String> {
        let mut cached = self.0.lock().await;
        if let Some(token) = cached.as_ref() {
            return Ok(token.clone());
        }

        let token = from_environment().unwrap_or(String::new());
        let token = if token.is_empty() { from_gh_cli().await? } else { token };

        *cached = Some(token.clone());
        Ok(token)
    }

    /// Drops the cached credential so the next call looks it up again.
    pub async fn forget(&self) {
        *self.0.lock().await = None;
    }
}

fn from_environment() -> Option<String> {
    ["GITHUB_TOKEN", "GH_TOKEN"]
        .iter()
        .find_map(|name| std::env::var(name).ok())
        .map(|token| token.trim().to_string())
}

async fn from_gh_cli() -> Result<String> {
    let output = Command::new(gh_path())
        .args(["auth", "token"])
        .output()
        .await
        .map_err(|_| AppError::new(missing_gh()))?;

    if !output.status.success() {
        return Err(AppError::new(missing_gh()));
    }

    let token = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if token.is_empty() {
        return Err(AppError::new("`gh auth token` returned nothing. Run `gh auth login` to authenticate."));
    }
    Ok(token)
}

fn gh_path() -> &'static str {
    GH_LOCATIONS.iter().copied().find(|path| Path::new(path).exists()).unwrap_or("gh")
}

fn missing_gh() -> &'static str {
    "Could not read a GitHub token. Run `gh auth login`, or set GITHUB_TOKEN in your environment."
}
