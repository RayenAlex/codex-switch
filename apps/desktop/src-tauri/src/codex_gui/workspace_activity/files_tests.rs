use super::*;
use serde_json::json;

fn root(name: &str) -> WorkspaceKey {
    WorkspaceKey(comparable_path(
        &std::env::temp_dir().join(name).to_string_lossy(),
    ))
}

async fn start(activity: &WorkspaceActivity, key: &WorkspaceKey, id: &str) {
    activity
        .begin(
            "host",
            WorkspaceRequest {
                id: 1,
                method: "turn/start",
                params: &json!({"threadId": id, "cwd": key.0}),
            },
            Some(key.clone()),
        )
        .await
        .unwrap();
    activity
        .response(
            "host",
            1,
            Some(&json!({"thread": {"id": id, "name": format!("Task {id}")},
        "turn": {"id": format!("{id}-turn"), "status": "inProgress"}})),
        )
        .await;
}

async fn edit(activity: &WorkspaceActivity, id: &str, path: &str) {
    activity
        .event(
            "host",
            "item/started",
            &json!({"threadId": id, "turnId": format!("{id}-turn"),
        "item": {"type": "fileChange", "changes": [{"path": path, "kind": {"type": "update"}}]}}),
        )
        .await;
}

async fn complete(activity: &WorkspaceActivity, id: &str) {
    activity
        .event(
            "host",
            "turn/completed",
            &json!({"threadId": id,
        "turn": {"id": format!("{id}-turn"), "status": "completed"}}),
        )
        .await;
}

async fn conflict(activity: &WorkspaceActivity, key: &WorkspaceKey, paths: &[&str]) -> Value {
    let paths = paths
        .iter()
        .map(|path| (*path).to_owned())
        .collect::<Vec<_>>();
    let error = activity
        .change_files(key.clone(), &paths)
        .await
        .err()
        .unwrap();
    serde_json::from_str(&error.to_string()).unwrap()
}

#[tokio::test]
async fn unrelated_running_tasks_do_not_block_files_but_still_protect_branches() {
    let activity = WorkspaceActivity::default();
    let key = root("file-admission");
    start(&activity, &key, "build").await;
    edit(&activity, "build", "src/app.ts").await;
    assert!(activity
        .change_files(key.clone(), &["nx.json".into()])
        .await
        .is_ok());
    let error = activity
        .change(key.clone())
        .await
        .err()
        .unwrap()
        .to_string();
    assert!(error.contains("Task build"));
    let error = conflict(&activity, &key, &["nx.json", "src/app.ts"]).await;
    assert_eq!(error["code"], "client.gitActivity.filesBusy");
    assert_eq!(
        error["params"]["details"],
        "Task build (build) → src/app.ts"
    );
    complete(&activity, "build").await;
    assert!(activity
        .change_files(key, &["src/app.ts".into()])
        .await
        .is_ok());
}

#[tokio::test]
async fn file_reservations_release_on_drop_and_block_branch_changes_during_mutation() {
    let activity = WorkspaceActivity::default();
    let key = root("file-admission");
    let guard = activity
        .change_files(key.clone(), &["nx.json".into()])
        .await
        .unwrap();
    assert!(activity.change(key.clone()).await.is_err());
    assert!(activity
        .begin(
            "host",
            WorkspaceRequest {
                id: 1,
                method: "turn/start",
                params: &json!({"threadId": "new"})
            },
            Some(key.clone())
        )
        .await
        .is_err());
    drop(guard);
    assert!(activity.change(key).await.is_ok());
}

#[tokio::test]
async fn renames_protect_both_paths_and_completed_items_stay_owned_until_turn_completion() {
    let activity = WorkspaceActivity::default();
    let key = root("file-renames");
    start(&activity, &key, "rename").await;
    activity
        .event(
            "host",
            "item/completed",
            &json!({"threadId": "rename", "turnId": "rename-turn",
        "item": {"type": "fileChange", "status": "completed", "changes": [{"path": "old.ts",
            "kind": {"type": "update", "movePath": "new.ts"}}]}}),
        )
        .await;
    let error = conflict(&activity, &key, &["old.ts", "new.ts"])
        .await
        .to_string();
    assert!(error.contains("old.ts") && error.contains("new.ts"));
    complete(&activity, "rename").await;
    assert!(activity
        .change_files(key, &["old.ts".into(), "new.ts".into()])
        .await
        .is_ok());
}

