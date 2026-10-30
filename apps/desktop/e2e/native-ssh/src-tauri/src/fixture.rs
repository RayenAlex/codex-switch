use serde::{Deserialize, Serialize};
use std::{io::Read, path::PathBuf};

const MAX_CONFIG_BYTES: u64 = 1024 * 1024;

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct FixtureConfig {
    name: String,
    host: String,
    port: u16,
    username: String,
    #[serde(default)]
    password: Option<String>,
    #[serde(default)]
    private_key: Option<String>,
    #[serde(default)]
    passphrase: Option<String>,
    #[serde(default)]
    x11: Option<csw_ssh_client::X11>,
    project_cwd: String,
}

pub(crate) fn load() -> Result<FixtureConfig, &'static str> {
    let path = std::env::args()
        .find_map(|arg| arg.strip_prefix("--config=").map(PathBuf::from))
        .filter(|path| path.is_absolute())
        .ok_or("Pass --config=<absolute fixture JSON path>")?;
    let file = std::fs::File::open(path).map_err(|_| "Cannot open fixture config")?;
    let mut bytes = Vec::new();
    file.take(MAX_CONFIG_BYTES + 1)
        .read_to_end(&mut bytes)
        .map_err(|_| "Cannot read fixture config")?;
    if bytes.len() as u64 > MAX_CONFIG_BYTES {
        return Err("Fixture config too large");
    }
    serde_json::from_slice(&bytes).map_err(|_| "Invalid fixture config")
}

#[tauri::command]
pub(crate) fn fixture_config(config: tauri::State<'_, FixtureConfig>) -> FixtureConfig {
    config.inner().clone()
}
