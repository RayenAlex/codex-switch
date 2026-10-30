const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { applyDocumentPickerPatch } = require('./patch-document-picker.cjs');

const native = path.resolve(__dirname, '..');
const dependency = path.dirname(require.resolve('expo-document-picker/package.json', { paths: [native] }));
const source = path.join(dependency, 'android/src/main/java/expo/modules/documentpicker');
const output = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-document-picker-'));
const cache = path.join(process.env.GRADLE_USER_HOME || path.join(os.homedir(), '.gradle'), 'caches/modules-2/files-2.1');
const java = process.env.JAVA_HOME ? path.join(process.env.JAVA_HOME, 'bin/java') : 'java';

function jar(artifact) {
  const directory = path.join(cache, artifact);
  for (const hash of fs.readdirSync(directory)) {
    const file = fs.readdirSync(path.join(directory, hash)).find(name => name.endsWith('.jar'));
    if (file) return path.join(directory, hash, file);
  }
  throw new Error(`Build Android first: missing ${artifact}`);
}

try {
  if (!process.argv[2]) applyDocumentPickerPatch();
  const compiler = ['org.jetbrains.kotlin/kotlin-compiler-embeddable/2.0.21',
    'org.jetbrains.kotlin/kotlin-stdlib/2.0.21', 'org.jetbrains.kotlin/kotlin-script-runtime/2.0.21',
    'org.jetbrains.kotlin/kotlin-reflect/1.6.10', 'org.jetbrains.intellij.deps/trove4j/1.0.20200330',
    'org.jetbrains.kotlinx/kotlinx-coroutines-core-jvm/1.6.4', 'org.jetbrains/annotations/13.0'].map(jar);
  const sources = Object.entries(require('../e2e/document-picker/nativeStubs.cjs')).map(([name, content]) => {
    const file = path.join(output, name);
    fs.writeFileSync(file, content);
    return file;
  });
  sources.push(process.argv[2] ? path.resolve(process.argv[2]) : path.join(source, 'DocumentPickerModule.kt'),
    path.join(source, 'DocumentPickerExceptions.kt'),
    path.join(native, 'e2e/document-picker/DocumentPickerChecks.kt'));
  const classes = path.join(output, 'checks.jar');
  const libraries = [compiler[1], compiler[5]].join(path.delimiter);
  const run = args => execFileSync(java, args, { stdio: 'inherit', windowsHide: true, timeout: 60_000 });
  run(['-cp', compiler.join(path.delimiter), 'org.jetbrains.kotlin.cli.jvm.K2JVMCompiler',
    '-no-stdlib', '-no-reflect', '-classpath', libraries, '-d', classes, ...sources]);
  run(['-cp', [classes, libraries].join(path.delimiter), 'expo.modules.documentpicker.DocumentPickerChecksKt']);
} finally {
  const resolved = fs.realpathSync(output);
  if (path.dirname(resolved) !== fs.realpathSync(os.tmpdir())) throw new Error('Unexpected test output directory');
  fs.rmSync(resolved, { recursive: true, force: true });
}
