//! Real SFTP regressions for saving code and private files without changing their metadata or links.
use base64::{engine::general_purpose::STANDARD, Engine};
use csw_ssh_client::*;
use russh::{client, keys::PublicKeyOrCertificate};
use russh_sftp::{client::SftpSession, protocol::FileAttributes};
use serde_json::{json, Value};
use std::sync::Arc;
use tokio::io::AsyncWriteExt;

struct PinnedHost(String);
impl client::Handler for PinnedHost {
    type Error = russh::Error;
    async fn check_server_key(
        &mut self,
        key: &PublicKeyOrCertificate,
    ) -> std::result::Result<bool, Self::Error> {
        Ok(key
            .public_key()
            .fingerprint(russh::keys::HashAlg::Sha256)
            .to_string()
            == self.0)
    }
}

struct Fixture {
    client: Arc<Client>,
    info: Info,
    session: client::Handle<PinnedHost>,
    sftp: SftpSession,
    folder: String,
}

async fn connect_sftp(
    config: &Value,
    fingerprint: String,
) -> (client::Handle<PinnedHost>, SftpSession) {
    let mut session = client::connect(
        Arc::new(client::Config::default()),
        (
            config["host"].as_str().unwrap(),
            config["port"].as_u64().unwrap() as u16,
        ),
        PinnedHost(fingerprint),
    )
    .await
    .unwrap();
    assert!(session
        .authenticate_password(
            config["username"].as_str().unwrap(),
            config["password"].as_str().unwrap()
        )
        .await
        .unwrap()
        .success());
    let channel = session.channel_open_session().await.unwrap();
    channel.request_subsystem(true, "sftp").await.unwrap();
    let sftp = SftpSession::new(channel.into_stream()).await.unwrap();
    (session, sftp)
}

impl Fixture {
    async fn connect() -> Self {
        let config: Value = serde_json::from_slice(
            &std::fs::read(std::env::var("SSH_TEST_CONFIG").expect("fixture config path"))
                .expect("fixture config"),
        )
        .expect("fixture JSON");
        let endpoint = json!({ "host": config["host"], "port": config["port"] });
        let fingerprint = probe(serde_json::from_value(endpoint.clone()).unwrap())
            .await
            .unwrap();
        let (session, sftp) = connect_sftp(&config, fingerprint.clone()).await;
        let client = Arc::new(Client::default());
        let request =
            serde_json::from_value(json!({ "endpoint": endpoint, "fingerprint": fingerprint,
            "username": config["username"], "password": config["password"],
            "size": { "cols": 80, "rows": 24 } }))
            .unwrap();
        let info = client.open(request, Arc::new(|_| true)).await.unwrap();
        let folder = format!(
            "{}/edit-{}",
            config["root"].as_str().unwrap_or("/").trim_end_matches('/'),
            uuid::Uuid::new_v4()
        );
        sftp.create_dir(&folder).await.unwrap();
        Self {
            client,
            info,
            session,
            sftp,
            folder,
        }
    }

    async fn call(&self, request: Value) -> Result<FileReply> {
        self.client
            .files(&self.info.id, serde_json::from_value(request).unwrap())
            .await
    }

    async fn create(&self, name: &str, mode: u32) -> String {
        let path = format!("{}/{name}", self.folder);
        let mut file = self.sftp.create(&path).await.unwrap();
        file.write_all(b"original").await.unwrap();
        file.shutdown().await.unwrap();
        self.sftp
            .set_metadata(
                &path,
                FileAttributes {
                    size: None,
                    permissions: Some(mode),
                    uid: None,
                    gid: None,
                    user: None,
                    group: None,
                    atime: None,
                    mtime: None,
                },
            )
            .await
            .unwrap();
        path
    }

