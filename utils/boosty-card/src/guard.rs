use std::cell::Cell;

use url::{Host, Url};

use crate::fetch::Request;

const METHODS: [&str; 5] = ["GET", "POST", "PUT", "PATCH", "DELETE"];
const LOCAL_SUFFIXES: [&str; 9] = [
    ".localhost",
    ".local",
    ".internal",
    ".lan",
    ".home",
    ".corp",
    ".intranet",
    ".private",
    ".arpa",
];
const MAX_BODY: usize = 256 * 1024;

#[derive(Clone, Copy, Debug, PartialEq, Eq, thiserror::Error)]
pub enum Denied {
    #[error("not_https")]
    NotHttps,
    #[error("bad_url")]
    BadUrl,
    #[error("ip_literal")]
    IpLiteral,
    #[error("foreign_host")]
    ForeignHost,
    #[error("bad_method")]
    BadMethod,
    #[error("bad_header")]
    BadHeader,
    #[error("body_too_big")]
    BodyTooBig,
    #[error("too_many_calls")]
    TooManyCalls,
}

impl Denied {
    pub fn code(&self) -> &'static str {
        match self {
            Denied::NotHttps => "not_https",
            Denied::BadUrl => "bad_url",
            Denied::IpLiteral => "ip_literal",
            Denied::ForeignHost => "foreign_host",
            Denied::BadMethod => "bad_method",
            Denied::BadHeader => "bad_header",
            Denied::BodyTooBig => "body_too_big",
            Denied::TooManyCalls => "too_many_calls",
        }
    }
}

pub struct Guard {
    hosts: Vec<String>,
    max_calls: u32,
    calls: Cell<u32>,
}

impl Guard {
    pub fn new(hosts: &[String], max_calls: u32) -> Self {
        Self {
            hosts: hosts.iter().map(|host| host.to_ascii_lowercase()).collect(),
            max_calls,
            calls: Cell::new(0),
        }
    }

    pub fn check(&self, request: &Request) -> Result<(), Denied> {
        let calls = self.calls.get() + 1;
        self.calls.set(calls);
        if calls > self.max_calls {
            return Err(Denied::TooManyCalls);
        }
        self.check_url(&request.url)?;
        if !METHODS.contains(&request.method.to_ascii_uppercase().as_str()) {
            return Err(Denied::BadMethod);
        }
        if request
            .headers
            .iter()
            .any(|(name, _)| name.eq_ignore_ascii_case("host"))
        {
            return Err(Denied::BadHeader);
        }
        if request.body.len() > MAX_BODY {
            return Err(Denied::BodyTooBig);
        }
        Ok(())
    }

    fn check_url(&self, raw: &str) -> Result<(), Denied> {
        let url = Url::parse(raw).map_err(|_| Denied::BadUrl)?;
        if url.scheme() != "https" {
            return Err(Denied::NotHttps);
        }
        if !url.username().is_empty() || url.password().is_some() {
            return Err(Denied::BadUrl);
        }
        if url.port().is_some() {
            return Err(Denied::BadUrl);
        }
        match url.host() {
            Some(Host::Domain(name)) if self.hosts.iter().any(|host| host == name) => Ok(()),
            Some(Host::Domain(_)) => Err(Denied::ForeignHost),
            Some(_) => Err(Denied::IpLiteral),
            None => Err(Denied::BadUrl),
        }
    }
}

pub fn valid_host_list(hosts: &[String]) -> bool {
    !hosts.is_empty() && hosts.iter().all(|host| valid_host(host))
}

fn valid_host(host: &str) -> bool {
    let Ok(url) = Url::parse(&format!("https://{host}/")) else {
        return false;
    };
    let Some(Host::Domain(name)) = url.host() else {
        return false;
    };
    name == host.to_ascii_lowercase()
        && name.contains('.')
        && !name.ends_with('.')
        && !LOCAL_SUFFIXES.iter().any(|suffix| name.ends_with(suffix))
}

pub fn acceptable_page(raw: &str) -> bool {
    let Ok(url) = Url::parse(raw) else {
        return false;
    };
    url.scheme() == "https"
        && url.username().is_empty()
        && url.password().is_none()
        && matches!(url.host(), Some(Host::Domain(name)) if valid_host(name))
}

