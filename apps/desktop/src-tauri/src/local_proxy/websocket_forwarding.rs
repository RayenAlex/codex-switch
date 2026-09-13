use std::net::SocketAddr;
use std::time::Duration;

use axum::body::Body;
use axum::extract::ws::{CloseFrame, Message as ClientMessage, WebSocket, WebSocketUpgrade};
use axum::extract::FromRequestParts;
use axum::http::{HeaderMap, HeaderName, HeaderValue, Request, Response, StatusCode};
use axum::response::IntoResponse;
use futures_util::{SinkExt, StreamExt};
use serde_json::{json, Value};
use tauri::Runtime;
use tokio_tungstenite::tungstenite::client::IntoClientRequest;
use tokio_tungstenite::tungstenite::protocol::frame::coding::CloseCode;
use tokio_tungstenite::tungstenite::Message as UpstreamMessage;

use super::proxy_gateway::{gateway_error, GatewayState, CLIENT_ADDRESS_HEADER};
use super::*;

const FIRST_FRAME_TIMEOUT: Duration = Duration::from_secs(60);
pub(super) const RESPONSES_PATH: &str = "/v1/responses";

pub(super) async fn response<R: Runtime + 'static>(
    state: GatewayState<R>,
    client_addr: SocketAddr,
    request: Request<Body>,
) -> Response<Body> {
    if request.method() != axum::http::Method::GET || request.uri().path() != RESPONSES_PATH {
        return gateway_error(StatusCode::NOT_FOUND, "WebSocket route not found");
    }
    let headers = request_headers(request.headers());
    let lan_key_id = match authorize_websocket(&state.app, &headers, client_addr.ip().is_loopback())
    {
        Ok(id) => id,
        Err(response) => return *response,
    };
    let provider = match websocket_provider(&state.app) {
        Ok(provider) => provider,
        Err(error) => return gateway_error(StatusCode::BAD_REQUEST, error),
    };
    let uri = request.uri().clone();
    let (mut parts, _) = request.into_parts();
    let upgrade = match WebSocketUpgrade::from_request_parts(&mut parts, &state).await {
        Ok(upgrade) => upgrade,
        Err(rejection) => return rejection.into_response(),
    };
    let protocol = selected_subprotocol(&headers);
    let upgrade = if let Some(protocol) = protocol {
        upgrade.protocols([protocol])
    } else {
        upgrade
    };
    let diagnostics = websocket_diagnostics::WebSocketDiagnostics::new(&state.app, &provider);
    diagnostics.emit("websocket_upgrade", json!({ "path": uri.path() }));
    let session = WebSocketSession {
        app: state.app,
        internal_addr: state.internal_addr,
        provider,
        headers,
        uri,
        client_addr,
        lan_key_id,
        diagnostics,
    };
    upgrade.on_upgrade(move |socket| run_websocket(socket, session))
}

fn authorize_websocket<R: Runtime>(
    app: &tauri::AppHandle<R>,
    headers: &[(String, String)],
    is_loopback: bool,
) -> Result<Option<String>, Box<Response<Body>>> {
    let key = lan_keys::authorize_request(app, headers, is_loopback, false).map_err(|error| {
        let status = if matches!(error, lan_keys::LanKeyError::Unauthorized) {
            StatusCode::UNAUTHORIZED
        } else {
            StatusCode::SERVICE_UNAVAILABLE
        };
        Box::new(gateway_error(status, error.to_string()))
    })?;
    if key
        .as_ref()
        .is_some_and(|key| key.remaining_usd == Some(0.0))
    {
        return Err(Box::new(gateway_error(
            StatusCode::TOO_MANY_REQUESTS,
            "Quota exceeded",
        )));
    }
    if key
        .as_ref()
        .is_some_and(|key| key.quota_usd.is_some() && key.usage_incomplete)
    {
        return Err(Box::new(gateway_error(
            StatusCode::SERVICE_UNAVAILABLE,
            "Usage could not be confirmed",
        )));
    }
    Ok(key.map(|key| key.id))
}

