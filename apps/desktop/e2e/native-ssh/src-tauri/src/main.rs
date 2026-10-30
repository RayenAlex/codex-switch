#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
// This manual runner imports production modules whose unit tests belong to the application crate.
// Exclude their test-only dependencies and the intentionally unavailable clipboard fixture shim.
#![cfg(not(test))]

mod codex_gui;
mod fixture;
mod gui_terminal;

fn main() {
    let config = match fixture::load() {
        Ok(config) => config,
        Err(error) => {
            eprintln!("{error}");
            std::process::exit(2);
        }
    };
    let app = tauri::Builder::default()
        .manage(config)
        .manage(std::sync::Arc::new(csw_ssh_client::Client::default()))
        .manage(codex_gui::dropped_files::DroppedFilesState::default())
        .manage(gui_terminal::ssh_drop::SshDropState::default())
        .invoke_handler(tauri::generate_handler![
            fixture::fixture_config,
            gui_terminal::ssh::codex_gui_ssh_probe,
            gui_terminal::ssh::codex_gui_ssh_ensure_x11,
            gui_terminal::ssh::codex_gui_ssh_open,
            gui_terminal::ssh::codex_gui_ssh_command,
            gui_terminal::ssh::codex_gui_ssh_files,
            gui_terminal::ssh_drop::codex_gui_ssh_drop_files,
        ])
        .build(tauri::generate_context!());
    let app = match app {
        Ok(app) => app,
        Err(error) => {
            eprintln!("Native fixture startup failed: {error}");
            std::process::exit(1);
        }
    };
    app.run(|app, event| codex_gui::dropped_files::handle_run_event(app, &event));
}
