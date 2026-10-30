use super::*;

#[test]
fn reads_bounded_chunks_from_open_handles_and_releases_sources() {
    let root = tempfile::tempdir().unwrap();
    let path = root.path().join("文档.bin");
    std::fs::write(&path, b"first-second").unwrap();
    let state = SshDropState::default();
    let Reply::Files { files } = state.perform(Request::Open { paths: vec![path] }).unwrap() else {
        panic!("expected files");
    };
    assert_eq!(files[0].name, "文档.bin");
    assert_eq!(files[0].size, 12);
    let token = files[0].token.clone();
    let read = |offset, length| {
        state.perform(Request::Read {
            token: token.clone(),
            offset,
            length,
        })
    };
    let Reply::Data { data } = read(6, 6).unwrap() else {
        panic!("expected bytes");
    };
    assert_eq!(STANDARD.decode(data).unwrap(), b"second");
    assert!(read(12, 1).is_err());
    assert!(read(u64::MAX, 1).is_err());
    assert!(read(0, CHUNK_BYTES + 1).is_err());
    assert!(state
        .perform(Request::Read {
            token: "forged".into(),
            offset: 0,
            length: 1
        })
        .is_err());
    state
        .perform(Request::Close {
            tokens: vec![token.clone()],
        })
        .unwrap();
    assert!(read(0, 1).is_err());
}

#[test]
fn rejects_folders_relative_paths_and_partial_batches() {
    let root = tempfile::tempdir().unwrap();
    assert!(matches!(
        open_file(root.path().into()),
        Err(DropError::Folder)
    ));
    assert!(open_file("relative.txt".into()).is_err());
    let path = root.path().join("valid.txt");
    std::fs::write(&path, b"valid").unwrap();
    let state = SshDropState::default();
    assert!(state
        .perform(Request::Open {
            paths: vec![path, root.path().join("missing")]
        })
        .is_err());
    assert!(state.0.lock().unwrap().is_empty());
}

#[test]
fn stale_handles_cannot_be_read() {
    let root = tempfile::tempdir().unwrap();
    let path = root.path().join("empty");
    std::fs::write(&path, []).unwrap();
    let (info, mut source) = open_file(path).unwrap();
    source.touched = Instant::now() - IDLE_LIFETIME - Duration::from_secs(1);
    let state = SshDropState::default();
    state.0.lock().unwrap().insert(info.token.clone(), source);
    assert!(state
        .perform(Request::Read {
            token: info.token,
            offset: 0,
            length: 0
        })
        .is_err());
    assert!(state.0.lock().unwrap().is_empty());
}
