// Regression coverage for https://github.com/piperhex/remoteai/issues/26.
// Responses already speaks Codex's tool protocol: preserve it across both turns.
fn ark_tool_response() -> Value {
    json!({
        "id": "resp_ark_tools", "status": "completed", "object": "response",
        "output": [
            {"type": "reasoning", "id": "ark_reasoning", "summary": [
                {"type": "summary_text", "text": "Inspect both files"}
            ]},
            {"type": "function_call", "id": "fc_item_a", "call_id": "call_a",
                "name": "read_file", "arguments": "{\"path\":\"a.txt\"}", "status": "completed"},
            {"type": "function_call", "id": "fc_item_b", "call_id": "call_b",
                "name": "read_file", "arguments": "{\"path\":\"b.txt\"}", "status": "completed"}
        ]
    })
}

fn ark_response_wire(response: &Value, stream: bool) -> String {
    if !stream {
        return response.to_string();
    }
    let mut events = vec![json!({"type": "response.created", "response": {
        "id": response["id"], "status": "in_progress", "output": []
    }})];
    for (index, item) in response["output"].as_array().unwrap().iter().enumerate() {
        let mut added = item.clone();
        if item["type"] == "function_call" {
            added["arguments"] = json!("");
            added["status"] = json!("in_progress");
        }
        events.push(
            json!({"type": "response.output_item.added", "output_index": index, "item": added}),
        );
        if item["type"] == "function_call" {
            events.push(json!({"type": "response.function_call_arguments.delta",
                "output_index": index, "item_id": item["id"], "delta": item["arguments"]}));
            events.push(json!({"type": "response.function_call_arguments.done",
                "output_index": index, "item_id": item["id"], "arguments": item["arguments"]}));
        }
        events.push(
            json!({"type": "response.output_item.done", "output_index": index, "item": item}),
        );
    }
    events.push(json!({"type": "response.completed", "response": response}));
    events
        .iter()
        .map(|event| {
            format!(
                "event: {}\ndata: {event}\n\n",
                event["type"].as_str().unwrap()
            )
        })
        .collect()
}

fn ark_tool_request(stream: bool) -> Value {
    json!({"model": "client-model", "store": false, "stream": stream,
        "input": [{"role": "user", "content": "Read both files"}],
        "tools": [{"type": "function", "name": "read_file", "parameters": {
            "type": "object", "properties": {"path": {"type": "string"}}, "required": ["path"]
        }}], "tool_choice": "auto"})
}

fn spawn_ark_tool_upstream(stream: bool) -> (String, thread::JoinHandle<Vec<ChatHeaderCapture>>) {
    let server = Server::http("127.0.0.1:0").unwrap();
    let base_url = format!("http://{}/api/v3", server.server_addr());
    let worker = thread::spawn(move || {
        let mut requests = Vec::new();
        for response in [
            ark_tool_response(),
            json!({"id": "resp_done", "status": "completed", "output": []}),
        ] {
            let mut request = server
                .recv_timeout(Duration::from_secs(5))
                .unwrap()
                .unwrap();
            requests.push(capture_chat_headers(&mut request));
            let content_type = if stream {
                "text/event-stream"
            } else {
                "application/json"
            };
            request
                .respond(
                    Response::from_string(ark_response_wire(&response, stream))
                        .with_header(Header::from_bytes("Content-Type", content_type).unwrap()),
                )
                .unwrap();
        }
        requests
    });
    (base_url, worker)
}

fn forward_ark_test_request(provider: &ProviderProfile, request: &Value) -> String {
    let headers = vec![("Content-Type".into(), "application/json".into())];
    let payload = forward_provider_request(
        &Method::Post,
        "/v1/responses",
        &headers,
        serde_json::to_vec(request).unwrap(),
        provider,
    )
    .unwrap();
    assert_eq!(payload.status, 200);
    String::from_utf8(read_upstream_payload(payload)).unwrap()
}

fn ark_round_trip(stream: bool) {
    let (base_url, worker) = spawn_ark_tool_upstream(stream);
    let mut provider = fallback_test_provider();
    provider.base_url = base_url;
    provider.model = "ep-ark-regression".into();
    provider.api_format = ProviderApiFormat::OpenaiChat;
    remember_provider_api_format(&provider, &provider.model, ProviderApiFormat::OpenaiChat);
    provider.api_format = ProviderApiFormat::OpenaiResponses;
    let mut request = ark_tool_request(stream);
    let original = request.clone();
    let wire = forward_ark_test_request(&provider, &request);
    assert_eq!(wire, ark_response_wire(&ark_tool_response(), stream));
    let response = if stream {
        sse_event(&wire, "response.completed")["response"].clone()
    } else {
        serde_json::from_str::<Value>(&wire).unwrap()
    };
    let input = request["input"].as_array_mut().unwrap();
    input.extend(response["output"].as_array().unwrap().iter().cloned());
    for call_id in ["call_b", "call_a"] {
        input.push(
            json!({"type": "function_call_output", "call_id": call_id, "output": "file content"}),
        );
    }
    forward_ark_test_request(&provider, &request);
    let captures = worker.join().unwrap();
    for (capture, expected) in captures.iter().zip([original, request]) {
        assert_eq!(capture.path, "/api/v3/responses");
        assert_eq!(capture.body["model"], "ep-ark-regression");
        assert_eq!(capture.body["input"], expected["input"]);
        assert_eq!(capture.body["tools"], expected["tools"]);
        assert_eq!(capture.body["store"], false);
        assert!(capture.body.get("messages").is_none());
    }
    provider_api_cache::forget_format(&provider.id, &provider.model);
}

#[test]
fn ark_responses_json_keeps_parallel_tool_calls_and_continuation_ids() {
    ark_round_trip(false);
}

#[test]
fn ark_responses_sse_keeps_structured_tool_events_and_continuation_ids() {
    ark_round_trip(true);
}

#[test]
fn ark_tool_history_error_does_not_switch_protocol_or_replace_the_error() {
    let provider = fallback_test_provider();
    let request = ark_tool_request(true);
    let message =
        "Messages with role 'tool' must be a response to a preceding message with 'tool_calls'";
    let mut attempts = Vec::new();
    let response = forward_provider_api(
        &provider,
        &serde_json::to_vec(&request).unwrap(),
        |format| {
            attempts.push(format);
            Ok(fallback_error_response(400, message))
        },
    )
    .unwrap();
    assert_eq!(attempts, [ProviderApiFormat::OpenaiResponses]);
    assert_eq!(response.status, 400);
    let body: Value = serde_json::from_slice(&read_upstream_payload(response)).unwrap();
    assert_eq!(body["error"]["message"], message);
    assert_eq!(
        provider_api_cache::cached_format(&provider, &provider.model),
        None
    );
}

#[test]
fn default_service_tier_accounts_for_issue26_body_growth_without_changing_input() {
    let mut request = ark_tool_request(true);
    request["input"] = ark_tool_response()["output"].clone();
    let body = serde_json::to_vec(&request).unwrap();
    let updated = snapshot_request_service_tier(
        &Method::Post,
        "/v1/responses",
        body.clone(),
        Some(ProxyServiceTier::Default),
    );
    assert_eq!(updated.len() - body.len(), 25);
    let updated: Value = serde_json::from_slice(&updated).unwrap();
    assert_eq!(updated["service_tier"], "default");
    assert_eq!(updated["input"], request["input"]);
    assert_eq!(updated["tools"], request["tools"]);
}
