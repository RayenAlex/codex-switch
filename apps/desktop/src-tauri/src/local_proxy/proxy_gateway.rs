use std::net::SocketAddr;

use axum::body::{to_bytes, Body};
use axum::extract::connect_info::ConnectInfo;
use axum::extract::State;
use axum::http::{HeaderMap, HeaderName, Request, Response, StatusCode};
use axum::response::IntoResponse;
use axum::routing::any;
use axum::Router;
use tauri::Runtime;
use tokio::sync::oneshot;

use super::*;

pub(super) const CLIENT_ADDRESS_HEADER: &str = "x-codex-switch-client-address";
const MAX_GATEWAY_BODY_BYTES: usize = 256 * 1024 * 1024;

pub(super) struct GatewayState<R: Runtime> {
    pub(super) app: tauri::AppHandle<R>,
    http_client: reqwest::Client,
    pub(super) internal_addr: SocketAddr,
}

impl<R: Runtime> Clone for GatewayState<R> {
    fn clone(&self) -> Self {
        Self {
            app: self.app.clone(),
            http_client: self.http_client.clone(),
            internal_addr: self.internal_addr,
        }
    }
}

pub(super) struct GatewayRuntime {
    pub(super) shutdown: Option<oneshot::Sender<()>>,
    pub(super) handle: tauri::async_runtime::JoinHandle<()>,
}

pub(super) fn start<R: Runtime + 'static>(
    listener: std::net::TcpListener,
    app: tauri::AppHandle<R>,
    internal_addr: SocketAddr,
) -> Result<GatewayRuntime, String> {
    listener
        .set_nonblocking(true)
        .map_err(|error| format!("Failed to configure local proxy listener: {error}"))?;
    let http_client = reqwest::Client::builder()
        .no_proxy()
        .build()
        .map_err(|error| format!("Failed to create local proxy gateway client: {error}"))?;
    let state = GatewayState {
        app,
        http_client,
        internal_addr,
    };
    let (shutdown, shutdown_rx) = oneshot::channel();
    let handle = tauri::async_runtime::spawn(async move {
        let listener = match tokio::net::TcpListener::from_std(listener) {
            Ok(listener) => listener,
            Err(error) => {
                log_proxy_error!("failed to initialize local proxy gateway: {error}");
                return;
            }
        };
        let router = Router::new().fallback(any(dispatch::<R>)).with_state(state);
        let service = router.into_make_service_with_connect_info::<SocketAddr>();
        let result = axum::serve(listener, service)
            .with_graceful_shutdown(async move {
                let _ = shutdown_rx.await;
            })
            .await;
        if let Err(error) = result {
            log_proxy_error!("local proxy gateway stopped unexpectedly: {error}");
        }
    });
    Ok(GatewayRuntime {
        shutdown: Some(shutdown),
        handle,
    })
}

async fn dispatch<R: Runtime + 'static>(
    State(state): State<GatewayState<R>>,
    ConnectInfo(client_addr): ConnectInfo<SocketAddr>,
    request: Request<Body>,
) -> Response<Body> {
    if is_websocket_upgrade(request.headers()) {
        return websocket_forwarding::response(state, client_addr, request).await;
    }
    proxy_http(&state, client_addr, request).await
}

fn is_websocket_upgrade(headers: &HeaderMap) -> bool {
    let upgrade = headers
        .get("upgrade")
        .and_then(|value| value.to_str().ok())
        .is_some_and(|value| value.eq_ignore_ascii_case("websocket"));
    let connection = headers
        .get("connection")
        .and_then(|value| value.to_str().ok())
        .is_some_and(|value| {
            value
                .split(',')
                .any(|token| token.trim().eq_ignore_ascii_case("upgrade"))
        });
    upgrade && connection
}

async fn proxy_http<R: Runtime>(
    state: &GatewayState<R>,
    client_addr: SocketAddr,
    request: Request<Body>,
) -> Response<Body> {
    let (parts, body) = request.into_parts();
    let body = match to_bytes(body, MAX_GATEWAY_BODY_BYTES).await {
        Ok(body) => body,
        Err(error) => return gateway_error(StatusCode::PAYLOAD_TOO_LARGE, error.to_string()),
    };
    let url = internal_url(state.internal_addr, &parts.uri);
    let mut upstream = state.http_client.request(parts.method, url).body(body);
    for (name, value) in &parts.headers {
        if should_forward_gateway_header(name) {
            upstream = upstream.header(name, value);
        }
    }
    upstream = upstream.header(CLIENT_ADDRESS_HEADER, client_addr.to_string());
    let response = match upstream.send().await {
        Ok(response) => response,
        Err(error) => return gateway_error(StatusCode::BAD_GATEWAY, error.to_string()),
    };
    let status = response.status();
    let headers = response.headers().clone();
    let mut builder = Response::builder().status(status);
    for (name, value) in &headers {
        if should_forward_response_header(name) {
            builder = builder.header(name, value);
        }
    }
    builder
        .body(Body::from_stream(response.bytes_stream()))
        .unwrap_or_else(|error| gateway_error(StatusCode::BAD_GATEWAY, error.to_string()))
}

fn internal_url(addr: SocketAddr, uri: &axum::http::Uri) -> String {
    let path = uri
        .path_and_query()
        .map(|value| value.as_str())
        .unwrap_or("/");
    format!("http://{addr}{path}")
}

fn should_forward_gateway_header(name: &HeaderName) -> bool {
    let name = name.as_str();
    !name.eq_ignore_ascii_case(CLIENT_ADDRESS_HEADER)
        && !matches!(
            name.to_ascii_lowercase().as_str(),
            "host" | "content-length" | "transfer-encoding"
        )
}

fn should_forward_response_header(name: &HeaderName) -> bool {
    !matches!(
        name.as_str().to_ascii_lowercase().as_str(),
        "connection" | "transfer-encoding" | "content-length"
    )
}

pub(super) fn gateway_error(status: StatusCode, message: impl Into<String>) -> Response<Body> {
    let body = serde_json::json!({"error": {"message": message.into()}}).to_string();
    Response::builder()
        .status(status)
        .header("content-type", "application/json")
        .body(Body::from(body))
        .unwrap_or_else(|_| StatusCode::INTERNAL_SERVER_ERROR.into_response())
}
