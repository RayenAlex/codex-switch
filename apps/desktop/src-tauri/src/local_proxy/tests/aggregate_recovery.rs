#[test]
fn aggregate_balance_rejection_tries_the_next_member_and_releases_session_affinity() {
    let first = AggregateTestServer::new(
        403,
        r#"{"code":"INSUFFICIENT_BALANCE","message":"Insufficient account balance"}"#,
        vec![("Content-Type", "application/json")],
    );
    let second = AggregateTestServer::status(200);
    let target = aggregate_test_target(&[&first.url, &second.url]);
    for _ in 0..2 {
        let response = send_aggregate_fixture(&target).unwrap();
        assert_eq!(response.status, 200);
        read_upstream_payload(response);
    }
    assert_eq!([first.calls(), second.calls()], [1, 2]);
    let states =
        aggregate_scheduler::member_states(&target.config.id, &target.config.member_provider_ids)
            .unwrap();
    assert_eq!(states["member-0"].consecutive_failures, 1);
    aggregate_scheduler::reset(&target.config.id);
}

#[test]
fn aggregate_capacity_failover_preserves_disabled_policy_budget_and_permission_errors() {
    for (body, enabled, attempts) in [
        (r#"{"code":"INSUFFICIENT_BALANCE"}"#, false, 3),
        (r#"{"code":"INSUFFICIENT_BALANCE"}"#, true, 1),
        (
            r#"{"code":"permission_denied","message":"INSUFFICIENT_BALANCE"}"#,
            true,
            3,
        ),
    ] {
        let first = AggregateTestServer::new(403, body, vec![("Content-Type", "application/json")]);
        let second = AggregateTestServer::status(200);
        let mut target = aggregate_test_target(&[&first.url, &second.url]);
        target.config.failover_policy.enabled = enabled;
        target.config.failover_policy.max_attempts = attempts;
        let response = send_aggregate_fixture(&target).unwrap();
        assert_eq!(response.status, 403);
        assert_eq!(read_upstream_payload(response), body.as_bytes());
        assert_eq!([first.calls(), second.calls()], [1, 0]);
        aggregate_scheduler::reset(&target.config.id);
    }
}

#[test]
fn aggregate_capacity_requires_a_structured_rejection_and_never_replays_ambiguous_sends() {
    let policy = crate::aggregate_failover::AggregateFailoverPolicy::default();
    for (status, body, retryable) in [
        (402, r#"{"error":{"code":"insufficient_balance"}}"#, true),
        (403, r#"{"error":{"type":"insufficient_quota"}}"#, true),
        (403, r#"{"code":"INSUFFICIENT_BALANCE"}"#, true),
        (403, r#"{"error":{"code":"permission_denied"}}"#, false),
        (403, "INSUFFICIENT_BALANCE", false),
        (400, r#"{"code":"INSUFFICIENT_BALANCE"}"#, false),
    ] {
        let response = Ok(UpstreamPayload {
            status,
            content_type: Some("application/json".into()),
            response_headers: vec![],
            body: UpstreamBody::Buffered(body.as_bytes().to_vec()),
            token_usage_account: None,
            token_usage_service_tier: None,
        });
        assert_eq!(
            aggregate_failure_decision(&policy, &response, None).1,
            retryable
        );
        let network = Some(failover_transport::NetworkFailure { replay_safe: false });
        assert!(!aggregate_failure_decision(&policy, &response, network).1);
    }
}

#[test]
fn aggregate_large_completion_clears_failures_and_restores_a_recovering_member() {
    let body = format!(
        "event: response.completed\ndata: {}\n\n",
        json!({"type": "response.completed", "response": {
            "id": "resp_large", "status": "completed", "output": "x".repeat(256 * 1024),
        }})
    );
    let server = AggregateTestServer::new(200, &body, vec![("Content-Type", "text/event-stream")]);
    let mut target = aggregate_test_target(&[&server.url]);
    target.config.failover_policy.failure_threshold = 1;
    target.config.failover_policy.initial_cooldown_seconds = 1;
    aggregate_scheduler::select_member(aggregate_scheduler::SelectionOptions {
        aggregate_id: &target.config.id,
        session_id: Some("conversation"),
        member_ids: &target.config.member_provider_ids,
        excluded: &HashSet::new(),
        policy: &target.config.failover_policy,
    })
    .unwrap()
    .finish(aggregate_scheduler::MemberOutcome::Failure { retry_after: None });
    thread::sleep(Duration::from_millis(1050));
    let response = send_aggregate_fixture(&target).unwrap();
    assert_eq!(read_upstream_payload(response), body.as_bytes());
    let states =
        aggregate_scheduler::member_states(&target.config.id, &target.config.member_provider_ids)
            .unwrap();
    assert_eq!(
        states["member-0"].state,
        aggregate_scheduler::MemberState::Healthy
    );
    assert_eq!(states["member-0"].consecutive_failures, 0);
    assert_eq!(
        read_upstream_payload(send_aggregate_fixture(&target).unwrap()),
        body.as_bytes()
    );
    assert_eq!(server.calls(), 2);
    aggregate_scheduler::reset(&target.config.id);
}
