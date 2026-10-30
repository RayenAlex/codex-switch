import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { promisify } from 'node:util';
import { setTimeout as delay } from 'node:timers/promises';

const exec = promisify(execFile);
const root = fileURLToPath(new URL('../../../', import.meta.url));
const output = path.join(root, '.codex-tmp/git-file-conflicts-android');
const serial = process.env.ANDROID_SERIAL;
assert.ok(serial, 'Set ANDROID_SERIAL to the physical test device');
const app = 'com.codexswitch.mobile.gitactivitytest';
const adb = async (...args) => (await exec('adb', ['-s', serial, ...args], {
  encoding: 'utf8', timeout: 60_000, windowsHide: true, maxBuffer: 4 * 1024 * 1024,
})).stdout.trim();

async function nodes() {
  await adb('shell', 'uiautomator', 'dump', '/sdcard/git-file-conflicts-layout.xml');
  const xml = await adb('shell', 'cat', '/sdcard/git-file-conflicts-layout.xml');
  await writeFile(path.join(output, 'latest-layout.xml'), xml);
  return [...xml.matchAll(/<node\b([^>]*)>/g)].map(match => Object.fromEntries(
    [...match[1].matchAll(/([\w-]+)="([^"]*)"/g)].map(attribute => [attribute[1], attribute[2]])));
}
const matches = (node, label) => node['content-desc'] === label || node.text === label;
async function find(label) {
  for (let attempt = 0; attempt < 8; attempt++) {
    const node = (await nodes()).find(value => matches(value, label));
    if (node) return node;
    await delay(400);
  }
  assert.fail(`Missing native label: ${label}`);
}
const center = node => {
  const [left, top, right, bottom] = [...node.bounds.matchAll(/\d+/g)].map(value => Number(value[0]));
  return [Math.round((left + right) / 2), Math.round((top + bottom) / 2)].map(String);
};
async function tap(label) { await adb('shell', 'input', 'tap', ...center(await find(label))); }
async function hold(label) {
  const point = center(await find(label));
  await adb('shell', 'input', 'swipe', ...point, ...point, '800');
}
async function screenshot(name) {
  await adb('shell', 'screencap', '-p', '/sdcard/git-file-conflicts-result.png');
  await adb('pull', '/sdcard/git-file-conflicts-result.png', path.join(output, `${name}.png`));
}

async function verify(scale) {
  await tap('Git');
  await tap('平铺');
  await find('选择 src/app.ts');
  await hold('查看 src/app.ts');
  await tap('回退单个文件');
  await find('确认回退');
  await tap('确认回退');
  const labels = (await nodes()).map(node => `${node.text} ${node['content-desc']}`).join('\n');
  assert.ok(labels.includes('task-login') && labels.includes('task-release'), 'Both conflicting tasks must be named');
  assert.ok(labels.includes('以下文件正被运行中的任务使用'), 'The error must be localized');
  assert.ok(!labels.includes('client.gitActivity'), 'Do not expose semantic keys or JSON');
  await screenshot(`conflict-${scale}`);
  await tap('取消');
  assert.ok(!(await nodes()).some(node => node.text?.includes('task-login')), 'Dismissed errors must clear');
  await hold('查看 README.md');
  await tap('回退单个文件');
  await tap('确认回退');
  await delay(500);
  assert.ok(!(await nodes()).some(node => matches(node, '选择 README.md')));
  await find('选择 src/app.ts');
  await adb('shell', 'input', 'keyevent', 'KEYCODE_BACK');
  await find('Git');
  await tap('Git');
  await find('选择 src/app.ts');
  await screenshot(`after-rollback-${scale}`);
  console.log(`PASS: named task conflicts, independent rollback and back navigation at font scale ${scale}`);
}

const originalScale = await adb('shell', 'settings', 'get', 'system', 'font_scale');
try {
  await mkdir(output, { recursive: true });
  await adb('install', '-r', path.join(root,
    'apps/native/android/app/build-git-file-conflicts/outputs/apk/debug/app-debug.apk'));
  for (const scale of [1, 1.3]) {
    await adb('shell', 'settings', 'put', 'system', 'font_scale', String(scale));
    await adb('shell', 'am', 'force-stop', app);
    await adb('shell', 'am', 'start', '-W', '-n', `${app}/com.codexswitch.mobile.MainActivity`);
    await verify(scale);
  }
  await writeFile(path.join(output, 'result.json'), JSON.stringify({ passed: true, fontScales: [1, 1.3] }));
} finally {
  if (originalScale === 'null') await adb('shell', 'settings', 'delete', 'system', 'font_scale');
  else await adb('shell', 'settings', 'put', 'system', 'font_scale', originalScale);
  await adb('shell', 'am', 'force-stop', app);
}
