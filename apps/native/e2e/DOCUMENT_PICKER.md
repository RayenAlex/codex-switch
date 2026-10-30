# Android document picker regression

`scripts/patch-document-picker.cjs` patches Expo Document Picker 13.1.6 at install and Expo startup/prebuild.
It serializes request ownership on Android's main queue, consumes each activity result once, handles cancellation
errors, clears failed launches, and moves document metadata reads and cache copies to `Dispatchers.IO`.
The worker belongs to the Expo context so a destroyed runtime receives no completion callback.
Review the patch when upgrading the dependency; rebuilding the APK is required.

Run the native lifecycle checks after an Android build has populated the Gradle compiler cache:

```powershell
node apps/native/scripts/test-document-picker.cjs
npm run test -w @codex-switch/native -- src/chat/useComposerAttachments.test.ts scripts/patch-document-picker.test.ts
```

The Kotlin checks execute the installed module source with host adapters and injected callback/provider failures.
They cover cancellation conversion errors, launch failures with late results, duplicate callbacks, slow provider I/O,
overlapping launches, malformed results, retry, multiple files, and runtime teardown. Passing an unpatched module path
as the script's first argument runs the same checks against that source; cancellation error injection fails there.
These checks do not claim to reproduce every device-specific cause of an intermittent crash.

Build the real production composer in a separate test package, preserving the installed app and its account data:

```powershell
cd apps/native/android
$env:NODE_PATH = (Resolve-Path ../node_modules).Path
$env:NODE_ENV = 'production'
node ../scripts/patch-document-picker.cjs
.\gradlew.bat :app:assembleRelease -I ../e2e/document-picker.init.gradle -PreactNativeArchitectures=arm64-v8a
cd ../../..
$env:ANDROID_SERIAL = '<device serial>'
node apps/native/e2e/document-picker-test.mjs
```

The device journey repeats cancellation ten times, returns from the background five times, selects a screenshot
created by the test, and checks that another cancellation preserves the attachment and the original process.
Screenshots and the result are saved under `.codex-tmp/document-picker-<device serial>`.

Web uses the browser's file input and needs no Android patch. Check both mobile and desktop layouts with:

```powershell
npm run test:chat:e2e -w @codex-switch/web -- --grep 'file selection is canceled'
```