fn websocket_provider<R: Runtime>(app: &tauri::AppHandle<R>) -> Result<ProviderProfile, String> {
    let paths = resolve_paths(app)?;
    let state = read_state(&paths);
    if state.active_provider_group.is_some() {
        return Err("Provider groups do not support WebSocket forwarding".to_string());
    }
    let id = state
        .active_provider_id
        .ok_or_else(|| "Select a provider with WebSocket forwarding enabled".to_string())?;
    if aggregate_api::is_active_id(&id) {
        return Err("Aggregate APIs do not support WebSocket forwarding".to_string());
    }
    let provider = providers::read_provider(&paths, &id)?;
    if provider.api_format != ProviderApiFormat::OpenaiResponses {
        return Err("WebSocket forwarding requires the OpenAI Responses protocol".to_string());
    }
    if !provider.websocket_enabled {
        return Err("WebSocket forwarding is disabled for this provider".to_string());
    }
    Ok(provider)
}

pub(super) struct WebSocketSession<R: Runtime> {
    pub(super) app: tauri::AppHandle<R>,
    pub(super) internal_addr: SocketAddr,
    pub(super) provider: ProviderProfile,
    pub(super) headers: Vec<(String, String)>,
    pub(super) uri: axum::http::Uri,
    pub(super) client_addr: SocketAddr,
    pub(super) lan_key_id: Option<String>,
    pub(super) diagnostics: websocket_diagnostics::WebSocketDiagnostics,
}

async fn run_websocket<R: Runtime + 'static>(mut client: WebSocket, session: WebSocketSession<R>) {
    let first = match receive_first_frame(&mut client).await {
        Ok(frame) => frame,
        Err((code, reason)) => {
            session.diagnostics.emit(
                "websocket_first_frame_rejected",
                json!({ "closeCode": code, "reason": reason }),
            );
            close_client(&mut client, code, &reason).await;
            return;
        }
    };
    let upstream_url = match websocket_upstream_url(&session.provider.base_url, &session.uri) {
        Ok(url) => url,
        Err(error) => {
            close_client(&mut client, 1011, &error).await;
            return;
        }
    };
    let request = match upstream_request(&upstream_url, &session.headers, &session.provider.api_key)
    {
        Ok(request) => request,
        Err(error) => {
            close_client(&mut client, 1011, &error).await;
            return;
        }
    };
    let target = websocket_diagnostics::sanitized_websocket_target(&upstream_url);
    match connect_upstream(request).await {
        Ok(upstream) => {
            session.diagnostics.emit(
                "websocket_handshake",
                json!({ "target": target, "result": "connected" }),
            );
            relay_websocket(client, upstream, first, session).await;
        }
        Err(error) => {
            session.diagnostics.emit(
                "websocket_handshake",
                json!({
                    "target": target,
                    "result": "fallback",
                    "error": crate::error_logs::sanitize_diagnostic_message(&error),
                }),
            );
            websocket_fallback::run(client, first, session).await;
        }
    }
}

async fn receive_first_frame(client: &mut WebSocket) -> Result<ClientMessage, (u16, String)> {
    let next = tokio::time::timeout(FIRST_FRAME_TIMEOUT, client.recv())
        .await
        .map_err(|_| (1001, "first-frame timeout".to_string()))?;
    let frame = next
        .ok_or_else(|| (1001, "client disconnected".to_string()))?
        .map_err(|error| (1002, error.to_string()))?;
    let ClientMessage::Text(text) = &frame else {
        return Err((
            1002,
            "first frame must be a response.create text frame".to_string(),
        ));
    };
    response_create_body(text.as_str())
        .map(|_| frame)
        .map_err(|error| (1002, error))
}

pub(super) fn response_create_body(text: &str) -> Result<Value, String> {
    let value: Value = serde_json::from_str(text)
        .map_err(|error| format!("invalid response.create JSON: {error}"))?;
    if value.get("type").and_then(Value::as_str) != Some("response.create") {
        return Err("first frame must be response.create".to_string());
    }
    value
        .get("response")
        .filter(|response| response.is_object())
        .cloned()
        .ok_or_else(|| "response.create must contain a response object".to_string())
}

