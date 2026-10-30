use super::{SCRIPT_ENV, WINDOWS_RUN};
use std::{os::windows::process::CommandExt, path::Path, process::Command};
use windows_sys::Win32::System::Threading::CREATE_NO_WINDOW;

fn install_fixture(directory: &Path, marker: &str) {
    let cli = directory.join("node_modules/npm/bin");
    std::fs::create_dir_all(&cli).expect("npm fixture directory");
    std::fs::write(directory.join("npm.cmd"), "@exit /b 99").expect("npm launcher fixture");
    std::fs::write(
        cli.join("npm-cli.js"),
        format!("console.log(JSON.stringify({{marker:'{marker}',args:process.argv.slice(2)}}));"),
    )
    .expect("npm CLI fixture");
}

fn node_executable() -> std::path::PathBuf {
    std::env::split_paths(&std::env::var_os("PATH").expect("PATH"))
        .map(|directory| directory.join("node.exe"))
        .find(|path| path.is_file())
        .expect("Node.js is installed for terminal tests")
}

fn run_fixture(root: &Path, directories: &[std::path::PathBuf]) {
    let system = std::env::var_os("SystemRoot").expect("Windows system directory");
    let shell = Path::new(&system).join("System32/WindowsPowerShell/v1.0/powershell.exe");
    let name = "dev:&'\"$(echo injected)%PATH%";
    let output = Command::new(shell)
        .args(["-NoProfile", "-NonInteractive", "-Command", WINDOWS_RUN])
        .current_dir(root)
        .env(
            "PATH",
            std::env::join_paths(directories).expect("fixture PATH"),
        )
        .env(SCRIPT_ENV, name)
        .creation_flags(CREATE_NO_WINDOW)
        .output()
        .expect("run npm fixture");
    assert!(
        output.status.success(),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
    let result: serde_json::Value = serde_json::from_slice(&output.stdout).expect("npm output");
    assert_eq!(result["marker"], "first");
    assert_eq!(result["args"], serde_json::json!(["run", "--", name]));
}

#[test]
fn multiple_installations_select_one_npm_and_one_node() {
    let root = tempfile::tempdir().expect("fixture directory");
    let first = root.path().join("first npm");
    let second = root.path().join("second npm");
    install_fixture(&first, "first");
    install_fixture(&second, "second");
    // Exercise both the adjacent node.exe and the fallback lookup with multiple real executables.
    let first_node = first.join("node.exe");
    std::fs::copy(node_executable(), &first_node).expect("first Node.js fixture");
    std::fs::hard_link(&first_node, second.join("node.exe")).expect("second Node.js fixture");
    let third = root.path().join("third node");
    std::fs::create_dir(&third).expect("third fixture directory");
    std::fs::hard_link(&first_node, third.join("node.exe")).expect("third Node.js fixture");
    let directories = [first, second, third];
    run_fixture(root.path(), &directories);
    std::fs::remove_file(first_node).expect("remove adjacent Node.js fixture");
    run_fixture(root.path(), &directories);
}
