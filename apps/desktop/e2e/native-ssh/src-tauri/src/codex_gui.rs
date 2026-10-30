// Only the native drop grant is registered. Legacy chat/clipboard exports are not used by SSH.
#[allow(dead_code)]
#[path = "../../../../src-tauri/src/codex_gui/dropped_files.rs"]
pub(crate) mod dropped_files;

mod clipboard {
    #[derive(serde::Serialize)]
    pub(crate) struct ClipboardFile;

    // A compile-only dependency of unregistered legacy commands; never grants filesystem access.
    pub(super) fn file_reference(_: std::path::PathBuf) -> Result<ClipboardFile, &'static str> {
        Err("Clipboard exports are outside this fixture")
    }
}