pub(super) fn websocket_upstream_url(
    base_url: &str,
    uri: &axum::http::Uri,
) -> Result<String, String> {
    let endpoint = uri
        .path_and_query()
        .map(|value| value.as_str())
        .unwrap_or(RESPONSES_PATH);
    let mut url = url::Url::parse(&build_upstream_url(base_url, endpoint))
        .map_err(|error| format!("Invalid WebSocket upstream URL: {error}"))?;
    let scheme = match url.scheme() {
        "http" => "ws",
        "https" => "wss",
        "ws" => "ws",
        "wss" => "wss",
        scheme => return Err(format!("Unsupported WebSocket upstream scheme: {scheme}")),
    };
    url.set_scheme(scheme)
        .map_err(|_| "Could not set WebSocket upstream scheme".to_string())?;
    Ok(url.to_string())
}

pub(super) fn upstream_request(
    url: &str,
    headers: &[(String, String)],
    api_key: &str,
) -> Result<axum::http::Request<()>, String> {
    let mut request = url
        .into_client_request()
        .map_err(|error| format!("Could not create WebSocket request: {error}"))?;
    for (name, value) in headers {
        if !should_forward_websocket_header(name) {
            continue;
        }
        let Ok(name) = HeaderName::from_bytes(name.as_bytes()) else {
            continue;
        };
        let Ok(value) = HeaderValue::from_str(value) else {
            continue;
        };
        request.headers_mut().insert(name, value);
    }
    if !api_key.trim().is_empty() {
        let value = HeaderValue::from_str(&format!("Bearer {}", api_key.trim()))
            .map_err(|error| format!("Invalid provider API key: {error}"))?;
        request
            .headers_mut()
            .insert(axum::http::header::AUTHORIZATION, value);
    }
    Ok(request)
}

pub(super) fn should_forward_websocket_header(name: &str) -> bool {
    !name.eq_ignore_ascii_case(CLIENT_ADDRESS_HEADER)
        && !matches!(
            name.to_ascii_lowercase().as_str(),
            "authorization"
                | "host"
                | "connection"
                | "upgrade"
                | "content-length"
                | "sec-websocket-key"
                | "sec-websocket-version"
                | "sec-websocket-extensions"
        )
}

fn clone_upstream_request(
    request: &axum::http::Request<()>,
) -> Result<axum::http::Request<()>, String> {
    let mut clone = axum::http::Request::builder()
        .method(request.method())
        .uri(request.uri())
        .version(request.version())
        .body(())
        .map_err(|error| format!("Could not clone WebSocket request: {error}"))?;
    *clone.headers_mut() = request.headers().clone();
    Ok(clone)
}

async fn connect_upstream(
    request: axum::http::Request<()>,
) -> Result<
    tokio_tungstenite::WebSocketStream<tokio_tungstenite::MaybeTlsStream<tokio::net::TcpStream>>,
    String,
> {
    let mut last_error = None;
    for attempt in 0..3 {
        let attempt_request = clone_upstream_request(&request)?;
        let result = tokio::time::timeout(
            UPSTREAM_CONNECT_TIMEOUT,
            tokio_tungstenite::connect_async(attempt_request),
        )
        .await;
        match result {
            Ok(Ok((socket, _))) => return Ok(socket),
            Ok(Err(error)) => last_error = Some(error.to_string()),
            Err(_) => last_error = Some("WebSocket connection timed out".to_string()),
        }
        if attempt < 2 {
            tokio::time::sleep(Duration::from_millis(250 * (attempt + 1))).await;
        }
    }
    Err(last_error.unwrap_or_else(|| "WebSocket connection failed".to_string()))
}

