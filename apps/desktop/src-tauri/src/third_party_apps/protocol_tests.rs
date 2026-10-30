use super::{provider_protocol, tests::provider, ProviderApiFormat, ProviderProtocol};

#[test]
fn model_protocol_overrides_provider_default() {
    let mut profile = provider();
    profile.api_format = ProviderApiFormat::OpenaiResponses;
    profile
        .model_api_formats
        .insert(profile.model.clone(), ProviderApiFormat::OpenaiChat);
    assert_eq!(provider_protocol(&profile), ProviderProtocol::OpenaiChat);
    profile
        .model_api_formats
        .insert("other".into(), ProviderApiFormat::AnthropicMessages);
    assert_eq!(provider_protocol(&profile), ProviderProtocol::OpenaiChat);
}

#[test]
fn unanimous_model_protocol_is_used_when_selected_model_has_no_override() {
    let mut profile = provider();
    profile.api_format = ProviderApiFormat::OpenaiResponses;
    profile
        .model_api_formats
        .insert("other".into(), ProviderApiFormat::OpenaiChat);
    assert_eq!(provider_protocol(&profile), ProviderProtocol::OpenaiChat);
    profile
        .model_api_formats
        .insert("mixed".into(), ProviderApiFormat::AnthropicMessages);
    assert_eq!(
        provider_protocol(&profile),
        ProviderProtocol::OpenaiResponses
    );
}

#[test]
fn provider_defaults_and_legacy_claude_profiles_remain_supported() {
    let mut profile = provider();
    for (format, protocol) in [
        (ProviderApiFormat::OpenaiChat, ProviderProtocol::OpenaiChat),
        (
            ProviderApiFormat::OpenaiResponses,
            ProviderProtocol::OpenaiResponses,
        ),
        (
            ProviderApiFormat::AnthropicMessages,
            ProviderProtocol::Anthropic,
        ),
    ] {
        profile.api_format = format;
        assert_eq!(provider_protocol(&profile), protocol);
    }
    profile.name = "Claude Code".into();
    profile.api_format = ProviderApiFormat::OpenaiResponses;
    assert_eq!(provider_protocol(&profile), ProviderProtocol::Anthropic);
    profile
        .model_api_formats
        .insert(profile.model.clone(), ProviderApiFormat::OpenaiChat);
    assert_eq!(provider_protocol(&profile), ProviderProtocol::OpenaiChat);
}
