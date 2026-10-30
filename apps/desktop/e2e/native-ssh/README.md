# Native SSH integration runner

This isolated Tauri window embeds the production `TerminalPanel`, local and remote
session controllers, SSH adapters, session reader, SFTP browser and native drag adapter. Rust imports the production
SSH IPC, native drop grant recorder and bounded source reader directly. Connections,
file transfers, X11 channels and OS drag events are real. Only account profile
persistence is replaced by a memory store; this runner never starts the account,
desktop service, updater or plugin bridges of the regular application.

The independent identifier is `dev.remoteai.native-ssh-test`. It does not replace
or launch the installed Remote AI application. The unregistered clipboard export
shim only satisfies an unused dependency of the grant recorder; it cannot grant
file access and is not part of the SSH drop path.

## Build

From the repository root in PowerShell:

```powershell
npx tsc --noEmit -p apps/desktop/e2e/native-ssh/tsconfig.json
npx vite build --config apps/desktop/e2e/native-ssh/vite.config.ts
$env:CARGO_TARGET_DIR = "$PWD/apps/desktop/src-tauri/target"
cargo build --locked --manifest-path apps/desktop/e2e/native-ssh/src-tauri/Cargo.toml
```

Using the existing Cargo target shares compiled dependencies without replacing
`csw.exe`. The new executable is `remoteai-native-ssh.exe` in that target's `debug`
directory. Frontend assets are embedded from `.codex-tmp/ssh-native-live/frontend`.

## Run against a disposable SSH server

Write an ignored JSON file, for example `.codex-tmp/ssh-native-live/runner-config.json`:

```json
{
  "name": "WSL native integration",
  "host": "127.0.0.1",
  "port": 22024,
  "username": "your-test-user",
  "privateKey": "temporary private key text",
  "x11": { "display": "127.0.0.1:0" },
  "projectCwd": "/tmp/remoteai-live-ssh/files"
}
```

Use `password` instead of `privateKey` for a password fixture. Optional `passphrase`
is supported. Omit `x11` to test without forwarding. Launch the native executable
with `--config=<absolute JSON path>`. The file is read once and credentials remain
in memory; no cloud account or saved application credentials are used.

Use the production terminal connection menu to select the preset, verify its SSH
fingerprint and connect. In both `local` and `remote` modes:

1. Drag real files from Explorer into the terminal and file browser. Include an
   empty file, a Unicode filename and a file larger than one upload chunk.
2. Verify file bytes on the SSH host and exercise overwrite/rename/cancel.
3. Change the shell directory and browse directories while a partially typed
   command is present. Confirm queued navigation does not alter that command.
4. Start an X11 application from the SSH shell, inspect its actual window, and
   close the SSH terminal to verify the forwarded application disconnects.

The `remote` mode uses the production remote request/polling adapters around the
native host dispatcher. It is not a test of a live internet relay. Quit the runner,
stop the disposable SSH server and remove its temporary credentials afterward.

## Physical verification — 2026-10-25

Verified on Windows against a temporary OpenSSH server in local Ubuntu WSL 2,
using the isolated native runner with packaged frontend assets and the production
SSH, terminal, SFTP and OS drop modules. The remote-mode checks used the production
remote adapter and session controller; no live internet relay was involved.

- Real Explorer drags in local mode uploaded a Unicode-named 44-byte file to the
  terminal, then a 6,291,475-byte file and an empty file to the file browser in a
  Unicode directory. Every received file matched its Windows source SHA256.
- A real Explorer drag in remote mode uploaded the 44-byte file to the expected
  directory with a matching SHA256. Cancelling a name conflict left file hashes
  unchanged.
- Browsing a folder changed the shell directory. Typing
  `cd /tmp/remoteai-live-ssh/files` in the native terminal updated the open file
  browser to that exact path.
- Starting `xmessage` in the native remote terminal reported
  `DISPLAY=localhost:10.0` and opened the Windows XWin window
  `Remote AI Native X11`. Clicking the actual terminal-tab close control removed
  the X11 window immediately, confirmed by an independent window enumeration.
- The full SHA256 host fingerprint wrapped inside its compact trust dialog.
  The matching local, remote, Web PC and phone-width browser regressions passed.

Screenshots and temporary test logs are retained under
`.codex-tmp/ssh-native-live`; credentials and build outputs must never be committed.