async fn relay_websocket<R: Runtime>(
    mut client: WebSocket,
    mut upstream: tokio_tungstenite::WebSocketStream<
        tokio_tungstenite::MaybeTlsStream<tokio::net::TcpStream>,
    >,
    first: ClientMessage,
    session: WebSocketSession<R>,
) {
    let tracking = websocket_tracking::TrackingContext {
        headers: &session.headers,
        provider: &session.provider,
        client_addr: session.client_addr,
        lan_key_id: session.lan_key_id.clone(),
        diagnostics: &session.diagnostics,
    };
    let mut turn = websocket_tracking::WebSocketTurn::start(&tracking, &first);
    let mut client_frames = 1_u64;
    let mut upstream_frames = 0_u64;
    let mut close_reason = "connection ended";
    if upstream.send(client_to_upstream(first)).await.is_err() {
        session.diagnostics.emit(
            "websocket_closed",
            json!({ "clientFrames": client_frames, "upstreamFrames": 0, "reason": "upstream send failed" }),
        );
        close_client(&mut client, 1011, "upstream send failed").await;
        return;
    }
    loop {
        tokio::select! {
            incoming = client.recv() => {
                let Some(Ok(message)) = incoming else {
                    close_reason = "client disconnected";
                    break;
                };
                client_frames += 1;
                if let Some(next) = websocket_tracking::WebSocketTurn::start(&tracking, &message) {
                    turn = Some(next);
                }
                let close = matches!(message, ClientMessage::Close(_));
                if close {
                    close_reason = "client close";
                }
                if upstream.send(client_to_upstream(message)).await.is_err() || close { break; }
            }
            incoming = upstream.next() => {
                let Some(Ok(message)) = incoming else {
                    close_reason = "upstream disconnected";
                    break;
                };
                upstream_frames += 1;
                if let Some(active) = turn.as_mut() {
                    active.observe(&session.app, &message);
                    if active.complete {
                        turn.take();
                    }
                }
                let close = matches!(message, UpstreamMessage::Close(_));
                if close {
                    close_reason = "upstream close";
                }
                if client.send(upstream_to_client(message)).await.is_err() || close { break; }
            }
        }
    }
    session.diagnostics.emit(
        "websocket_closed",
        json!({
            "clientFrames": client_frames,
            "upstreamFrames": upstream_frames,
            "reason": close_reason,
        }),
    );
}

fn client_to_upstream(message: ClientMessage) -> UpstreamMessage {
    match message {
        ClientMessage::Text(value) => UpstreamMessage::Text(value.to_string().into()),
        ClientMessage::Binary(value) => UpstreamMessage::Binary(value.to_vec().into()),
        ClientMessage::Ping(value) => UpstreamMessage::Ping(value.to_vec().into()),
        ClientMessage::Pong(value) => UpstreamMessage::Pong(value.to_vec().into()),
        ClientMessage::Close(frame) => UpstreamMessage::Close(frame.map(|frame| {
            tokio_tungstenite::tungstenite::protocol::CloseFrame {
                code: CloseCode::from(frame.code),
                reason: frame.reason.to_string().into(),
            }
        })),
    }
}

fn upstream_to_client(message: UpstreamMessage) -> ClientMessage {
    match message {
        UpstreamMessage::Text(value) => ClientMessage::Text(value.to_string().into()),
        UpstreamMessage::Binary(value) => ClientMessage::Binary(value.to_vec().into()),
        UpstreamMessage::Ping(value) => ClientMessage::Ping(value.to_vec().into()),
        UpstreamMessage::Pong(value) => ClientMessage::Pong(value.to_vec().into()),
        UpstreamMessage::Close(frame) => ClientMessage::Close(frame.map(|frame| CloseFrame {
            code: frame.code.into(),
            reason: frame.reason.to_string().into(),
        })),
        UpstreamMessage::Frame(_) => ClientMessage::Close(None),
    }
}

pub(super) async fn close_client(client: &mut WebSocket, code: u16, reason: &str) {
    let _ = client
        .send(ClientMessage::Close(Some(CloseFrame {
            code,
            reason: reason.chars().take(120).collect::<String>().into(),
        })))
        .await;
}

fn request_headers(headers: &HeaderMap) -> Vec<(String, String)> {
    headers
        .iter()
        .filter_map(|(name, value)| {
            value
                .to_str()
                .ok()
                .map(|value| (name.to_string(), value.to_string()))
        })
        .collect()
}

fn selected_subprotocol(headers: &[(String, String)]) -> Option<String> {
    header_value(headers, "sec-websocket-protocol")
        .and_then(|value| value.split(',').next())
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
}
