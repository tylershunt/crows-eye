mod config;
mod error;
mod github;
mod snooze;
mod token;
mod types;

use config::ConfigStore;
use error::Result;
use serde_json::Value;
use snooze::{with_snoozed_section, SnoozeStore};
use std::path::PathBuf;
use tauri::Manager;
use token::TokenCache;
use types::{ConfigResponse, DashboardResponse};

struct Crow {
    config: ConfigStore,
    snoozes: SnoozeStore,
    tokens: TokenCache,
    http: reqwest::Client,
}

#[tauri::command]
fn get_config(crow: tauri::State<'_, Crow>) -> Result<ConfigResponse> {
    Ok(crow.config.respond(crow.config.read()?))
}

#[tauri::command]
fn save_config(crow: tauri::State<'_, Crow>, config: Value) -> Result<ConfigResponse> {
    Ok(crow.config.respond(crow.config.write(&config)?))
}

#[tauri::command]
fn reset_config(crow: tauri::State<'_, Crow>) -> Result<ConfigResponse> {
    let defaults = serde_json::to_value(config::default_config()).expect("config serializes");
    Ok(crow.config.respond(crow.config.write(&defaults)?))
}

#[tauri::command]
async fn get_dashboard(crow: tauri::State<'_, Crow>) -> Result<DashboardResponse> {
    let config = crow.config.read()?;

    let dashboard = match fetch(&crow, &config).await {
        Err(error) if error.stale_credential => {
            crow.tokens.forget().await;
            fetch(&crow, &config).await
        }
        outcome => outcome,
    }?;

    with_snoozed_section(dashboard, &crow.snoozes)
}

async fn fetch(crow: &Crow, config: &types::AppConfig) -> Result<DashboardResponse> {
    github::fetch_dashboard(&crow.http, &crow.tokens.resolve().await?, config).await
}

#[tauri::command]
fn snooze(crow: tauri::State<'_, Crow>, pull_request_id: String) -> Result<()> {
    crow.snoozes.snooze(&pull_request_id, &chrono::Utc::now().to_rfc3339())
}

#[tauri::command]
fn wake(crow: tauri::State<'_, Crow>, pull_request_id: String) -> Result<()> {
    crow.snoozes.wake(&[pull_request_id])
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let data = app.path().app_data_dir()?;
            app.manage(Crow {
                config: ConfigStore::new(beside(&data, "CROWS_EYE_CONFIG", "config.json")),
                snoozes: SnoozeStore::open(&beside(&data, "CROWS_EYE_SNOOZE_DB", "snoozes.db"))?,
                tokens: TokenCache::default(),
                http: reqwest::Client::new(),
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_config,
            save_config,
            reset_config,
            get_dashboard,
            snooze,
            wake
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn beside(data: &std::path::Path, overridden_by: &str, name: &str) -> PathBuf {
    std::env::var(overridden_by).map_or_else(|_| data.join(name), PathBuf::from)
}
