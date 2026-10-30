//! Run with SSH_TEST_CONFIG pointing to a disposable fixture, then `cargo test --test live -- --ignored`.
use base64::{engine::general_purpose::STANDARD, Engine};
use csw_ssh_client::*;
use serde_json::{json, Value};
use std::{sync::Arc, time::Duration};
use tokio::sync::mpsc;

fn request(config: &Value, fingerprint: &str, key: bool) -> Connect {
    serde_json::from_value(json!({
        "endpoint": { "host": config["host"], "port": config["port"] },
        "username": config["username"], "fingerprint": fingerprint,
        "password": if key { Value::Null } else { config["password"].clone() },
        "privateKey": if key { config["privateKey"].clone() } else { Value::Null },
        "size": { "cols": 80, "rows": 24 }
    }))
    .expect("fixture request")
}

async fn output(receiver: &mut mpsc::UnboundedReceiver<Event>, expected: &str) {
    tokio::time::timeout(Duration::from_secs(10), async {
        let mut bytes = Vec::new();
        while let Some(event) = receiver.recv().await {
            if let Event::Output { data } = event {
                bytes.extend(data);
            }
            if String::from_utf8_lossy(&bytes).contains(expected) {
                return;
            }
        }
        panic!("SSH output ended before the expected marker");
    })
    .await
    .expect("SSH output timeout");
}

async fn files(client: &Client, id: &str) {
    let folder = format!("/test-{}", uuid::Uuid::new_v4());
    let path = format!("{folder}/中文.txt");
    let renamed = format!("{folder}/renamed.txt");
    client
        .files(
            id,
            FileAction::CreateFolder {
                path: folder.clone(),
            },
        )
        .await
        .expect("mkdir");
    let payload = STANDARD.encode("WSL upload 中文\n");
    client
        .files(
            id,
            FileAction::Upload {
                path: path.clone(),
                data: payload.clone(),
            },
        )
        .await
        .expect("upload");
    assert!(matches!(
        client
            .files(
                id,
                FileAction::Upload {
                    path: path.clone(),
                    data: payload.clone()
                }
            )
            .await,
        Err(Error::Conflict)
    ));
    assert!(matches!(
        client
            .files(
                id,
                FileAction::Delete {
                    path: folder.clone()
                }
            )
            .await,
        Err(Error::File)
    ));
    let FileReply::File { data } = client
        .files(id, FileAction::Read { path: path.clone() })
        .await
        .expect("read")
    else {
        panic!("expected file")
    };
    assert_eq!(data, payload);
    client
        .files(
            id,
            FileAction::Rename {
                path,
                destination: renamed.clone(),
            },
        )
        .await
        .expect("rename");
    let FileReply::List { entries, .. } = client
        .files(
            id,
            FileAction::List {
                path: folder.clone(),
            },
        )
        .await
        .expect("list")
    else {
        panic!("expected directory")
    };
    assert_eq!(entries.len(), 1);
    assert_eq!(entries[0].name, "renamed.txt");
    client
        .files(id, FileAction::Delete { path: renamed })
        .await
        .expect("delete file");
    client
        .files(id, FileAction::Delete { path: folder })
        .await
        .expect("delete empty folder");
}

#[tokio::test]
#[ignore = "requires disposable SSH_TEST_CONFIG fixture"]
async fn live_password_key_host_verification_shell_resize_and_sftp() {
    let config: Value = serde_json::from_slice(
        &std::fs::read(std::env::var("SSH_TEST_CONFIG").expect("SSH_TEST_CONFIG"))
            .expect("fixture file"),
    )
    .expect("fixture JSON");
    let endpoint =
        serde_json::from_value(json!({ "host": config["host"], "port": config["port"] }))
            .expect("fixture endpoint");
    let fingerprint = probe(endpoint).await.expect("host fingerprint");
    let client = Arc::new(Client::default());
    assert!(matches!(
        client
            .open(request(&config, "SHA256:wrong", false), Arc::new(|_| true))
            .await,
        Err(Error::HostKey)
    ));
    let mut wrong_password = request(&config, &fingerprint, false);
    wrong_password.password = Some("incorrect".into());
    assert!(matches!(
        client.open(wrong_password, Arc::new(|_| true)).await,
        Err(Error::Authentication)
    ));
    for key in [false, true] {
        let (sender, mut receiver) = mpsc::unbounded_channel();
        let info = client
            .open(
                request(&config, &fingerprint, key),
                Arc::new(move |event| sender.send(event).is_ok()),
            )
            .await
            .expect("SSH authentication");
        output(&mut receiver, "wsl-ssh>").await;
        client
            .command(Command::Resize {
                id: info.id.clone(),
                size: Size { cols: 91, rows: 33 },
            })
            .await
            .expect("resize");
        client
            .command(Command::Write {
                id: info.id.clone(),
                data: "stty size\r".into(),
            })
            .await
            .expect("input");
        output(&mut receiver, "33 91").await;
        files(&client, &info.id).await;
        client
            .command(Command::Close {
                id: info.id.clone(),
            })
            .await
            .expect("close");
        tokio::time::sleep(Duration::from_millis(50)).await;
        assert!(matches!(
            client
                .files(&info.id, FileAction::List { path: ".".into() })
                .await,
            Err(Error::Closed)
        ));
    }
}
