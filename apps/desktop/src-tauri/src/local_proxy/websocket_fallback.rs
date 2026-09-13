use axum::extract::ws::{Message as ClientMessage, WebSocket};
use futures_util::StreamExt;
use serde_json::Value;
use tauri::Runtime;

use super::proxy_gateway::CLIENT_ADDRESS_HEADER;
use super::websocket_forwarding::{
    close_client, response_create_body, WebSocketSession, RESPONSES_PATH,
};
use super::*;

pub(super) async fn run<R: Runtime>(
    mut client: WebSocket,
    first: ClientMessage,
    session: WebSocketSession<R>,
) {
    let ClientMessage::Text(text) = first else {
        return;
    };
    let Ok(mut body) = response_create_body(text.as_str()) else {
        return;
    };
    body["stream"] = Value::Bool(true);
    let response = match open_http_fallback(&session, &body).await {
        Ok(response) => response,
        Err(error) => {
            session.diagnostics.emit(
                "websocket_http_fallback",
                serde_json::json!({
                    "result": "failed",
                    "error": crate::error_logs::sanitize_diagnostic_message(&error),
                }),
            );
            send_fallback_error(&mut client, &error).await;
            return;
        }
    };
    session.diagnostics.emit(
        "websocket_http_fallback",
        serde_json::json!({ "result": "streaming" }),
    );
    relay_http_fallback(&mut client, response).await;
}

async fn open_http_fallback<R: Runtime>(
    session: &WebSocketSession<R>,
    body: &Value,
) -> Result<reqwest::Response, String> {
    let client = reqwest::Client::builder()
        .no_proxy()
        .build()
        .map_err(|error| error.to_string())?;
    let endpoint = session
        .uri
        .path_and_query()
        .map(|value| value.as_str())
        .unwrap_or(RESPONSES_PATH);
    let url = format!("http://{}{}", session.internal_addr, endpoint);
    let mut request = client.post(url).json(body);
    for (name, value) in &session.headers {
        if should_forward_http_fallback_header(name) {
            request = request.header(name, value);
        }
    }
    let response = request
        .header(CLIENT_ADDRESS_HEADER, session.client_addr.to_string())
        .send()
        .await
        .map_err(|error| error.to_string())?;
    if response.status().is_success() {
        Ok(response)
    } else {
        Err(format!("HTTP fallback failed: {}", response.status()))
    }
}

pub(super) fn should_forward_http_fallback_header(name: &str) -> bool {
    !name.eq_ignore_ascii_case(CLIENT_ADDRESS_HEADER)
        && !matches!(
            name.to_ascii_lowercase().as_str(),
            "host"
                | "connection"
                | "upgrade"
                | "content-length"
                | "transfer-encoding"
                | "sec-websocket-key"
                | "sec-websocket-version"
                | "sec-websocket-extensions"
                | "sec-websocket-protocol"
        )
}

async fn relay_http_fallback(client: &mut WebSocket, response: reqwest::Response) {
    let mut stream = response.bytes_stream();
    let mut buffer = String::new();
    while let Some(chunk) = stream.next().await {
        let Ok(chunk) = chunk else {
            send_fallback_error(client, "HTTP fallback stream failed").await;
            return;
        };
        buffer.push_str(&String::from_utf8_lossy(&chunk).replace("\r\n", "\n"));
        if relay_sse_blocks(client, &mut buffer).await {
            return;
        }
    }
    close_client(client, 1000, "HTTP fallback completed").await;
}

async fn relay_sse_blocks(client: &mut WebSocket, buffer: &mut String) -> bool {
    while let Some(index) = buffer.find("\n\n") {
        let block = buffer[..index].to_string();
        buffer.drain(..index + 2);
        let data = sse_block_data(&block);
        if data.is_empty() || data == "[DONE]" {
            continue;
        }
        let terminal =
            serde_json::from_str::<Value>(&data).is_ok_and(|value| is_terminal_usage_event(&value));
        if client.send(ClientMessage::Text(data.into())).await.is_err() {
            return true;
        }
        if terminal {
            close_client(client, 1000, "HTTP fallback completed").await;
            return true;
        }
    }
    false
}

fn sse_block_data(block: &str) -> String {
    block
        .lines()
        .filter_map(|line| line.trim_start().strip_prefix("data:"))
        .map(str::trim_start)
        .collect::<Vec<_>>()
        .join("\n")
}

async fn send_fallback_error(client: &mut WebSocket, message: &str) {
    let event = json!({"type": "error", "error": {"message": message}}).to_string();
    let _ = client.send(ClientMessage::Text(event.into())).await;
    close_client(client, 1011, message).await;
}
