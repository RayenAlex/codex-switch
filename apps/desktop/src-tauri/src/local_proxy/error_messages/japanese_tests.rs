use super::*;
use crate::local_proxy::{
    error_capture::ErrorCapture,
    request_error::{self, RequestError, Stage},
};
use crate::storage::{with_interface_language, InterfaceLanguage};

#[test]
fn japanese_keeps_retry_counts_and_hides_private_diagnostics() {
    let timeout = TransportFailure::ConnectTimeout.japanese_message();
    assert_eq!(
        gui("Messages request failed: operation timed out (attempts: 7)"),
        format!("{timeout} 試行回数：7 回。")
    );
    for error in [
        "https://user:private@private.test/path",
        r"C:\Users\private\auth.json",
        "proxy_request_error:{\"stage\":\"private\",\"cause\":\"private\"}",
    ] {
        let message = gui(error);
        assert!(message.contains(&super::super::error_id(error)));
        assert!(!message.contains("private"));
    }
    for failure in transport_failures() {
        assert_eq!(gui(failure.message()), failure.japanese_message());
    }
}

#[test]
fn japanese_translates_known_failures_without_changing_error_ids() {
    for source in [
        "Messages requests must use POST",
        "A tool call contains invalid arguments",
        "An image uses an unsupported format",
        "auth.json is missing tokens.access_token",
        "Aggregate API is disabled",
    ] {
        let message = gui(source);
        assert_ne!(message, super::super::known::message(source).unwrap());
        assert!(!message.contains("エラー番号"), "{message}");
        assert_eq!(gui(&message), message);
    }
}

#[test]
fn japanese_reaches_structured_errors_catalog_and_streams() {
    let syntax = serde_json::from_str::<serde_json::Value>("{\n\"private\":").unwrap_err();
    let error = RequestError::json(Stage::Request, &syntax);
    let original = error.wire();
    with_interface_language(InterfaceLanguage::Ja, || {
        assert_eq!(error.wire(), original);
        let message = super::super::gui(&original);
        assert_eq!(message, error.to_string());
        assert!(message.contains(&format!("{} 行", syntax.line())));
        assert!(message.contains(&format!("{} 列", syntax.column())));
        assert!(!message.contains("private"));
        let http = RequestError::http(Stage::OutputLimit, 429).to_string();
        assert!(http.contains("HTTP 429") && http.contains("max_tokens"));
        let catalog = request_error::catalog_failure(
            RequestError::http(Stage::Catalog, 503),
            RequestError::new(Stage::Catalog, request_error::Problem::CatalogInvalid),
        );
        let catalog = super::super::gui(&catalog);
        assert!(catalog.contains("公式モデル一覧") && catalog.contains("HTTP 503"));
        let captured = ErrorCapture::new(true, 200).finish();
        assert_eq!(captured[0].message, problem_text(Problem::MissingTerminal));
    });
    assert_eq!(error.wire(), original);
}
