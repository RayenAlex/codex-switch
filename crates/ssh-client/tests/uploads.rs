//! Isolated SFTP integration checks; requires the disposable SSH_TEST_CONFIG fixture.
use base64::{engine::general_purpose::STANDARD, Engine};
use csw_ssh_client::*;
use serde_json::{json, Value};
use std::sync::Arc;

async fn call(client: &Client, id: &str, value: Value) -> Result<FileReply> {
    client
        .files(id, serde_json::from_value(value).expect("file action"))
        .await
}

async fn connect(client: &Arc<Client>) -> Info {
    let config: Value = serde_json::from_slice(
        &std::fs::read(std::env::var("SSH_TEST_CONFIG").expect("fixture path"))
            .expect("fixture config"),
    )
    .expect("fixture JSON");
    let endpoint = json!({ "host": config["host"], "port": config["port"] });
    let fingerprint = probe(serde_json::from_value(endpoint.clone()).unwrap())
        .await
        .expect("probe");
    let request = serde_json::from_value(json!({ "endpoint": endpoint, "username": config["username"],
        "password": config["password"], "fingerprint": fingerprint, "size": { "cols": 80, "rows": 24 } })).unwrap();
    client
        .open(request, Arc::new(|_| true))
        .await
        .expect("connect")
}

async fn start(client: &Client, id: &str, value: Value) -> String {
    let FileReply::Upload { token } = call(client, id, value).await.expect("start upload") else {
        panic!("upload token expected");
    };
    token
}

async fn upload(client: &Client, id: &str, path: &str, data: &[u8]) -> String {
    let token = start(
        client,
        id,
        json!({ "type": "uploadStart", "path": path,
        "size": data.len(), "mode": "reject" }),
    )
    .await;
    assert!(call(
        client,
        id,
        json!({ "type": "uploadFinish", "token": token })
    )
    .await
    .is_err());
    for (index, chunk) in data.chunks(UPLOAD_CHUNK_BYTES).enumerate() {
        let request = json!({ "type": "uploadChunk", "token": token,
            "offset": index * UPLOAD_CHUNK_BYTES, "data": STANDARD.encode(chunk) });
        call(client, id, request.clone()).await.expect("chunk");
        if index == 0 {
            call(client, id, request).await.expect("safe chunk retry");
        }
    }
    let FileReply::Uploaded { path } = call(
        client,
        id,
        json!({ "type": "uploadFinish", "token": token }),
    )
    .await
    .expect("finish upload") else {
        panic!("published path expected");
    };
    path
}

async fn assert_content(client: &Client, id: &str, path: &str, expected: &[u8]) {
    for (index, chunk) in expected.chunks(UPLOAD_CHUNK_BYTES).enumerate() {
        let FileReply::File { data } = call(
            client,
            id,
            json!({ "type": "readChunk", "path": path,
            "offset": index * UPLOAD_CHUNK_BYTES, "length": chunk.len() }),
        )
        .await
        .expect("read chunk") else {
            panic!("file chunk expected");
        };
        assert_eq!(STANDARD.decode(data).unwrap(), chunk);
    }
}

async fn conflicts(client: &Client, id: &str, path: &str) {
    assert!(matches!(
        call(
            client,
            id,
            json!({ "type": "uploadStart", "path": path, "size": 1,
        "mode": "reject" })
        )
        .await,
        Err(Error::Conflict)
    ));
    for (mode, suffix) in [("rename", " (1)"), ("rename", " (2)"), ("overwrite", "")] {
        let token = start(
            client,
            id,
            json!({ "type": "uploadStart", "path": path, "size": 3, "mode": mode }),
        )
        .await;
        call(
            client,
            id,
            json!({ "type": "uploadChunk", "token": token, "offset": 0,
            "data": STANDARD.encode(b"new") }),
        )
        .await
        .expect("replacement chunk");
        let FileReply::Uploaded { path: actual } = call(
            client,
            id,
            json!({ "type": "uploadFinish", "token": token }),
        )
        .await
        .expect("publish chosen mode") else {
            panic!("published path expected");
        };
        assert_eq!(actual, path.replace(".bin", &format!("{suffix}.bin")));
        assert_content(client, id, &actual, b"new").await;
    }
}

async fn cancellation_and_race(client: &Arc<Client>, id: &str, folder: &str) {
    let original = format!("{folder}/large.bin");
    let replacement = start(
        client,
        id,
        json!({ "type": "uploadStart", "path": original,
        "size": 4, "mode": "overwrite" }),
    )
    .await;
    call(
        client,
        id,
        json!({ "type": "uploadChunk", "token": replacement, "offset": 0,
        "data": STANDARD.encode(b"xx") }),
    )
    .await
    .expect("partial replacement");
    call(
        client,
        id,
        json!({ "type": "uploadCancel", "token": replacement }),
    )
    .await
    .expect("cancel overwrite");
    assert_content(client, id, &original, b"new").await;
    let path = format!("{folder}/race.txt");
    let token = start(
        client,
        id,
        json!({ "type": "uploadStart", "path": path, "size": 0, "mode": "reject" }),
    )
    .await;
    let other = connect(client).await;
    assert!(call(
        client,
        &other.id,
        json!({ "type": "uploadFinish", "token": token })
    )
    .await
    .is_err());
    client
        .command(Command::Close { id: other.id })
        .await
        .expect("close other owner");
    call(client, id, json!({ "type": "createFile", "path": path }))
        .await
        .expect("racing destination");
    assert!(matches!(
        call(
            client,
            id,
            json!({ "type": "uploadFinish", "token": token })
        )
        .await,
        Err(Error::Conflict)
    ));
    for _ in 0..2 {
        call(
            client,
            id,
            json!({ "type": "uploadCancel", "token": token }),
        )
        .await
        .expect("cancel");
    }
    let FileReply::List { entries, .. } =
        call(client, id, json!({ "type": "list", "path": folder }))
            .await
            .unwrap()
    else {
        panic!("list expected");
    };
    assert!(entries
        .iter()
        .all(|entry| !entry.name.starts_with(".remoteai-upload-")));
}

#[tokio::test]
#[ignore = "requires disposable SSH_TEST_CONFIG fixture"]
async fn large_uploads_conflicts_cancellation_and_directory_operations() {
    let client = Arc::new(Client::default());
    let info = connect(&client).await;
    let folder = format!("/upload-{}", uuid::Uuid::new_v4());
    call(
        &client,
        &info.id,
        json!({ "type": "createFolder", "path": folder }),
    )
    .await
    .expect("folder");
    let path = format!("{folder}/large.bin");
    let payload: Vec<_> = (0..6 * 1024 * 1024 + 19)
        .map(|index| (index % 251) as u8)
        .collect();
    assert_eq!(upload(&client, &info.id, &path, &payload).await, path);
    assert_content(&client, &info.id, &path, &payload).await;
    conflicts(&client, &info.id, &path).await;
    cancellation_and_race(&client, &info.id, &folder).await;
    assert!(call(
        &client,
        &info.id,
        json!({ "type": "deleteTree", "path": "/" })
    )
    .await
    .is_err());
    call(
        &client,
        &info.id,
        json!({ "type": "deleteTree", "path": folder }),
    )
    .await
    .expect("recursive delete");
    assert!(
        call(&client, &info.id, json!({ "type": "list", "path": folder }))
            .await
            .is_err()
    );
    client
        .command(Command::Close { id: info.id })
        .await
        .expect("close");
}
