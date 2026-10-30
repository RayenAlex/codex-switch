#[test]
fn account_alias_updates_catalog_and_refresh_without_changing_routing() {
    use crate::storage::{account_private_details_path, save_account_private_details};
    let paths = test_paths();
    let id = grouped_official_account(&paths, "account@example.test", "Work");
    let original = provider_group_profiles(&paths, "Work").unwrap();
    let model = original[0].models.last().unwrap().clone();
    let slug = provider_group_model_name(&original[0], &model);
    let config = format!("model = {slug:?}\ncustom_setting = true\n");
    fs::create_dir_all(paths.current_config.parent().unwrap()).unwrap();
    fs::write(&paths.current_config, &config).unwrap();
    let path = account_private_details_path(&paths, &id);
    for alias in ["工作号", "测试号", ""] {
        let details = crate::models::AccountPrivateDetails {
            alias: Some(alias.into()), ..Default::default()
        };
        save_account_private_details(&path, &details).unwrap();
        let members = provider_group_profiles(&paths, "Work").unwrap();
        group_accounts::refresh_catalog(&paths, &members).unwrap();
        assert_eq!(fs::read_to_string(&paths.current_config).unwrap(), config);
        let selected = provider_for_group_model(&members, Some(&slug)).unwrap();
        assert_eq!(selected.id, format!("account:{id}"));
        assert_eq!(selected.model, model);
        let catalog = model_catalog_for_provider_group(&members);
        let entry = catalog["models"].as_array().unwrap().iter().find(|entry| entry["slug"] == slug).unwrap();
        let label = if alias.is_empty() {
            format!("{model} · account · {}", id.chars().take(4).collect::<String>())
        } else { format!("{model} · {alias}") };
        assert_eq!(entry["display_name"], label);
        let ModelRefreshSource::Configured(refresh) = provider_group_model_refresh_request(&paths, &members).unwrap()
        else { panic!("group must use the configured catalog") };
        assert_eq!(refresh.display_names[&slug], label);
        assert_eq!(refresh.selected_model, slug);
    }
    fs::remove_dir_all(paths.codex_home.parent().unwrap()).unwrap();
}

#[test]
fn duplicate_aliases_keep_account_routes_distinct() {
    let mut first = provider();
    first.id = "account:first".into();
    first.name = "same@example.test".into();
    first.account_alias = Some("Work".into());
    let mut second = first.clone();
    second.id = "account:second".into();
    let members = [first, second];
    let catalog = model_catalog_for_provider_group(&members);
    let entries = catalog["models"].as_array().unwrap();
    assert_eq!(entries[0]["display_name"], entries[1]["display_name"]);
    assert_ne!(entries[0]["slug"], entries[1]["slug"]);
    for (index, entry) in entries.iter().enumerate() {
        let selected = provider_for_group_model(&members, entry["slug"].as_str()).unwrap();
        assert_eq!(selected.id, members[index].id);
    }
}

#[test]
fn alias_storage_preserves_missing_fields_and_validates_before_writing() {
    use crate::storage::{account_private_details_path, load_account_private_details, save_account_private_details};
    use crate::models::AccountPrivateDetails;
    let paths = test_paths();
    let path = account_private_details_path(&paths, "fixture");
    let details = AccountPrivateDetails { alias: Some("  工作号  ".into()), ..Default::default() };
    save_account_private_details(&path, &details).unwrap();
    save_account_private_details(&path, &AccountPrivateDetails::default()).unwrap();
    assert_eq!(load_account_private_details(&path).alias.as_deref(), Some("工作号"));
    for alias in ["中".repeat(17), "bad\nname".into()] {
        let details = AccountPrivateDetails { alias: Some(alias), ..Default::default() };
        assert!(save_account_private_details(&path, &details).is_err());
    }
    assert_eq!(load_account_private_details(&path).alias.as_deref(), Some("工作号"));
    fs::remove_dir_all(paths.codex_home.parent().unwrap()).unwrap();
}
