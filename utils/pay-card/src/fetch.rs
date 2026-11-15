pub struct Request {
    pub url: String,
    pub method: String,
    pub headers: Vec<(String, String)>,
    pub body: Vec<u8>,
}

pub struct Response {
    pub status: u16,
    pub body: Vec<u8>,
    pub error: Option<String>,
}

pub trait Fetch: Send + Sync {
    fn call(&self, request: Request) -> Response;
}
