//! The one failure the web view sees: a sentence to put in front of the user.

use serde::{Serialize, Serializer};
use std::fmt::{self, Display};

pub type Result<T> = std::result::Result<T, AppError>;

#[derive(Debug)]
pub struct AppError {
    message: String,
    /// Whether GitHub refused the credential, which a fresh one may fix.
    pub stale_credential: bool,
}

impl AppError {
    pub fn new(message: impl Into<String>) -> Self {
        Self { message: message.into(), stale_credential: false }
    }

    pub fn stale_credential(message: impl Into<String>) -> Self {
        Self { message: message.into(), stale_credential: true }
    }
}

impl Display for AppError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(&self.message)
    }
}

impl std::error::Error for AppError {}

impl Serialize for AppError {
    fn serialize<S: Serializer>(&self, serializer: S) -> std::result::Result<S::Ok, S::Error> {
        serializer.serialize_str(&self.message)
    }
}

impl From<std::io::Error> for AppError {
    fn from(error: std::io::Error) -> Self {
        Self::new(error.to_string())
    }
}

impl From<rusqlite::Error> for AppError {
    fn from(error: rusqlite::Error) -> Self {
        Self::new(format!("The snooze store failed: {error}"))
    }
}
