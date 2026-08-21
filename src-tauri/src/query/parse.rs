//! The surface syntax: GitHub's search terms, and the booleans over them.

use crate::error::{AppError, Result};

/// A leaf of a query: a `key:value` qualifier, or a run of free text.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Term {
    /// Lowercased, as GitHub's qualifiers are; `None` for free text.
    pub key: Option<String>,
    pub value: String,
}

impl Term {
    pub fn qualifier(key: &str, value: &str) -> Self {
        Self { key: Some(key.to_lowercase()), value: value.to_string() }
    }

    pub fn text(value: &str) -> Self {
        Self { key: None, value: value.to_string() }
    }

    /// The term as GitHub's search box would take it.
    pub fn render(&self) -> String {
        match &self.key {
            Some(key) => format!("{key}:{}", quote(&self.value)),
            None => quote(&self.value),
        }
    }
}

fn quote(value: &str) -> String {
    if value.is_empty() || value.chars().any(char::is_whitespace) {
        format!("\"{value}\"")
    } else {
        value.to_string()
    }
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Expr {
    Term(Term),
    Not(Box<Expr>),
    /// Every operand must match, which is what a space between terms means.
    Every(Vec<Expr>),
    /// Any operand may match.
    Any(Vec<Expr>),
}

impl Expr {
    pub fn not(self) -> Self {
        Self::Not(Box::new(self))
    }

    /// The conjunction of `operands`, without the wrapper when there is nothing
    /// to combine.
    pub fn every(mut operands: Vec<Expr>) -> Self {
        if operands.len() == 1 {
            operands.pop().expect("length checked")
        } else {
            Self::Every(operands)
        }
    }

    pub fn any(mut operands: Vec<Expr>) -> Self {
        if operands.len() == 1 {
            operands.pop().expect("length checked")
        } else {
            Self::Any(operands)
        }
    }
}

/// Reads a query written in GitHub's search syntax, extended with `and`, `or`,
/// `not`, and parentheses.
///
/// A space between terms means `and`, which binds tighter than `or`. `-term` is
/// `not term`. The operator words are recognised in either case; quoting one
/// (`"or"`) searches for the word instead.
pub fn parse(source: &str) -> Result<Expr> {
    let tokens = tokenize(source)?;
    let mut reader = Reader { tokens: &tokens, at: 0 };

    let expression = reader.disjunction()?;
    match reader.peek() {
        None => Ok(expression),
        Some(_) => Err(AppError::new("Unbalanced `)` in the query.")),
    }
}

#[derive(Clone, Debug, PartialEq, Eq)]
enum Token {
    Open,
    Close,
    Or,
    And,
    Not,
    Term(Term),
}

fn tokenize(source: &str) -> Result<Vec<Token>> {
    let mut tokens = Vec::new();
    let mut characters = source.chars().peekable();

    while let Some(&character) = characters.peek() {
        match character {
            _ if character.is_whitespace() => {
                characters.next();
            }
            '(' => {
                characters.next();
                tokens.push(Token::Open);
            }
            ')' => {
                characters.next();
                tokens.push(Token::Close);
            }
            _ => tokens.extend(word(&mut characters)?),
        }
    }

    Ok(tokens)
}

/// Reads one whitespace-delimited word, which is a term and possibly the `-`
/// negating it.
fn word(characters: &mut std::iter::Peekable<std::str::Chars<'_>>) -> Result<Vec<Token>> {
    let mut text = String::new();
    let mut key_ends_at = None;
    let mut quoted = false;
    let mut inside_quotes = false;

    while let Some(&character) = characters.peek() {
        match character {
            '"' => {
                quoted = true;
                inside_quotes = !inside_quotes;
            }
            _ if !inside_quotes && (character.is_whitespace() || character == '(' || character == ')') => break,
            ':' if !inside_quotes && key_ends_at.is_none() => {
                key_ends_at = Some(text.len());
                text.push(character);
            }
            _ => text.push(character),
        }
        characters.next();
    }

    if inside_quotes {
        return Err(AppError::new("The query has a quote that is never closed."));
    }

    let mut tokens = Vec::new();
    if text.starts_with('-') && !quoted {
        tokens.push(Token::Not);
        text.remove(0);
        key_ends_at = key_ends_at.map(|at| at - 1);
    }

    // A `-` of its own negates whatever follows it, as in `-(is:draft or is:merged)`.
    if text.is_empty() && !quoted {
        return Ok(tokens);
    }

    tokens.push(match key_ends_at {
        Some(at) => Token::Term(Term::qualifier(&text[..at], &text[at + 1..])),
        None if !quoted && text.eq_ignore_ascii_case("or") => Token::Or,
        None if !quoted && text.eq_ignore_ascii_case("and") => Token::And,
        None if !quoted && text.eq_ignore_ascii_case("not") => Token::Not,
        None => Token::Term(Term::text(&text)),
    });

    Ok(tokens)
}

struct Reader<'a> {
    tokens: &'a [Token],
    at: usize,
}

