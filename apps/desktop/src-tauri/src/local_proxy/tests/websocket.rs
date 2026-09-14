use super::websocket_fallback::should_forward_http_fallback_header;
use super::websocket_forwarding::{
    response_create_body, should_forward_websocket_header, upstream_request, websocket_upstream_url,
};
use futures_util::{SinkExt, StreamExt};
use tokio_tungstenite::tungstenite::Message as UpstreamMessage;

#[tokio::test]
async fn gateway_forwards_codex_websocket_frames_to_provider() {
    let upstream_listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let upstream_addr = upstream_listener.local_addr().unwrap();
    let upstream = tokio::spawn(async move {
        let (stream, _) = upstream_listener.accept().await.unwrap();
        let mut socket = tokio_tungstenite::accept_async(stream).await.unwrap();
        while let Some(Ok(message)) = socket.next().await {
            if matches!(message, UpstreamMessage::Close(_)) {
                break;
            }
            socket.send(message).await.unwrap();
        }
    });

    let mut context = tauri::test::mock_context(tauri::test::noop_assets());
    context.config_mut().identifier =
        format!("com.codex-switch.ws-test.{}", uuid::Uuid::new_v4());
    let app = tauri::test::mock_builder().build(context).unwrap();
    let paths = crate::storage::resolve_paths(app.handle()).unwrap();
    std::fs::create_dir_all(&paths.providers).unwrap();
    let provider = ProviderProfile {
        id: "headroom".to_string(),
        kind: ProviderKind::Custom,
        name: "Headroom".to_string(),
        group: String::new(),
        base_url: format!("http://{upstream_addr}/v1"),
        api_key: "sk-headroom".to_string(),
        model: "gpt-5.6-sol".to_string(),
        models: vec!["gpt-5.6-sol".to_string()],
        model_reasoning_efforts: Default::default(),
        model_context_windows: Default::default(),
        model_api_formats: Default::default(),
        image_input_models: Vec::new(),
        image_input_models_configured: false,
        context_window: None,
        model_selection_controlled_by_codex: true,
        fast_mode_enabled: false,
        websocket_enabled: true,
        api_format: ProviderApiFormat::OpenaiResponses,
        balance_platform: None,
        balance_query_url: None,
        balance_query_token: None,
        wallet_query_url: None,
        wallet_query_token: None,
        wallet_username: None,
        wallet_password: None,
    };
    crate::storage::write_json_atomic(
        &paths.providers.join("headroom.json"),
        &serde_json::to_value(provider).unwrap(),
    )
    .unwrap();
    let state = ManagerStateFile {
        active_provider_id: Some("headroom".to_string()),
        ..Default::default()
    };
    crate::storage::write_state(&paths, &state).unwrap();

    let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
    let gateway_addr = listener.local_addr().unwrap();
    let mut gateway = crate::local_proxy::proxy_gateway::start(
        listener,
        app.handle().clone(),
        "127.0.0.1:9".parse().unwrap(),
    )
    .unwrap();
    let (mut client, _) =
        tokio_tungstenite::connect_async(format!("ws://{gateway_addr}/v1/responses"))
            .await
            .unwrap();
    let first = r#"{"type":"response.create","model":"gpt-5.6-sol","input":"hello"}"#;
    client
        .send(UpstreamMessage::Text(first.into()))
        .await
        .unwrap();
    let echoed = client.next().await.unwrap().unwrap();
    assert_eq!(echoed.into_text().unwrap(), first);
    let binary = vec![1_u8, 2, 3, 4];
    client
        .send(UpstreamMessage::Binary(binary.clone().into()))
        .await
        .unwrap();
    assert_eq!(
        client.next().await.unwrap().unwrap().into_data(),
        binary
    );
    client.close(None).await.unwrap();

    if let Some(shutdown) = gateway.shutdown.take() {
        let _ = shutdown.send(());
    }
    gateway.handle.abort();
    upstream.await.unwrap();
    let _ = std::fs::remove_dir_all(paths.providers.parent().unwrap());
}