    async fn overwrite(&self, path: &str, expected_mode: u32) {
        let FileReply::Upload { token } = self
            .call(json!({ "type": "uploadStart", "path": path,
            "size": 7, "mode": "overwrite" }))
            .await
            .unwrap()
        else {
            panic!("upload expected")
        };
        let target = self.sftp.canonicalize(path).await.unwrap();
        let parent = target.rsplit_once('/').unwrap().0;
        let temporary = format!("{parent}/.remoteai-upload-{token}");
        assert_eq!(
            self.sftp
                .metadata(&temporary)
                .await
                .unwrap()
                .permissions
                .unwrap()
                & 0o7777,
            expected_mode,
            "private permissions apply before uploading file contents"
        );
        self.call(json!({ "type": "uploadChunk", "token": token, "offset": 0,
            "data": STANDARD.encode(b"updated") }))
            .await
            .unwrap();
        self.call(json!({ "type": "uploadFinish", "token": token }))
            .await
            .unwrap();
        let metadata = self.sftp.metadata(path).await.unwrap();
        assert_eq!(metadata.permissions.unwrap() & 0o7777, expected_mode);
        let FileReply::File { data } = self
            .call(json!({ "type": "read", "path": path }))
            .await
            .unwrap()
        else {
            panic!("file expected")
        };
        assert_eq!(STANDARD.decode(data).unwrap(), b"updated");
    }

    async fn stop(self) {
        self.call(json!({ "type": "deleteTree", "path": self.folder }))
            .await
            .unwrap();
        self.sftp.close().await.unwrap();
        self.session
            .disconnect(russh::Disconnect::ByApplication, "", "")
            .await
            .unwrap();
        self.client
            .command(Command::Close { id: self.info.id })
            .await
            .unwrap();
    }
}

async fn preserves_modes_and_links(f: &Fixture) {
    for (name, mode) in [("script.sh", 0o751), ("private.env", 0o600)] {
        let path = f.create(name, mode).await;
        let before = f.sftp.metadata(&path).await.unwrap();
        f.overwrite(&path, mode).await;
        let after = f.sftp.metadata(&path).await.unwrap();
        assert_eq!((after.uid, after.gid), (before.uid, before.gid));
    }
    f.sftp
        .create_dir(format!("{}/nested", f.folder))
        .await
        .unwrap();
    let target = f.create("nested/linked.sh", 0o700).await;
    let link = format!("{}/link.sh", f.folder);
    f.sftp.symlink(&link, "nested/linked.sh").await.unwrap();
    f.overwrite(&link, 0o700).await;
    assert!(f
        .sftp
        .symlink_metadata(&link)
        .await
        .unwrap()
        .file_type()
        .is_symlink());
    assert_eq!(f.sftp.canonicalize(&link).await.unwrap(), target);
}

async fn rejects_unsupported_targets(f: &Fixture) {
    let broken = format!("{}/broken", f.folder);
    f.sftp.symlink(&broken, "missing").await.unwrap();
    for path in [&f.folder, &broken] {
        assert!(f
            .call(json!({ "type": "uploadStart", "path": path,
            "size": 0, "mode": "overwrite" }))
            .await
            .is_err());
    }
    assert!(f
        .sftp
        .symlink_metadata(&broken)
        .await
        .unwrap()
        .file_type()
        .is_symlink());
    let path = f.create("raced.txt", 0o600).await;
    let FileReply::Upload { token } = f
        .call(json!({ "type": "uploadStart", "path": path,
        "size": 0, "mode": "overwrite" }))
        .await
        .unwrap()
    else {
        panic!("upload expected")
    };
    f.sftp.remove_file(&path).await.unwrap();
    f.sftp.symlink(&path, "private.env").await.unwrap();
    assert!(f
        .call(json!({ "type": "uploadFinish", "token": token }))
        .await
        .is_err());
    f.call(json!({ "type": "uploadCancel", "token": token }))
        .await
        .unwrap();
    assert!(f
        .sftp
        .symlink_metadata(&path)
        .await
        .unwrap()
        .file_type()
        .is_symlink());
}

#[tokio::test]
#[ignore = "requires disposable SSH_TEST_CONFIG fixture"]
async fn editor_overwrites_preserve_permissions_and_symlinks() {
    let fixture = Fixture::connect().await;
    preserves_modes_and_links(&fixture).await;
    rejects_unsupported_targets(&fixture).await;
    fixture.stop().await;
}
