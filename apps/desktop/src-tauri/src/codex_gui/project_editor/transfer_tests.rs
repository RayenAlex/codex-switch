use super::*;

fn request(root: &Path, revision: &str, upload: serde_json::Value) -> Save {
    serde_json::from_value(serde_json::json!({
        "cwd": execution_path(root), "path": "large.txt", "revision": revision, "upload": upload,
    }))
    .unwrap()
}

#[test]
fn large_text_uses_chunked_reads_and_atomic_replacement() {
    let root = tempfile::tempdir().unwrap();
    let path = root.path().join("large.txt");
    let source = "原文\r\n".repeat(700_000);
    fs::write(&path, &source).unwrap();
    let before = snapshot(&path).unwrap();
    assert_eq!(before.kind, "text");
    assert!(before.chunked && !before.read_only && before.text.is_none());
    let range: transfer::ReadRange =
        serde_json::from_value(serde_json::json!({ "offset": 0, "length": 8 })).unwrap();
    let part = transfer::read_chunk(&path, &range).unwrap();
    assert_eq!(
        STANDARD
            .decode(part.data["data"].as_str().unwrap())
            .unwrap(),
        &source.as_bytes()[..8]
    );
    let replacement = "更新\r\n".repeat(700_001);
    let token = uuid::Uuid::new_v4().to_string();
    for (index, bytes) in replacement.as_bytes().chunks(INLINE_BYTES).enumerate() {
        let offset = index * INLINE_BYTES;
        let last = offset + bytes.len() == replacement.len();
        let chunk = serde_json::json!({ "token": token, "offset": offset, "size": replacement.len(),
            "data": STANDARD.encode(bytes), "finish": last });
        let result =
            transfer::write(request(root.path(), &before.revision, chunk.clone())).unwrap();
        if !last {
            // A retried fixed range is idempotent and cannot alter the source before finish.
            transfer::write(request(root.path(), &before.revision, chunk)).unwrap();
            assert_eq!(fs::metadata(&path).unwrap().len(), source.len() as u64);
        } else {
            assert_eq!(result.data["kind"], "text");
            assert_eq!(result.data["revision"], revision(replacement.as_bytes()));
        }
    }
    assert_eq!(fs::read_to_string(&path).unwrap(), replacement);
    assert_eq!(fs::read_dir(root.path()).unwrap().count(), 1);
}

#[test]
fn upload_conflicts_and_cancellation_keep_the_original_file() {
    let root = tempfile::tempdir().unwrap();
    let path = root.path().join("large.txt");
    fs::write(&path, "original").unwrap();
    let before = snapshot(&path).unwrap();
    let token = uuid::Uuid::new_v4().to_string();
    let first = serde_json::json!({ "token": token, "offset": 0, "size": 4, "data": STANDARD.encode(b"ab") });
    transfer::write(request(root.path(), &before.revision, first)).unwrap();
    fs::write(&path, "external").unwrap();
    let last = serde_json::json!({ "token": token, "offset": 2, "size": 4,
        "data": STANDARD.encode(b"cd"), "finish": true });
    assert!(matches!(
        transfer::write(request(root.path(), &before.revision, last)),
        Err(GuiError::ProjectFileConflict)
    ));
    assert_eq!(fs::read_to_string(&path).unwrap(), "external");
    assert_eq!(fs::read_dir(root.path()).unwrap().count(), 1);
    let before = snapshot(&path).unwrap();
    let first = serde_json::json!({ "token": token, "offset": 0, "size": 4, "data": STANDARD.encode(b"ab") });
    transfer::write(request(root.path(), &before.revision, first)).unwrap();
    let cancel =
        serde_json::json!({ "token": token, "offset": 0, "size": 4, "data": "", "cancel": true });
    transfer::write(request(root.path(), &before.revision, cancel)).unwrap();
    assert_eq!(fs::read_dir(root.path()).unwrap().count(), 1);
}

#[test]
fn malformed_ranges_and_tokens_cannot_write_or_escape_the_project() {
    let root = tempfile::tempdir().unwrap();
    let path = root.path().join("large.txt");
    fs::write(&path, "original").unwrap();
    let before = snapshot(&path).unwrap();
    for chunk in [
        serde_json::json!({ "token": "../escape", "offset": 0, "size": 4, "data": "YWJjZA==" }),
        serde_json::json!({ "token": uuid::Uuid::new_v4(), "offset": 4, "size": 4, "data": "YWJjZA==" }),
        serde_json::json!({ "token": uuid::Uuid::new_v4(), "offset": 0, "size": 4, "data": "invalid!" }),
    ] {
        assert!(transfer::write(request(root.path(), &before.revision, chunk)).is_err());
    }
    assert_eq!(fs::read_to_string(&path).unwrap(), "original");
    assert_eq!(fs::read_dir(root.path()).unwrap().count(), 1);
}