impl Reader<'_> {
    fn peek(&self) -> Option<&Token> {
        self.tokens.get(self.at)
    }

    fn take(&mut self, token: &Token) -> bool {
        let matched = self.peek() == Some(token);
        if matched {
            self.at += 1;
        }
        matched
    }

    fn disjunction(&mut self) -> Result<Expr> {
        let mut operands = vec![self.conjunction()?];
        while self.take(&Token::Or) {
            operands.push(self.conjunction()?);
        }

        Ok(Expr::any(operands))
    }

    fn conjunction(&mut self) -> Result<Expr> {
        let mut operands = vec![self.unary()?];
        loop {
            let explicit = self.take(&Token::And);
            match self.peek() {
                None | Some(Token::Close) | Some(Token::Or) if !explicit => break,
                _ => operands.push(self.unary()?),
            }
        }

        Ok(Expr::every(operands))
    }

    fn unary(&mut self) -> Result<Expr> {
        match self.peek() {
            Some(Token::Not) => {
                self.at += 1;
                Ok(self.unary()?.not())
            }
            Some(Token::Term(term)) => {
                let term = term.clone();
                self.at += 1;
                Ok(Expr::Term(term))
            }
            Some(Token::Open) => {
                self.at += 1;
                let inside = self.disjunction()?;
                if !self.take(&Token::Close) {
                    return Err(AppError::new("The query has a `(` that is never closed."));
                }
                Ok(inside)
            }
            Some(Token::Close) => Err(AppError::new("The query has an empty `()`.")),
            Some(Token::Or) | Some(Token::And) => {
                Err(AppError::new("The query has `and` or `or` with nothing before it."))
            }
            None => Err(AppError::new("The query ends where a term should be.")),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn qualifier(key: &str, value: &str) -> Expr {
        Expr::Term(Term::qualifier(key, value))
    }

    fn text(value: &str) -> Expr {
        Expr::Term(Term::text(value))
    }

    #[test]
    fn a_run_of_terms_is_a_conjunction() {
        assert_eq!(
            parse("is:open is:pr author:@me").unwrap(),
            Expr::Every(vec![qualifier("is", "open"), qualifier("is", "pr"), qualifier("author", "@me")])
        );
    }

    #[test]
    fn every_query_the_app_ships_with_parses() {
        for section in crate::config::default_config().sections {
            parse(&section.query).unwrap_or_else(|error| panic!("{}: {error}", section.id));
        }
    }

    #[test]
    fn a_leading_dash_negates_the_term_it_touches() {
        assert_eq!(parse("-is:draft").unwrap(), qualifier("is", "draft").not());
        assert_eq!(parse("not is:draft").unwrap(), qualifier("is", "draft").not());
        assert_eq!(parse("NOT is:draft").unwrap(), qualifier("is", "draft").not());
    }

    #[test]
    fn a_space_binds_tighter_than_or() {
        assert_eq!(
            parse("author:@me is:open or mentions:@me").unwrap(),
            Expr::Any(vec![
                Expr::Every(vec![qualifier("author", "@me"), qualifier("is", "open")]),
                qualifier("mentions", "@me"),
            ])
        );
    }

    #[test]
    fn parentheses_override_that_order() {
        assert_eq!(
            parse("is:open (author:@me or mentions:@me)").unwrap(),
            Expr::Every(vec![
                qualifier("is", "open"),
                Expr::Any(vec![qualifier("author", "@me"), qualifier("mentions", "@me")]),
            ])
        );
    }

    #[test]
    fn not_reaches_across_a_parenthesised_group() {
        assert_eq!(
            parse("-(is:draft or is:merged)").unwrap(),
            Expr::Any(vec![qualifier("is", "draft"), qualifier("is", "merged")]).not()
        );
    }

    #[test]
    fn an_explicit_and_reads_the_same_as_a_space() {
        assert_eq!(parse("is:open AND is:pr").unwrap(), parse("is:open is:pr").unwrap());
    }

    #[test]
    fn a_quoted_operator_is_a_search_for_the_word() {
        assert_eq!(
            parse("\"or\" review:approved").unwrap(),
            Expr::Every(vec![text("or"), qualifier("review", "approved")])
        );
    }

    #[test]
    fn a_quoted_value_may_hold_spaces() {
        assert_eq!(parse("label:\"needs work\"").unwrap(), qualifier("label", "needs work"));
    }

    #[test]
    fn a_qualifier_splits_at_its_first_colon() {
        assert_eq!(parse("created:2026-01-01..2026-02-01").unwrap(), qualifier("created", "2026-01-01..2026-02-01"));
        assert_eq!(parse("size:>500").unwrap(), qualifier("size", ">500"));
    }

    #[test]
    fn a_key_is_read_without_regard_to_case() {
        assert_eq!(parse("Is:Open").unwrap(), qualifier("is", "Open"));
    }

    #[test]
    fn a_term_renders_as_github_would_read_it() {
        assert_eq!(Term::qualifier("is", "open").render(), "is:open");
        assert_eq!(Term::qualifier("label", "needs work").render(), "label:\"needs work\"");
        assert_eq!(Term::text("crow").render(), "crow");
    }

    #[test]
    fn an_unfinished_query_is_refused_with_a_reason() {
        for (query, complaint) in [
            ("", "The query ends where a term should be."),
            ("is:open or", "The query ends where a term should be."),
            ("(is:open", "The query has a `(` that is never closed."),
            ("is:open)", "Unbalanced `)` in the query."),
            ("label:\"needs work", "The query has a quote that is never closed."),
            ("or is:open", "The query has `and` or `or` with nothing before it."),
        ] {
            assert_eq!(parse(query).unwrap_err().to_string(), complaint, "for `{query}`");
        }
    }
}
