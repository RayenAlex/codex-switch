use std::net::SocketAddr;
use std::time::Instant;

use axum::extract::ws::Message as ClientMessage;
use serde_json::Value;
use tauri::Runtime;
use tokio_tungstenite::tungstenite::Message as UpstreamMessage;

use super::websocket_forwarding::{response_create_body, RESPONSES_PATH};
use super::*;

pub(super) struct TrackingContext<'a> {
    pub(super) headers: &'a [(String, String)],
    pub(super) provider: &'a ProviderProfile,
    pub(super) client_addr: SocketAddr,
    pub(super) lan_key_id: Option<String>,
    pub(super) diagnostics: &'a websocket_diagnostics::WebSocketDiagnostics,
}

pub(super) struct WebSocketTurn {
    guard: ProxySessionRequestGuard,
    usage_context: TokenUsageContext,
    usage: Option<TokenUsageValues>,
    capture: ConversationResponseCapture,
    first_response_recorded: bool,
    pub(super) complete: bool,
    diagnostics: websocket_diagnostics::WebSocketDiagnostics,
}

impl WebSocketTurn {
    pub(super) fn start(context: &TrackingContext<'_>, frame: &ClientMessage) -> Option<Self> {
        let ClientMessage::Text(text) = frame else {
            return None;
        };
        let mut body = response_create_body(text.as_str()).ok()?;
        body["stream"] = Value::Bool(true);
        let body = serde_json::to_vec(&body).ok()?;
        let method = Method::Post;
        let guard = begin_tracked_proxy_session(ProxySessionRequest {
            method: &method,
            path: RESPONSES_PATH,
            headers: context.headers,
            body: &body,
            remote_address: Some(context.client_addr.to_string()),
            service_tier: effective_proxy_service_tier(&body, None),
        })?;
        let target = ActiveTarget::Provider(Box::new(context.provider.clone()));
        let mut usage_context = token_usage_context(TokenUsageRequest {
            method: &method,
            path: RESPONSES_PATH,
            body: &body,
            headers: context.headers,
            target: &target,
            started_at: Instant::now(),
            session_id: Some(guard.session_id()),
            session_request_id: Some(guard.request_id()),
        })?;
        usage_context.lan_api_key_id = context.lan_key_id.clone();
        update_proxy_session_target(
            Some(guard.session_id()),
            Some(guard.request_id()),
            &usage_context.provider,
            &usage_context.model,
        );
        Some(Self {
            guard,
            usage_context,
            usage: None,
            capture: ConversationResponseCapture {
                event_stream: true,
                ..Default::default()
            },
            first_response_recorded: false,
            complete: false,
            diagnostics: context.diagnostics.clone(),
        })
    }

    pub(super) fn observe<R: Runtime>(
        &mut self,
        app: &tauri::AppHandle<R>,
        message: &UpstreamMessage,
    ) {
        let UpstreamMessage::Text(text) = message else {
            return;
        };
        if !self.first_response_recorded {
            self.guard.first_response_context().record();
            self.first_response_recorded = true;
        }
        let bytes = format!("data: {}\n\n", text.as_str());
        self.capture.observe(bytes.as_bytes());
        let Ok(value) = serde_json::from_str::<Value>(text.as_str()) else {
            return;
        };
        merge_token_usage_event(&mut self.usage, &value);
        if is_terminal_usage_event(&value) {
            let event_type = value
                .get("type")
                .and_then(Value::as_str)
                .unwrap_or("unknown");
            self.diagnostics.emit(
                "websocket_turn_completed",
                serde_json::json!({
                    "status": event_type,
                    "model": self.usage_context.model,
                    "usage": self.usage,
                }),
            );
            record_conversation_response(
                self.guard.session_id(),
                self.guard.request_id(),
                &mut self.capture,
            );
            record_token_usage_entry(
                app,
                &self.usage_context,
                self.usage.clone(),
                LanUsageAccounting::Complete,
            );
            self.complete = true;
        }
    }
}
