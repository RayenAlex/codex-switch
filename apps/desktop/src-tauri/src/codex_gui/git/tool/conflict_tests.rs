use super::super::{output, run};
use super::{conflicts, integration, tests::Repo, GitError};
use std::fs;

fn conflicting_repo() -> Repo {
    let repo = Repo::new(true);
    repo.git(&["switch", "-c", "incoming"]);
    repo.write("one.txt", "incoming\n");
    repo.git(&["commit", "-am", "incoming"]);
    repo.git(&["switch", "main"]);
    repo.write("one.txt", "current\n");
    repo.git(&["commit", "-am", "current"]);
    assert!(!run(&repo.0, &["merge", "incoming"])
        .unwrap()
        .status
        .success());
    repo
}

fn resolve(repo: &Repo, content: Option<&str>) {
    let snapshot = conflicts::read(&repo.0, "one.txt").unwrap();
    conflicts::resolve(
        &repo.0,
        conflicts::Resolution {
            path: snapshot.path,
            version: snapshot.version,
            content: content.map(str::to_owned),
        },
    )
    .unwrap();
}

#[test]
fn resolves_stages_and_finishes_merge_without_staging_unrelated_work() {
    let repo = conflicting_repo();
    repo.write("two.txt", "unrelated\n");
    let snapshot = conflicts::read(&repo.0, "one.txt").unwrap();
    assert_eq!(snapshot.base.as_deref(), Some("one\n"));
    assert_eq!(snapshot.ours.as_deref(), Some("current\n"));
    assert_eq!(snapshot.theirs.as_deref(), Some("incoming\n"));
    resolve(&repo, Some("current and incoming\n"));
    assert!(output(&repo.0, &["ls-files", "-u"]).unwrap().is_empty());
    let state = integration::read(&repo.0).unwrap().unwrap();
    integration::resume(&repo.0, &state.version).unwrap();
    assert!(integration::read(&repo.0).unwrap().is_none());
    assert_eq!(output(&repo.0, &["show", "HEAD:two.txt"]).unwrap(), "two");
    assert_eq!(
        output(&repo.0, &["show", "HEAD:one.txt"]).unwrap(),
        "current and incoming"
    );
    assert_eq!(
        output(&repo.0, &["rev-list", "--parents", "-n", "1", "HEAD"])
            .unwrap()
            .split_whitespace()
            .count(),
        3
    );
}

#[test]
fn rejects_stale_content_markers_paths_and_unresolved_continuation() {
    let repo = conflicting_repo();
    let snapshot = conflicts::read(&repo.0, "one.txt").unwrap();
    let request = |version: String, content: &str| conflicts::Resolution {
        path: "one.txt".into(),
        version,
        content: Some(content.into()),
    };
    assert!(matches!(
        conflicts::resolve(
            &repo.0,
            request(
                snapshot.version.clone(),
                snapshot.result.as_deref().unwrap()
            )
        ),
        Err(GitError::ConflictMarkers)
    ));
    let state = integration::read(&repo.0).unwrap().unwrap();
    assert!(matches!(
        integration::resume(&repo.0, &state.version),
        Err(GitError::ConflictMarkers)
    ));
    repo.write("one.txt", "external edit\n");
    assert!(matches!(
        conflicts::resolve(&repo.0, request(snapshot.version, "overwrite\n")),
        Err(GitError::ConflictChanged)
    ));
    assert_eq!(
        fs::read_to_string(repo.0.join("one.txt")).unwrap(),
        "external edit\n"
    );
    for path in ["../one.txt", ".git/config", "a/../../one.txt", ":(glob)*"] {
        assert!(conflicts::read(&repo.0, path).is_err());
    }
}

#[test]
fn handles_modify_delete_and_add_add_conflicts() {
    for added in [false, true] {
        let repo = Repo::new(true);
        if added {
            repo.git(&["rm", "one.txt"]);
            repo.git(&["commit", "-m", "remove"]);
        }
        repo.git(&["switch", "-c", "incoming"]);
        if added {
            repo.write("one.txt", "incoming\n");
            repo.git(&["add", "one.txt"]);
        } else {
            repo.git(&["rm", "one.txt"]);
        }
        repo.git(&["commit", "-m", "incoming"]);
        repo.git(&["switch", "main"]);
        repo.write("one.txt", "current\n");
        repo.git(&["add", "one.txt"]);
        repo.git(&["commit", "-m", "current"]);
        assert!(!run(&repo.0, &["merge", "incoming"])
            .unwrap()
            .status
            .success());
        let snapshot = conflicts::read(&repo.0, "one.txt").unwrap();
        assert_eq!(snapshot.base.is_none(), added);
        assert_eq!(snapshot.theirs.is_none(), !added);
        resolve(&repo, if added { Some("both\n") } else { None });
        assert_eq!(repo.0.join("one.txt").exists(), added);
        let state = integration::read(&repo.0).unwrap().unwrap();
        integration::resume(&repo.0, &state.version).unwrap();
    }
}

