use super::*;
use crate::gui_terminal::service::TerminalState;
use std::{
    sync::{mpsc, Arc},
    time::{Duration, Instant},
};

fn package(directory: &Path, name: &str, script: &str) {
    let value = serde_json::json!({ "scripts": { name: script } });
    std::fs::write(directory.join("package.json"), value.to_string()).expect("package fixture");
}

#[test]
fn validates_scripts_and_passes_names_as_data() {
    let directory = tempfile::tempdir().expect("directory");
    let name = "build:&'\"$(echo injected)%PATH%";
    package(directory.path(), name, "node -v");
    let (command, _) = command(directory.path(), name).expect("script command");
    assert_eq!(
        command.get_env(SCRIPT_ENV),
        Some(std::ffi::OsStr::new(name))
    );
    assert!(command
        .get_argv()
        .iter()
        .all(|arg| !arg.to_string_lossy().contains(name)));
    assert!(matches!(
        validate(directory.path(), "missing"),
        Err(TerminalError::Script)
    ));
    assert!(matches!(
        validate(directory.path(), "dev\nexit"),
        Err(TerminalError::Script)
    ));
    std::fs::write(directory.path().join("package.json"), "{broken").expect("invalid package");
    assert!(validate(directory.path(), name).is_err());
}

fn start(
    directory: &Path,
    name: &str,
) -> (
    Arc<TerminalState>,
    TerminalInfo,
    mpsc::Receiver<TerminalEvent>,
) {
    let state = Arc::new(TerminalState::default());
    let (sender, receiver) = mpsc::channel();
    let info = state
        .open(
            OpenTerminal {
                cwd: Some(directory.to_string_lossy().into_owned()),
                size: TerminalSize {
                    cols: 100,
                    rows: 24,
                },
                npm_script: Some(name.into()),
            },
            Arc::new(move |event| sender.send(event).is_ok()),
        )
        .expect("open npm terminal");
    (state, info, receiver)
}

fn wait_until(
    state: &TerminalState,
    info: &TerminalInfo,
    receiver: &mpsc::Receiver<TerminalEvent>,
    finished: impl Fn(&str, bool) -> bool,
) -> String {
    let deadline = Instant::now() + Duration::from_secs(45);
    let mut bytes = Vec::new();
    let mut queries = 0;
    loop {
        let event = receiver
            .recv_timeout(deadline.saturating_duration_since(Instant::now()))
            .unwrap_or_else(|error| {
                panic!(
                    "npm output timeout: {error}; {}",
                    String::from_utf8_lossy(&bytes)
                )
            });
        let exited = matches!(event, TerminalEvent::Exit { .. });
        if let TerminalEvent::Output { data } = event {
            bytes.extend(data);
        }
        let output = String::from_utf8_lossy(&bytes);
        let count = output.matches("\x1b[6n").count();
        if count > queries {
            queries = count;
            state
                .perform(TerminalRequest::Write {
                    id: info.id.clone(),
                    data: "\x1b[1;1R".into(),
                })
                .expect("cursor position");
        }
        if finished(&output, exited) {
            return output.into_owned();
        }
        assert!(!exited, "npm exited unexpectedly: {output}");
    }
}

#[test]
fn npm_streams_output_and_reports_natural_exit() {
    let directory = tempfile::tempdir().expect("directory");
    package(
        directory.path(),
        "test:script",
        "node -e \"console.log('npm-fixture-ready')\"",
    );
    let (state, info, receiver) = start(directory.path(), "test:script");
    let output = wait_until(&state, &info, &receiver, |_, exited| exited);
    assert!(output.contains("npm-fixture-ready"), "{output}");
    assert_eq!(info.npm_script.as_deref(), Some("test:script"));
    state.shutdown();
}

#[test]
fn closing_npm_terminal_stops_its_server_and_releases_the_port() {
    let directory = tempfile::tempdir().expect("directory");
    let listener = std::net::TcpListener::bind("127.0.0.1:0").expect("reserve port");
    let port = listener.local_addr().expect("address").port();
    drop(listener);
    package(directory.path(), "dev", "node server.cjs");
    std::fs::write(directory.path().join("server.cjs"), format!(
        "require('net').createServer().listen({port}, '127.0.0.1', () => console.log('server-ready'));"
    )).expect("server fixture");
    let (state, info, receiver) = start(directory.path(), "dev");
    wait_until(&state, &info, &receiver, |output, _| {
        output.contains("server-ready")
    });
    // A live connection creates Windows TIME_WAIT sockets; check port ownership without connecting.
    assert!(std::net::TcpListener::bind(("127.0.0.1", port)).is_err());
    state.close(&info.id).expect("close npm terminal");
    wait_until(&state, &info, &receiver, |_, exited| exited);
    let deadline = Instant::now() + Duration::from_secs(5);
    while let Err(error) = std::net::TcpListener::bind(("127.0.0.1", port)) {
        assert!(
            Instant::now() < deadline,
            "npm child still owns port {port}: {error}"
        );
        std::thread::sleep(Duration::from_millis(50));
    }
    state.shutdown();
}
