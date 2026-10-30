use super::*;
use serde_json::json;

fn scope(user: &str) -> QuotaScope {
    QuotaScope {
        base_url: "https://quota.test".into(),
        user_id: user.into(),
    }
}

fn estimate(remaining: f64, capacity: Option<f64>) -> serde_json::Value {
    json!({ "remainingUsd": remaining, "capacityUsd": capacity, "consumedUsd": 10,
        "declinePercent": 20, "startPercent": 80, "remainingPercent": 60, "startTs": 0, "endTs": 10 })
}

#[test]
fn uses_the_same_limiting_window_as_the_pc_account_quota() {
    let summary: summary::UsageSummary = serde_json::from_value(json!({
        "status": "ready", "updatedAt": 10, "accounts": [{
            "accountId": "account", "accountLabel": "Account", "tokens": 100, "costUsd": 999,
            "remainingUsd": 20, "primary": estimate(80.0, Some(100.0)),
            "secondary": estimate(20.0, Some(200.0)), "devices": []
        }]
    }))
    .unwrap();
    let values = summary.available_quotas();
    let quota = values.get("account").unwrap();
    assert_eq!(quota.remaining_usd, 20.0);
    assert_eq!(quota.capacity_usd, Some(200.0));
}

#[test]
fn concurrent_totals_require_every_selected_account_and_preserve_unknown_capacity() {
    let cache = QuotaCache {
        quotas: Some(HashMap::from([
            (
                "a".into(),
                EstimatedOfficialQuota {
                    remaining_usd: 20.0,
                    capacity_usd: Some(100.0),
                },
            ),
            (
                "b".into(),
                EstimatedOfficialQuota {
                    remaining_usd: 30.0,
                    capacity_usd: Some(200.0),
                },
            ),
            (
                "empty".into(),
                EstimatedOfficialQuota {
                    remaining_usd: 0.0,
                    capacity_usd: None,
                },
            ),
        ])),
        ..QuotaCache::new()
    };
    let total = cache.selected(&["a".into(), "b".into()]).unwrap();
    assert_eq!(total.remaining_usd, 50.0);
    assert_eq!(total.capacity_usd, Some(300.0));
    assert!(cache.selected(&["a".into(), "missing".into()]).is_none());
    assert!(cache.selected(&[]).is_none());
    let empty = cache.selected(&["empty".into()]).unwrap();
    assert_eq!(empty.remaining_usd, 0.0);
    assert_eq!(empty.capacity_usd, None);
}

#[test]
fn refresh_is_single_flight_and_backed_off_after_failure() {
    let mut cache = QuotaCache::new();
    let owner = scope("owner");
    let now = Instant::now();
    assert!(cache.select(&owner, now));
    assert!(!cache.select(&owner, now + REFRESH_INTERVAL));
    cache.finish(&owner, now, Some(HashMap::new()));
    assert!(!cache.select(&owner, now + Duration::from_secs(5)));
    assert!(cache.select(&owner, now + REFRESH_INTERVAL));
    cache.finish(&owner, now + REFRESH_INTERVAL, None);
    assert!(cache.quotas.is_none());
    assert!(!cache.select(&owner, now + REFRESH_INTERVAL + Duration::from_secs(5)));
}

#[test]
fn switching_cloud_accounts_or_servers_discards_cached_and_late_results() {
    let mut cache = QuotaCache::new();
    let first = scope("first");
    let mut second = scope("second");
    let now = Instant::now();
    cache.select(&first, now);
    assert!(cache.select(&second, now));
    cache.finish(&first, now, Some(HashMap::new()));
    assert!(cache.running);
    assert!(cache.quotas.is_none());
    cache.finish(&second, now, Some(HashMap::new()));
    second.base_url = "https://other.test".into();
    assert!(cache.select(&second, now));
    assert!(cache.quotas.is_none());
}

#[test]
fn returning_to_an_account_does_not_accept_an_earlier_request() {
    let mut cache = QuotaCache::new();
    let first = scope("first");
    let second = scope("second");
    let now = Instant::now();
    cache.select(&first, now);
    cache.select(&second, now + Duration::from_secs(1));
    let latest = now + Duration::from_secs(2);
    cache.select(&first, latest);
    cache.finish(&first, now, Some(HashMap::new()));
    assert!(cache.running);
    assert!(cache.quotas.is_none());
    cache.finish(&first, latest, Some(HashMap::new()));
    assert!(!cache.running);
    assert!(cache.quotas.is_some());
}
