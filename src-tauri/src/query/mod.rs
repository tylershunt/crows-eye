//! The query language behind a section: GitHub's search syntax, extended with
//! booleans and with qualifiers GitHub has no answer for.

mod local;
mod parse;
mod plan;

pub use plan::{plan, QueryPlan};