#[tokio::test]
async fn gateway_falls_back_to_http_sse_and_closes_normally() {
    let upstream = Arc::new(Server::http("127.0.0.1:0").unwrap());
    let upstream_addr = upstream.server_addr().to_ip().unwrap();
    let upstream_worker = upstream.clone();
    let upstream_thread = thread::spawn(move || {
        for _ in 0..4 {
            let mut request = upstream_worker.recv().unwrap();
            if request.method() == &Method::Get {
                request
                    .respond(Response::from_string("websocket unavailable").with_status_code(426))
                    .unwrap();
                continue;
            }
            let mut body = String::new();
            request.as_reader().read_to_string(&mut body).unwrap();
            assert_eq!(
                serde_json::from_str::<Value>(&body).unwrap()["stream"],
                Value::Bool(true)
            );
            let event = "data: {\"type\":\"response.completed\",\"response\":{\"id\":\"r_1\",\"usage\":{\"input_tokens\":3,\"output_tokens\":2,\"total_tokens\":5}}}\n\n";
            request
                .respond(
                    Response::from_string(event).with_header(
                        Header::from_bytes("Content-Type", "text/event-stream").unwrap(),
                    ),
                )
                .unwrap();
        }
    });

    let mut context = tauri::test::mock_context(tauri::test::noop_assets());
    context.config_mut().identifier = format!("com.codex-switch.ws-fallback.{}", uuid::Uuid::new_v4());
    let app = tauri::test::mock_builder().build(context).unwrap();
    let paths = crate::storage::resolve_paths(app.handle()).unwrap();
    std::fs::create_dir_all(&paths.providers).unwrap();
    let mut provider = openai_provider(format!("http://{upstream_addr}/v1"));
    provider.id = "headroom-fallback".to_string();
    provider.kind = ProviderKind::Custom;
    provider.name = "Headroom fallback".to_string();
    provider.websocket_enabled = true;
    crate::storage::write_json_atomic(
        &paths.providers.join("headroom-fallback.json"),
        &serde_json::to_value(provider).unwrap(),
    )
    .unwrap();
    let state = ManagerStateFile {
        active_provider_id: Some("headroom-fallback".to_string()),
        ..Default::default()
    };
    crate::storage::write_state(&paths, &state).unwrap();

    let (http_server, internal_addr) = bind_internal_http_server().unwrap();
    let http_server = Arc::new(http_server);
    let http_worker = http_server.clone();
    let request_app = app.handle().clone();
    let http_thread = thread::spawn(move || {
        for request in http_worker.incoming_requests() {
            handle_request(request_app.clone(), request);
        }
    });
    let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
    let gateway_addr = listener.local_addr().unwrap();
    let gateway = crate::local_proxy::proxy_gateway::start(
        listener,
        app.handle().clone(),
        internal_addr,
    )
    .unwrap();
    let runtime = ProxyRuntime {
        server: http_server,
        handle: Some(http_thread),
        gateway: Some(gateway),
    };

    let (mut client, _) = tokio_tungstenite::connect_async(format!(
        "ws://{gateway_addr}/v1/responses"
    ))
    .await
    .unwrap();
    let first = r#"{"type":"response.create","response":{"model":"gpt-5.6-sol","input":"hello"}}"#;
    client
        .send(UpstreamMessage::Text(first.into()))
        .await
        .unwrap();
    let completed = client.next().await.unwrap().unwrap().into_text().unwrap();
    assert_eq!(
        serde_json::from_str::<Value>(&completed).unwrap()["type"],
        "response.completed"
    );
    let close = client.next().await.unwrap().unwrap();
    assert!(matches!(close, UpstreamMessage::Close(Some(frame)) if frame.code == tokio_tungstenite::tungstenite::protocol::frame::coding::CloseCode::Normal));

    stop_proxy_runtime(runtime);
    upstream.unblock();
    upstream_thread.join().unwrap();
    let _ = std::fs::remove_dir_all(paths.providers.parent().unwrap());
}

#[test]
fn builds_version_aware_websocket_url() {
    let uri: axum::http::Uri = "/v1/responses?foo=bar".parse().unwrap();
    assert_eq!(
        websocket_upstream_url("https://headroom.example/v1", &uri).unwrap(),
        "wss://headroom.example/v1/responses?foo=bar"
    );
}

#[test]
fn response_create_requires_object_payload() {
    assert!(
        response_create_body(r#"{"type":"response.create","response":{"model":"gpt"}}"#)
            .is_ok()
    );
    assert!(response_create_body(r#"{"type":"response.create","response":[]}"#).is_err());
    assert!(response_create_body(r#"{"type":"response.cancel"}"#).is_err());
}

#[test]
fn response_create_accepts_flattened_codex_payload() {
    let body = response_create_body(
        r#"{"type":"response.create","model":"gpt-5.6-sol","input":"hello","stream":true}"#,
    )
    .unwrap();

    assert_eq!(body["model"], "gpt-5.6-sol");
    assert_eq!(body["input"], "hello");
    assert_eq!(body["stream"], true);
    assert!(body.get("type").is_none());
}

#[test]
fn websocket_headers_drop_handshake_and_authorization_values() {
    assert!(!should_forward_websocket_header("Authorization"));
    assert!(!should_forward_websocket_header("Sec-WebSocket-Key"));
    assert!(should_forward_websocket_header("OpenAI-Beta"));
    assert!(should_forward_websocket_header("Sec-WebSocket-Protocol"));
}

#[test]
fn websocket_upstream_request_replaces_client_authorization() {
    let request = upstream_request(
        "ws://headroom.example/v1/responses",
        &[
            ("Authorization".to_string(), "Bearer client-secret".to_string()),
            ("OpenAI-Beta".to_string(), "responses_websockets=2026-02-06".to_string()),
        ],
        "provider-secret",
    )
    .unwrap();

    assert_eq!(
        request.headers()["authorization"],
        "Bearer provider-secret"
    );
    assert_eq!(
        request.headers()["openai-beta"],
        "responses_websockets=2026-02-06"
    );
}

#[test]
fn http_fallback_preserves_client_authorization_for_lan_reauthorization() {
    assert!(should_forward_http_fallback_header("Authorization"));
    assert!(should_forward_http_fallback_header("OpenAI-Beta"));
    assert!(!should_forward_http_fallback_header("Sec-WebSocket-Key"));
    assert!(!should_forward_http_fallback_header("Sec-WebSocket-Protocol"));
    assert!(!should_forward_http_fallback_header("Connection"));
}

#[test]
fn websocket_diagnostic_target_removes_credentials_and_query_values() {
    let target = super::websocket_diagnostics::sanitized_websocket_target(
        "wss://user:secret@headroom.example/v1/responses?api_key=secret#fragment",
    );
    assert_eq!(target, "wss://headroom.example/v1/responses");
}
