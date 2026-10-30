#[test]
fn codex_catalog_and_refresh_sort_models_without_changing_selection_or_capabilities() {
    let paths = test_paths();
    fs::create_dir_all(&paths.codex_home).unwrap();
    let mut api = provider();
    api.models = ["gpt-6-astra", "qwen-3", "gpt-6.1-sol", "gpt-6.10-sol"]
        .map(str::to_string)
        .to_vec();
    api.model = "gpt-6-astra".into();
    api.model_selection_controlled_by_codex = true;
    api.model_context_windows.insert("gpt-6-astra".into(), 400_000);
    let catalog = model_catalog_for_provider(&api);
    let entries = catalog["models"].as_array().unwrap();
    let expected = ["gpt-6.10-sol", "gpt-6.1-sol", "gpt-6-astra", "qwen-3"];
    let actual: Vec<_> = entries
        .iter()
        .map(|entry| entry["slug"].as_str().unwrap())
        .collect();
    assert_eq!(actual, expected);
    assert_eq!(entries[2]["context_window"], 400_000);
    for (index, entry) in entries.iter().enumerate() {
        assert_eq!(entry["priority"], 1000 + index);
    }
    let ModelRefreshSource::Configured(refresh) = provider_model_refresh_request(&paths, &api)
    else {
        panic!("expected configured catalog")
    };
    assert_eq!(refresh.models, expected);
    assert_eq!(refresh.selected_model, "gpt-6-astra");
    assert_eq!(api.models[0], "gpt-6-astra");
    fs::remove_dir_all(paths.codex_home.parent().unwrap()).unwrap();
}

#[test]
fn mixed_codex_group_puts_official_models_before_relays_and_sorts_each_section() {
    let paths = test_paths();
    fs::create_dir_all(&paths.codex_home).unwrap();
    let mut relay = provider();
    relay.models = ["gpt-6-astra", "gpt-6.1-sol"].map(str::to_string)
        .to_vec();
    relay.model_selection_controlled_by_codex = true;
    let mut official = relay.clone();
    official.id = "account:official".into();
    official.name = "official@example.test".into();
    official.account_alias = Some("Work".into());
    let expected = vec![
        provider_group_model_name(&official, "gpt-6.1-sol"),
        provider_group_model_name(&official, "gpt-6-astra"),
        provider_group_model_name(&relay, "gpt-6.1-sol"),
        provider_group_model_name(&relay, "gpt-6-astra"),
    ];
    let selected = expected[3].clone();
    fs::write(&paths.current_config, format!("model = {selected:?}\n")).unwrap();
    let members = [relay, official];
    let catalog = model_catalog_for_provider_group(&members);
    let entries = catalog["models"].as_array().unwrap();
    let actual: Vec<_> = entries
        .iter()
        .map(|entry| entry["slug"].as_str().unwrap())
        .collect();
    assert_eq!(actual, expected);
    assert_eq!(entries[0]["display_name"], "gpt-6.1-sol · Work");
    for (index, entry) in entries.iter().enumerate() {
        assert_eq!(entry["priority"], 1000 + index);
    }
    let ModelRefreshSource::Configured(refresh) =
        provider_group_model_refresh_request(&paths, &members).unwrap()
    else {
        panic!("expected configured group")
    };
    assert_eq!(refresh.models, expected);
    assert_eq!(refresh.selected_model, selected);
    let routed = provider_for_group_model(&members, Some(&selected)).unwrap();
    assert_eq!(routed.id, members[0].id);
    assert_eq!(routed.model, "gpt-6-astra");
    fs::remove_dir_all(paths.codex_home.parent().unwrap()).unwrap();
}

#[derive(serde::Deserialize)]
struct ModelOrderFixture {
    name: String,
    input: Vec<String>,
    expected: Vec<String>,
}

fn model_order_fixtures() -> Vec<ModelOrderFixture> {
    serde_json::from_str(include_str!(
        "../../../../../../shared/model-order/fixtures.json"
    ))
    .unwrap()
}

#[test]
fn codex_model_order_matches_relay_picker_fixtures() {
    for mut fixture in model_order_fixtures() {
        model_order::sort_models(&mut fixture.input);
        assert_eq!(fixture.input, fixture.expected, "{}", fixture.name);
    }
}

#[test]
fn codex_group_orders_all_model_families_after_official_accounts() {
    let paths = test_paths();
    fs::create_dir_all(&paths.codex_home).unwrap();
    let mut official = provider();
    official.id = "account:official".into();
    official.name = "official@example.test".into();
    official.models = vec!["gpt-6-astra".into()];
    official.model_selection_controlled_by_codex = true;
    for fixture in model_order_fixtures() {
        let mut relay = provider();
        relay.models = fixture.input;
        relay.model_selection_controlled_by_codex = true;
        let mut expected = vec![provider_group_model_name(&official, &official.models[0])];
        expected.extend(
            fixture.expected.iter().map(|model| provider_group_model_name(&relay, model)),
        );
        let members = [relay, official.clone()];
        let catalog = model_catalog_for_provider_group(&members);
        let actual: Vec<_> = catalog["models"]
            .as_array()
            .unwrap()
            .iter()
            .map(|entry| entry["slug"].as_str().unwrap())
            .collect();
        assert_eq!(actual, expected, "{}", fixture.name);
        let ModelRefreshSource::Configured(refresh) =
            provider_group_model_refresh_request(&paths, &members).unwrap()
        else {
            panic!("expected configured group")
        };
        assert_eq!(refresh.models, expected, "{}", fixture.name);
        for model in fixture.expected {
            let slug = provider_group_model_name(&members[0], &model);
            let routed = provider_for_group_model(&members, Some(&slug)).unwrap();
            assert_eq!(routed.id, members[0].id);
            assert_eq!(routed.model, model);
        }
    }
    fs::remove_dir_all(paths.codex_home.parent().unwrap()).unwrap();
}
