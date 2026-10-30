#[path = "../../../../src-tauri/src/gui_terminal/ssh.rs"]
pub(crate) mod ssh;
#[path = "../../../../src-tauri/src/gui_terminal/ssh_drop.rs"]
pub(crate) mod ssh_drop;

fn authorize(window: &tauri::Window) -> Result<(), &'static str> {
    if window.label() == "main" {
        Ok(())
    } else {
        Err("client.ssh.invalid")
    }
}