pub fn page_near(raw: &str, hosts: &[String]) -> bool {
    let Ok(url) = Url::parse(raw) else {
        return false;
    };
    let Some(Host::Domain(name)) = url.host() else {
        return false;
    };
    acceptable_page(raw)
        && url.port().is_none()
        && hosts.iter().any(|host| {
            let host = host.to_ascii_lowercase();
            let parent = match host.split_once('.') {
                Some((_, rest)) if rest.contains('.') => rest,
                _ => host.as_str(),
            };
            name == host || name == parent || name.ends_with(&format!(".{parent}"))
        })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn guard() -> Guard {
        Guard::new(&["proxy-ee.smart-glocal.com".into(), "Fp-Gw.com".into()], 3)
    }

    fn get(url: &str) -> Request {
        Request {
            url: url.into(),
            method: "GET".into(),
            headers: vec![],
            body: vec![],
        }
    }

    #[test]
    fn listed_https_hosts_pass_in_any_letter_case() {
        let guard = guard();
        assert_eq!(
            guard.check(&get("https://proxy-ee.smart-glocal.com/widget/v1/init")),
            Ok(())
        );
        assert_eq!(
            guard.check(&get("https://FP-GW.com/static/fp.js?x=1")),
            Ok(())
        );
    }

    #[test]
    fn a_host_outside_the_list_is_denied() {
        for url in [
            "https://evil.example/",
            "https://proxy-ee.smart-glocal.com.evil.example/",
            "https://evil.example/proxy-ee.smart-glocal.com",
            "https://sub.proxy-ee.smart-glocal.com/",
            "https://smart-glocal.com/",
        ] {
            assert_eq!(guard().check(&get(url)), Err(Denied::ForeignHost), "{url}");
        }
    }

    #[test]
    fn plain_http_and_other_schemes_are_denied() {
        for url in [
            "http://proxy-ee.smart-glocal.com/",
            "ftp://proxy-ee.smart-glocal.com/",
            "file:///etc/passwd",
            "wss://proxy-ee.smart-glocal.com/",
        ] {
            assert_eq!(guard().check(&get(url)), Err(Denied::NotHttps), "{url}");
        }
    }

    #[test]
    fn ip_literals_and_private_ranges_are_denied() {
        for url in [
            "https://127.0.0.1/",
            "https://10.0.0.1/",
            "https://192.168.1.1/",
            "https://172.16.0.1/",
            "https://169.254.169.254/latest/meta-data",
            "https://0.0.0.0/",
            "https://[::1]/",
            "https://[fd00::1]/",
            "https://[::ffff:10.0.0.1]/",
            "https://2130706433/",
            "https://0x7f.1/",
            "https://8.8.8.8/",
        ] {
            assert_eq!(guard().check(&get(url)), Err(Denied::IpLiteral), "{url}");
        }
    }

    #[test]
    fn local_names_are_never_on_a_list() {
        for host in [
            "localhost",
            "printer.local",
            "db.internal",
            "nas.lan",
            "a.localhost",
            "router.home.arpa",
        ] {
            assert!(!valid_host_list(&[host.to_string()]), "{host}");
        }
    }

    #[test]
    fn a_list_needs_real_domains() {
        assert!(valid_host_list(&[
            "proxy-ee.smart-glocal.com".into(),
            "fp-gw.com".into()
        ]));
        for bad in [
            vec![],
            vec!["".to_string()],
            vec!["10.0.0.1".to_string()],
            vec!["[::1]".to_string()],
            vec!["a.example/path".to_string()],
            vec!["a.example:8443".to_string()],
            vec!["user@a.example".to_string()],
            vec!["single".to_string()],
            vec!["a.example.".to_string()],
        ] {
            assert!(!valid_host_list(&bad), "{bad:?}");
        }
    }

    #[test]
    fn ports_and_credentials_in_the_url_are_denied() {
        for url in [
            "https://proxy-ee.smart-glocal.com:8443/",
            "https://proxy-ee.smart-glocal.com:443@evil.example/",
            "https://user:pass@proxy-ee.smart-glocal.com/",
            "not a url",
        ] {
            assert!(guard().check(&get(url)).is_err(), "{url}");
        }
    }

    #[test]
    fn the_call_cap_is_enforced() {
        let guard = guard();
        for _ in 0..3 {
            assert_eq!(guard.check(&get("https://fp-gw.com/")), Ok(()));
        }
        assert_eq!(
            guard.check(&get("https://fp-gw.com/")),
            Err(Denied::TooManyCalls)
        );
    }

    #[test]
    fn methods_headers_and_body_are_bounded() {
        let mut request = get("https://fp-gw.com/");
        request.method = "TRACE".into();
        assert_eq!(guard().check(&request), Err(Denied::BadMethod));
        let mut request = get("https://fp-gw.com/");
        request.headers = vec![("Host".into(), "evil.example".into())];
        assert_eq!(guard().check(&request), Err(Denied::BadHeader));
        let mut request = get("https://fp-gw.com/");
        request.method = "post".into();
        request.body = vec![0; MAX_BODY + 1];
        assert_eq!(guard().check(&request), Err(Denied::BodyTooBig));
    }

    #[test]
    fn only_https_pages_on_real_domains_open_in_the_confirm_window() {
        assert!(acceptable_page("https://acs.payeko.ru/3ds?x=1"));
        for bad in [
            "http://acs.payeko.ru/",
            "https://127.0.0.1/",
            "https://localhost/",
            "javascript:alert(1)",
            "file:///etc/passwd",
            "https://user@acs.payeko.ru/",
            "nonsense",
        ] {
            assert!(!acceptable_page(bad), "{bad}");
        }
    }

    #[test]
    fn a_token_bundle_opens_pages_only_next_to_its_own_hosts() {
        let hosts = vec!["api.y.uno".to_string()];
        for good in [
            "https://checkout.y.uno/payment?session=s&3ds=true",
            "https://api.y.uno/x",
            "https://y.uno/",
        ] {
            assert!(page_near(good, &hosts), "{good}");
        }
        for bad in [
            "https://checkout.y.uno.evil.example/",
            "https://evil-y.uno/",
            "https://evil.example/?next=https://checkout.y.uno/",
            "http://checkout.y.uno/",
            "https://checkout.y.uno:8443/",
            "https://user@checkout.y.uno/",
            "https://uno/",
        ] {
            assert!(!page_near(bad, &hosts), "{bad}");
        }
        let short = vec!["fp-gw.com".to_string()];
        assert!(page_near("https://fp-gw.com/", &short));
        assert!(!page_near("https://other.com/", &short));
    }
}
