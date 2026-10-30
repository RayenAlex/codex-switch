import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const exec = promisify(execFile);
const root = fileURLToPath(new URL('../../../', import.meta.url));
const output = path.join(root, '.codex-tmp/tools-background-android');
const serial = process.env.ANDROID_SERIAL;
assert.ok(serial, 'Set ANDROID_SERIAL to the test device');
const packageName = 'com.codexswitch.mobile.gittest';
const activity = `${packageName}/com.codexswitch.mobile.MainActivity`;
const apk = process.env.ANDROID_GIT_APK
  ?? path.join(root, 'apps/native/android/app/build/outputs/apk/release/git-fixture.apk');
const adb = async (...args) => (await exec('adb', ['-s', serial, ...args],
  { encoding: 'utf8', timeout: 60_000, maxBuffer: 4 * 1024 * 1024, windowsHide: true })).stdout;
const decode = text => text.replace(/&#(\d+);/g, (_, value) => String.fromCharCode(Number(value)))
  .replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
async function find(label) {
  const deadline = Date.now() + 20_000;
  do {
    try { await adb('shell', 'uiautomator', 'dump', '/sdcard/tools-background-layout.xml'); }
    catch (error) {
      // Android can kill a hierarchy reader during a window transition; only retry this read.
      if (error.code !== 137) throw error;
      await new Promise(resolve => setTimeout(resolve, 400));
      continue;
    }
    const xml = await adb('shell', 'cat', '/sdcard/tools-background-layout.xml');
    await writeFile(path.join(output, 'latest-layout.xml'), xml);
    const nodes = [...xml.matchAll(/<node\b([^>]*)>/g)].map(match => Object.fromEntries(
      [...match[1].matchAll(/([\w-]+)="([^"]*)"/g)].map(value => [value[1], decode(value[2])])));
    const controls = nodes.filter(node => node.package === packageName);
    const node = controls.find(node => node['content-desc'] === label) ?? controls.find(node => node.text === label);
    if (node) return node;
  } while (Date.now() < deadline);
  throw new Error(`Control not visible: ${label}`);
}
async function tap(label) {
  const node = await find(label);
  const [left, top, right, bottom] = [...node.bounds.matchAll(/\d+/g)].map(value => Number(value[0]));
  await adb('shell', 'input', 'tap', String((left + right) >> 1), String((top + bottom) >> 1));
}
async function screenshot(name) {
  await adb('shell', 'screencap', '-p', '/sdcard/tools-background-result.png');
  await adb('pull', '/sdcard/tools-background-result.png', path.join(output, `${name}.png`));
}
async function backgroundAndResume() {
  await adb('shell', 'input', 'keyevent', 'KEYCODE_BACK');
  await adb('shell', 'input', 'keyevent', 'KEYCODE_HOME');
  await new Promise(resolve => setTimeout(resolve, 1500));
  await adb('shell', 'am', 'start', '-W', '-n', activity);
}

await mkdir(output, { recursive: true });
const focus = (await adb('shell', 'dumpsys', 'window')).match(/mCurrentFocus=.* u0 ([\w.$]+\/[\w.$]+)/)?.[1];
await adb('install', '-r', apk);
await adb('shell', 'am', 'start', '-W', '-n', activity);
try {
  await tap('打开工具');
  await tap('Git');
  await tap('提交说明');
  await adb('shell', 'input', 'text', 'keep_git_draft');
  await backgroundAndResume();
  assert.ok((await find('提交说明')).text.includes('keep_git_draft'), 'Git draft survives background/resume');
  await screenshot('git-resumed');
  await adb('shell', 'input', 'keyevent', 'KEYCODE_BACK');
  await tap('打开工具');
  await tap('端口映射');
  await tap('目标 IP');
  await adb('shell', 'input', 'text', '192.168.1.25');
  await backgroundAndResume();
  assert.equal((await find('目标 IP')).text, '192.168.1.25', 'Mapping form survives background/resume');
  await screenshot('mapping-resumed');
  await writeFile(path.join(output, 'result.json'), JSON.stringify({ passed: true, serial }, null, 2));
  console.log('PASS: native Git and port mapping drafts survive background/resume');
} catch (error) {
  await screenshot('failed');
  throw error;
} finally {
  await adb('shell', 'am', 'force-stop', packageName);
  await adb('uninstall', packageName);
  if (focus && !focus.startsWith(packageName)) await adb('shell', 'am', 'start', '-W', '-n', focus);
}