#[tokio::test]
async fn independent_worktrees_and_subdirectory_paths_are_matched_by_full_path() {
    let activity = WorkspaceActivity::default();
    let key = root("file-subdirs");
    let other = root("file-other-worktree");
    start(&activity, &other, "other").await;
    edit(&activity, "other", "nx.json").await;
    assert!(activity
        .change_files(key.clone(), &["nx.json".into()])
        .await
        .is_ok());
    start(&activity, &key, "nested").await;
    activity
        .0
        .lock()
        .await
        .sessions
        .get_mut("host")
        .unwrap()
        .threads
        .get_mut("nested")
        .unwrap()
        .cwd = Some(format!("{}/src", key.0));
    edit(&activity, "nested", "./components/../app.ts").await;
    assert!(activity
        .change_files(key.clone(), &["app.ts".into()])
        .await
        .is_ok());
    assert!(conflict(&activity, &key, &["src/app.ts"])
        .await
        .to_string()
        .contains("Task nested"));
    #[cfg(windows)]
    assert!(activity
        .change_files(key.clone(), &["SRC/APP.TS".into()])
        .await
        .is_err());
    // Absolute paths reported by a task also protect files outside its starting worktree.
    edit(&activity, "other", &format!("{}/outside.ts", key.0)).await;
    assert!(conflict(&activity, &key, &["outside.ts"])
        .await
        .to_string()
        .contains("Task other"));
}

#[tokio::test]
async fn all_conflicting_tasks_are_named_and_finishing_one_does_not_release_another() {
    let activity = WorkspaceActivity::default();
    let key = root("file-multiple");
    for id in ["one", "two"] {
        start(&activity, &key, id).await;
        edit(&activity, id, "shared.ts").await;
    }
    activity
        .event(
            "host",
            "thread/name/updated",
            &json!({"threadId": "two", "threadName": "发布任务"}),
        )
        .await;
    let error = conflict(&activity, &key, &["shared.ts"]).await.to_string();
    assert!(error.contains("Task one") && error.contains("发布任务"));
    complete(&activity, "one").await;
    let error = conflict(&activity, &key, &["shared.ts"]).await.to_string();
    assert!(!error.contains("Task one") && error.contains("发布任务"));
    activity.disconnect("host").await;
    assert!(activity
        .change_files(key, &["shared.ts".into()])
        .await
        .is_ok());
}

#[tokio::test]
async fn active_snapshots_recover_file_ownership_and_ignore_finished_turns() {
    let activity = WorkspaceActivity::default();
    let key = root("file-snapshot");
    activity
        .begin(
            "host",
            WorkspaceRequest {
                id: 1,
                method: "thread/resume",
                params: &json!({"threadId": "restored", "cwd": key.0}),
            },
            Some(key.clone()),
        )
        .await
        .unwrap();
    activity
        .response(
            "host",
            1,
            Some(
                &json!({"thread": {"id": "restored", "name": "Restored task",
        "turns": [{"id": "restored-turn", "status": "inProgress", "items": [{"type": "fileChange",
            "changes": [{"path": "active.ts"}]}]}, {"id": "old", "status": "completed",
            "items": [{"type": "fileChange", "changes": [{"path": "old.ts"}]}]}]}}),
            ),
        )
        .await;
    assert!(activity
        .change_files(key.clone(), &["old.ts".into()])
        .await
        .is_ok());
    assert!(conflict(&activity, &key, &["active.ts"])
        .await
        .to_string()
        .contains("Restored task"));
    activity
        .begin(
            "host",
            WorkspaceRequest {
                id: 2,
                method: "thread/read",
                params: &json!({"threadId": "restored"}),
            },
            None,
        )
        .await
        .unwrap();
    complete(&activity, "restored").await;
    activity
        .response(
            "host",
            2,
            Some(&json!({"thread": {"id": "restored", "turns": [
        {"id": "restored-turn", "status": "inProgress", "items": [{"type": "fileChange",
            "changes": [{"path": "active.ts"}]}]}]}})),
        )
        .await;
    assert!(activity
        .change_files(key, &["active.ts".into()])
        .await
        .is_ok());
}

#[tokio::test]
async fn active_goals_keep_only_their_files_between_turns() {
    let activity = WorkspaceActivity::default();
    let key = root("file-goals");
    start(&activity, &key, "goal").await;
    edit(&activity, "goal", "goal.ts").await;
    activity
        .event(
            "host",
            "thread/goal/updated",
            &json!({"threadId": "goal", "goal": {"status": "active"}}),
        )
        .await;
    complete(&activity, "goal").await;
    assert!(activity
        .change_files(key.clone(), &["other.ts".into()])
        .await
        .is_ok());
    assert!(conflict(&activity, &key, &["goal.ts"])
        .await
        .to_string()
        .contains("Task goal"));
    activity
        .event(
            "host",
            "thread/goal/updated",
            &json!({"threadId": "goal", "goal": {"status": "complete"}}),
        )
        .await;
    assert!(activity
        .change_files(key, &["goal.ts".into()])
        .await
        .is_ok());
}
