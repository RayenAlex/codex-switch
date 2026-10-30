import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { promisify } from 'node:util';
import { setTimeout as delay } from 'node:timers/promises';

const exec = promisify(execFile);
const root = fileURLToPath(new URL('../../../', import.meta.url));
const output = path.join(root, '.codex-tmp/download-selection-android');
const serial = process.env.ANDROID_SERIAL;
assert.ok(serial, 'Set ANDROID_SERIAL to a physical test device');
const app = 'com.codexswitch.mobile.downloaduitest';
const adb = async (...args) => (await exec('adb', ['-s', serial, ...args], {
  encoding: 'utf8', timeout: 60_000, windowsHide: true, maxBuffer: 4 * 1024 * 1024,
})).stdout.trim();

async function nodes() {
  // UI automation can briefly be unavailable while another instrumentation session is closing.
  const result = await adb('shell', 'uiautomator', 'dump', '/sdcard/download-selection-layout.xml').catch(() => '');
  if (!result.includes('dumped to:')) return [];
  const xml = await adb('shell', 'cat', '/sdcard/download-selection-layout.xml');
  return [...xml.matchAll(/<node\b([^>]*)>/g)].map(match => Object.fromEntries(
    [...match[1].matchAll(/([\w-]+)="([^"]*)"/g)].map(attribute => [attribute[1], attribute[2]])))
    .filter(node => node.package === app);
}

async function find(label) {
  for (let attempt = 0; attempt < 8; attempt++) {
    const node = (await nodes()).find(value => value.text === label || value['content-desc'] === label);
    if (node) return node;
    await delay(500);
  }
  assert.fail(`Missing native label: ${label}`);
}

async function tap(label) {
  const node = await find(label);
  const [left, top, right, bottom] = [...node.bounds.matchAll(/\d+/g)].map(value => Number(value[0]));
  await adb('shell', 'input', 'tap', String(Math.round((left + right) / 2)), String(Math.round((top + bottom) / 2)));
  await delay(300);
}

async function screenshot(name) {
  await adb('shell', 'screencap', '-p', '/sdcard/download-selection-result.png');
  await adb('pull', '/sdcard/download-selection-result.png', path.join(output, `${name}.png`));
}

async function completionTiming() {
  for (let attempt = 0; attempt < 8; attempt++) {
    const labels = (await nodes()).map(node => node.text);
    const summary = labels.find(label => /^\d{4}\/\d{2}\/\d{2} .* · 用时/.test(label));
    if (summary) {
      assert.ok(!summary.includes('\n'), summary);
      assert.ok(!labels.some(label => label.includes('未记录')));
      assert.ok(!labels.includes('已保存到下载文件夹'));
      return summary;
    }
    await delay(500);
  }
  assert.fail('Missing single-line download completion summary');
}

async function checkTimingPersistence(scale) {
  const timing = await completionTiming();
  await screenshot(`completion-${scale}`);
  await adb('shell', 'am', 'force-stop', app);
  await adb('shell', 'am', 'start', '-W', '-n', `${app}/com.codexswitch.mobile.MainActivity`);
  await tap('下载管理');
  assert.deepEqual(await completionTiming(), timing);
  console.log(`PASS: completion time and total duration persist at font scale ${scale}`);
}

async function checkLegacyTiming(scale) {
  await tap('旧记录');
  await find('RemoteAI-2.0.12-android.apk');
  const labels = (await nodes()).map(node => node.text);
  assert.ok(!labels.some(label => /未记录|用时|完成时间/.test(label)));
  await screenshot(`legacy-${scale}`);
  await tap('返回发现');
  console.log(`PASS: missing timing is hidden at font scale ${scale}`);
}

async function checkSelection(scale) {
  await tap('下载管理');
  await checkTimingPersistence(scale);
  assert.equal((await find('批量删除')).enabled, 'false');
  await screenshot(`default-${scale}`);
  await tap('安装说明.txt');
  await find('批量删除（1）');
  await tap('全选');
  await find('批量删除（3）');
  await screenshot(`all-selected-${scale}`);
  await tap('取消全选');
  assert.equal((await find('批量删除')).enabled, 'false');
  await tap('全选');
  await tap('安装说明.txt');
  await find('全选');
  await find('批量删除（2）');
  await tap('全选');
  await find('批量删除（3）');
  await tap('取消全选');
  assert.equal((await find('批量删除')).enabled, 'false');
  await tap('选择下载：安装说明.txt');
  await tap('选择下载：项目资料.zip');
  await find('批量删除（2）');
  await screenshot(`selected-${scale}`);
  await tap('删除');
  await find('删除这 1 项下载？');
  await tap('保留');
  await find('批量删除（2）');
  await tap('批量删除（2）');
  await find('删除这 2 项下载？');
  await screenshot(`confirm-${scale}`);
  await tap('保留');
  await tap('批量删除（2）');
  await tap('删除');
  await find('RemoteAI-2.0.12-android.apk');
  assert.equal((await find('批量删除')).enabled, 'false');
  assert.equal((await nodes()).filter(node => node['content-desc'].startsWith('选择下载：')).length, 1);
  await screenshot(`deleted-${scale}`);
  await tap('返回发现');
  await tap('下载管理');
  await find('RemoteAI-2.0.12-android.apk');
  await adb('shell', 'input', 'keyevent', '4');
  await find('下载管理');
  console.log(`PASS: selection, cancellation, batch deletion and navigation at font scale ${scale}`);
}

const originalScale = await adb('shell', 'settings', 'get', 'system', 'font_scale');
try {
  await mkdir(output, { recursive: true });
  const apk = 'apps/native/android/app/build-download-selection/outputs/apk/release/app-release.apk';
  await adb('install', '-r', path.join(root, apk));
  for (const scale of [1.3, 1]) {
    await adb('shell', 'settings', 'put', 'system', 'font_scale', String(scale));
    await adb('shell', 'pm', 'clear', app);
    await adb('shell', 'am', 'start', '-W', '-n', `${app}/com.codexswitch.mobile.MainActivity`);
    await checkSelection(scale);
    await checkLegacyTiming(scale);
  }
} finally {
  if (originalScale === 'null') await adb('shell', 'settings', 'delete', 'system', 'font_scale');
  else await adb('shell', 'settings', 'put', 'system', 'font_scale', originalScale);
  await adb('shell', 'am', 'force-stop', app);
  await adb('shell', 'am', 'start', '-W', '-n', 'com.codexswitch.mobile/com.codexswitch.mobile.MainActivity');
}
