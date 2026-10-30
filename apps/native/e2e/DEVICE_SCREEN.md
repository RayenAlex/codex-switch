# Device screen controls on Android

This fixture renders the production device list, menu and shared screen-command hook.
Its request adapter acknowledges commands locally; it does not change a real PC display.
The separate application ID preserves the installed app and account data.

With Java 17, Rust, the Android SDK and a physical phone configured:

```powershell
$env:PATH = "$env:USERPROFILE\.cargo\bin;$env:JAVA_HOME\bin;$env:ANDROID_HOME\platform-tools;$env:PATH"
$env:NODE_ENV = 'production'
$env:NODE_PATH = (Resolve-Path apps/native/node_modules).Path
$env:ANDROID_SERIAL = '<serial from adb devices -l>'
Push-Location apps/native/android
.\gradlew.bat assembleRelease -I ../e2e/device-screen.init.gradle -PreactNativeArchitectures=arm64-v8a
Pop-Location
node apps/native/e2e/device-screen-test.mjs
```

The runner checks cancellation, screen off, restoration and remaining in device management
at font scales 1.0 and 1.3. It restores the previous font scale and reopens the installed app.
Inspect `.codex-tmp/device-screen-android/*.png` for complete Chinese glyphs, wrapping and
accessible menu actions. These screenshots validate native layout, not PC monitor power.
