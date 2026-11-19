use super::*;

fn ok(raw: &str) -> AuthCallback {
    parse_auth(raw).unwrap()
}

#[test]
fn parses_code_and_state() {
    let parsed = ok("sc://auth?code=abc123&state=xyz-9");
    assert_eq!(parsed.code, "abc123");
    assert_eq!(parsed.state, "xyz-9");
}

#[test]
fn param_order_does_not_matter() {
    assert_eq!(
        ok("sc://auth?state=s&code=c"),
        ok("sc://auth?code=c&state=s")
    );
}

#[test]
fn extra_params_and_fragment_are_ignored() {
    let parsed = ok("sc://auth?foo=1&code=c.d_e~f&state=s&bar=%20#frag");
    assert_eq!(parsed.code, "c.d_e~f");
    assert_eq!(parsed.state, "s");
}

#[test]
fn trailing_slash_and_case_are_accepted() {
    assert_eq!(
        ok("SC://AUTH/?code=c&state=s"),
        ok("sc://auth?code=c&state=s")
    );
}

#[test]
fn surrounding_whitespace_is_trimmed() {
    ok("  sc://auth?code=c&state=s\n");
}

#[test]
fn other_schemes_are_refused() {
    assert_eq!(
        parse_auth("https://auth?code=c&state=s"),
        Err(Error::Scheme)
    );
    assert_eq!(parse_auth("sc:auth?code=c&state=s"), Err(Error::Scheme));
    assert_eq!(parse_auth("code=c&state=s"), Err(Error::Scheme));
    assert_eq!(parse_auth(""), Err(Error::Scheme));
}

#[test]
fn other_hosts_and_paths_are_refused() {
    assert_eq!(parse_auth("sc://login?code=c&state=s"), Err(Error::Target));
    assert_eq!(parse_auth("sc://auth/x?code=c&state=s"), Err(Error::Target));
    assert_eq!(
        parse_auth("sc://auth.evil?code=c&state=s"),
        Err(Error::Target)
    );
    assert_eq!(
        parse_auth("sc://user@auth?code=c&state=s"),
        Err(Error::Target)
    );
    assert_eq!(parse_auth("sc://?code=c&state=s"), Err(Error::Target));
}

#[test]
fn missing_or_empty_fields_are_refused() {
    assert_eq!(parse_auth("sc://auth"), Err(Error::Missing("code")));
    assert_eq!(parse_auth("sc://auth?state=s"), Err(Error::Missing("code")));
    assert_eq!(parse_auth("sc://auth?code=c"), Err(Error::Missing("state")));
    assert_eq!(
        parse_auth("sc://auth?code=&state=s"),
        Err(Error::Missing("code"))
    );
    assert_eq!(
        parse_auth("sc://auth?code&state=s"),
        Err(Error::Missing("code"))
    );
}

#[test]
fn length_is_bounded() {
    let long = "a".repeat(MAX_FIELD_LEN + 1);
    let edge = "a".repeat(MAX_FIELD_LEN);
    assert_eq!(
        parse_auth(&format!("sc://auth?code={long}&state=s")),
        Err(Error::Length("code"))
    );
    assert_eq!(
        parse_auth(&format!("sc://auth?code=c&state={long}")),
        Err(Error::Length("state"))
    );
    assert_eq!(ok(&format!("sc://auth?code={edge}&state=s")).code, edge);
}

#[test]
fn charset_is_bounded() {
    for bad in ["a%20b", "a b", "a+b", "a/b", "a:b", "\u{e9}", "a\"b", "a<b"] {
        assert_eq!(
            parse_auth(&format!("sc://auth?code={bad}&state=s")),
            Err(Error::Charset("code")),
            "{bad}"
        );
    }
}

#[test]
fn first_occurrence_wins() {
    assert_eq!(ok("sc://auth?code=a&code=b&state=s").code, "a");
}
