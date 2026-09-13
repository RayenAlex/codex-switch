use std::path::PathBuf;
use std::time::Instant;

use serde_json::{json, Value};
use tauri::Runtime;

use super::*;

#[derive(Clone)]
pub(super) struct WebSocketDiagnostics {
    path: Option<PathBuf>,
    request_id: String,
    started_at: Instant,
    provider_id: String,
    provider_name: String,
}

impl WebSocketDiagnostics {
    pub(super) fn new<R: Runtime>(app: &tauri::AppHandle<R>, provider: &ProviderProfile) -> Self {
        Self {
            path: diagnostic_log_path(app).ok(),
            request_id: uuid::Uuid::new_v4().to_string(),
            started_at: Instant::now(),
            provider_id: provider.id.clone(),
            provider_name: provider.name.clone(),
        }
    }

    pub(super) fn emit(&self, event: &str, details: Value) {
        let Some(path) = self.path.clone() else {
            return;
        };
        let mut entry = json!({
            "ts": unix_now(),
            "requestId": self.request_id,
            "elapsedMs": self.started_at.elapsed().as_millis() as u64,
            "schemaVersion": DIAGNOSTIC_SCHEMA_VERSION,
            "event": event,
            "provider": { "id": self.provider_id, "name": self.provider_name },
        });
        if let (Some(target), Some(source)) = (entry.as_object_mut(), details.as_object()) {
            target.extend(source.clone());
        }
        tauri::async_runtime::spawn_blocking(move || {
            if append_diagnostic_entry(&path, &entry).is_err() {
                eprintln!("Could not write WebSocket diagnostic event");
            }
        });
    }
}

pub(super) fn sanitized_websocket_target(value: &str) -> String {
    let Ok(mut url) = url::Url::parse(value) else {
        return "invalid-websocket-target".to_string();
    };
    let _ = url.set_username("");
    let _ = url.set_password(None);
    url.set_query(None);
    url.set_fragment(None);
    url.to_string()
}
