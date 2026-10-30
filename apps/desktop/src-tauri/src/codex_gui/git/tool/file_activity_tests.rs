use super::{
    changes, execute, file_actions::Action, file_activity, tests::Repo, Request, SelectedFile,
};
use crate::codex_gui::workspace_activity::{WorkspaceActivity, WorkspaceKey, WorkspaceRequest};
use serde_json::json;

fn request(repo: &Repo, path: &str) -> Request {
    let state = changes::read(&repo.0).unwrap();
    let file = state.files.iter().find(|file| file.path == path).unwrap();
    Request::FileAction {
        cwd: repo.0.to_string_lossy().into_owned(),
        head: state.head,
        action: Action::Rollback,
        files: vec![SelectedFile {
            path: file.path.clone(),
            version: file.version.clone(),
        }],
    }
}

fn task(activity: &WorkspaceActivity, repo: &Repo, path: &str) {
    tauri::async_runtime::block_on(async {
        let key = WorkspaceKey::resolve(&repo.0.to_string_lossy()).unwrap();
        activity
            .begin(
                "host",
                WorkspaceRequest {
                    id: 1,
                    method: "turn/start",
                    params: &json!({"threadId": "writer", "cwd": repo.0}),
                },
                Some(key),
            )
            .await
            .unwrap();
        activity
            .response(
                "host",
                1,
                Some(&json!({"thread": {"id": "writer", "name": "Fix login"},
            "turn": {"id": "turn", "status": "inProgress"}})),
            )
            .await;
        activity
            .event(
                "host",
                "item/started",
                &json!({"threadId": "writer", "turnId": "turn",
            "item": {"type": "fileChange", "changes": [{"path": path}]}}),
            )
            .await;
    });
}

#[test]
fn real_rollback_allows_unrelated_files_and_refuses_the_tasks_file_without_writing_it() {
    let repo = Repo::new(true);
    let activity = WorkspaceActivity::default();
    repo.write("one.txt", "task edit\n");
    repo.write("two.txt", "user edit\n");
    task(&activity, &repo, "one.txt");
    let independent = request(&repo, "two.txt");
    let guard = file_activity::reserve(&independent, &activity).unwrap();
    execute(independent).unwrap();
    drop(guard);
    assert_eq!(
        std::fs::read_to_string(repo.0.join("two.txt")).unwrap(),
        "two\n"
    );
    let error = file_activity::reserve(&request(&repo, "one.txt"), &activity)
        .err()
        .unwrap()
        .to_string();
    assert!(error.contains("Fix login") && error.contains("one.txt"));
    assert_eq!(
        std::fs::read_to_string(repo.0.join("one.txt")).unwrap(),
        "task edit\n"
    );
}

#[test]
fn rollback_checks_the_rename_source_and_revalidates_file_versions_after_admission() {
    let repo = Repo::new(true);
    let activity = WorkspaceActivity::default();
    repo.git(&["mv", "one.txt", "renamed.txt"]);
    task(&activity, &repo, "one.txt");
    let error = file_activity::reserve(&request(&repo, "renamed.txt"), &activity)
        .err()
        .unwrap()
        .to_string();
    assert!(error.contains("one.txt"));
    assert!(repo.0.join("renamed.txt").exists() && !repo.0.join("one.txt").exists());
    repo.write("two.txt", "before admission\n");
    let selection = request(&repo, "two.txt");
    let _guard = file_activity::reserve(&selection, &activity).unwrap();
    repo.write("two.txt", "concurrent external edit\n");
    assert!(execute(selection).is_err());
    assert_eq!(
        std::fs::read_to_string(repo.0.join("two.txt")).unwrap(),
        "concurrent external edit\n"
    );
}
