use super::*;
use serde_json::json;

fn session() -> ProxySessionState {
    serde_json::from_value(json!({
        "id": "cost-thread", "client": "test", "connected_at": 1,
        "last_seen_at": 1, "request_count": 0, "concurrent_routed": false,
        "provider": "Official Codex",
        "token_totals": { "total_tokens": 0, "input_tokens": 0, "output_tokens": 0,
            "reasoning_tokens": 0, "cached_tokens": 0 }
    }))
    .unwrap()
}

fn entry() -> TokenUsageEntry {
    serde_json::from_value(json!({
        "id": "entry", "ts": 1, "provider": "Official Codex", "model": "gpt-5.6-sol",
        "inputTokens": 10_000, "cachedTokens": 5_000, "outputTokens": 1_000,
        "totalTokens": 11_000, "serviceTier": "priority"
    }))
    .unwrap()
}

fn costs() -> Costs {
    Costs {
        rates: codex_usage_cost_rates::CostRates::default(),
        providers: Vec::new(),
    }
}

#[test]
fn conversation_cost_accumulates_billed_requests_across_pruning_and_restart() {
    let mut session = session();
    let costs = costs();
    let entry = entry();
    let amount = costs.estimate(&entry);
    assert!(amount > 0.0);
    add_cost(&mut session, &entry, &costs);
    session.request_count = 800;
    // Requests are deliberately absent, as after pruning or restoring metadata.
    let mut restored: ProxySessionState =
        serde_json::from_value(serde_json::to_value(session).unwrap()).unwrap();
    add_cost(&mut restored, &entry, &costs);
    assert_eq!(restored.token_totals.estimated_cost_usd, Some(amount * 2.0));
}

#[test]
fn legacy_truncated_history_does_not_become_zero_or_a_partial_conversation_cost() {
    let mut session = session();
    session.request_count = 800;
    add_cost(&mut session, &entry(), &costs());
    assert_eq!(session.token_totals.estimated_cost_usd, None);
}

#[test]
fn complete_history_uses_each_models_cached_tokens_and_service_tier() {
    let mut session = session();
    session.request_count = 1;
    session.requests.push_back(
        serde_json::from_value(json!({
            "id": 1, "started_at": 1, "model": "gpt-5.6-sol", "service_tier": "priority",
            "input_attachments": [], "output_attachments": [], "response_truncated": false,
            "usage": { "input_tokens": 10_000, "cached_tokens": 5_000,
                "output_tokens": 1_000, "total_tokens": 11_000 }
        }))
        .unwrap(),
    );
    let costs = costs();
    let amount = costs.estimate(&entry());
    assert_eq!(historical_cost(&session, &costs), Some(amount));
    let mut next = entry();
    next.model = "gpt-6-astra".into();
    next.service_tier = None;
    add_cost(&mut session, &next, &costs);
    assert_eq!(
        session.token_totals.estimated_cost_usd,
        Some(amount + costs.estimate(&next))
    );
}