#[test]
fn resumes_rebase_and_rejects_stale_integration() {
    let repo = conflicting_repo();
    repo.git(&["merge", "--abort"]);
    assert!(!run(&repo.0, &["rebase", "incoming"])
        .unwrap()
        .status
        .success());
    let old = integration::read(&repo.0).unwrap().unwrap();
    assert!(matches!(old.kind, integration::Kind::Rebase));
    resolve(&repo, Some("rebased result\n"));
    assert!(matches!(
        integration::resume(&repo.0, &old.version),
        Err(GitError::ConflictChanged)
    ));
    let next = integration::read(&repo.0).unwrap().unwrap();
    integration::resume(&repo.0, &next.version).unwrap();
    assert!(integration::read(&repo.0).unwrap().is_none());
}

#[test]
fn refuses_binary_and_index_locks_without_modifying_worktree() {
    let repo = conflicting_repo();
    repo.write("one.txt", "binary\0data");
    assert!(matches!(
        conflicts::read(&repo.0, "one.txt"),
        Err(GitError::ConflictUnsupported)
    ));
    repo.write("one.txt", "manual result\r\n");
    let snapshot = conflicts::read(&repo.0, "one.txt").unwrap();
    fs::write(repo.0.join(".git/index.lock"), "locked").unwrap();
    assert!(matches!(
        conflicts::resolve(
            &repo.0,
            conflicts::Resolution {
                path: snapshot.path,
                version: snapshot.version,
                content: Some("other".into()),
            }
        ),
        Err(GitError::Locked)
    ));
    assert_eq!(
        fs::read_to_string(repo.0.join("one.txt")).unwrap(),
        "manual result\r\n"
    );
}

#[test]
fn missing_content_is_not_an_implicit_deletion() {
    let request = serde_json::json!({ "path": "one.txt", "version": "v1" });
    assert!(serde_json::from_value::<conflicts::Resolution>(request).is_err());
}

#[test]
fn failed_staging_restores_worktree_and_keeps_conflict_stages() {
    let repo = conflicting_repo();
    fs::write(
        repo.0.join(".git/info/attributes"),
        "one.txt filter=reject\n",
    )
    .unwrap();
    repo.git(&["config", "filter.reject.clean", "false"]);
    repo.git(&["config", "filter.reject.required", "true"]);
    let snapshot = conflicts::read(&repo.0, "one.txt").unwrap();
    let index = fs::read(repo.0.join(".git/index")).unwrap();
    assert!(conflicts::resolve(
        &repo.0,
        conflicts::Resolution {
            path: snapshot.path,
            version: snapshot.version,
            content: Some("merged\n".into()),
        }
    )
    .is_err());
    assert_eq!(fs::read(repo.0.join(".git/index")).unwrap(), index);
    assert_eq!(
        fs::read_to_string(repo.0.join("one.txt")).unwrap(),
        snapshot.result.unwrap()
    );
}

#[test]
fn snapshots_are_bound_to_a_linked_worktree_and_preserve_crlf() {
    let repo = conflicting_repo();
    repo.git(&["merge", "--abort"]);
    let linked = Repo::new(false);
    // Use a separate empty directory within the fixture; Git owns its linked-worktree metadata.
    let target = linked.0.join("linked");
    let destination = crate::codex_gui::platform::execution_path(&target);
    repo.git(&["worktree", "add", "-b", "linked", &destination, "main"]);
    assert!(!run(&target, &["merge", "incoming"])
        .unwrap()
        .status
        .success());
    let snapshot = conflicts::read(&target, "one.txt").unwrap();
    conflicts::resolve(
        &target,
        conflicts::Resolution {
            path: snapshot.path,
            version: snapshot.version,
            content: Some("merged\r\n".into()),
        },
    )
    .unwrap();
    assert_eq!(fs::read(target.join("one.txt")).unwrap(), b"merged\r\n");
    assert_eq!(
        fs::read_to_string(repo.0.join("one.txt")).unwrap(),
        "current\n"
    );
    let state = integration::read(&target).unwrap().unwrap();
    integration::resume(&target, &state.version).unwrap();
    assert!(integration::read(&repo.0).unwrap().is_none());
}
