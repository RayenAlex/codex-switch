import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { promisify } from 'node:util';
import { setTimeout as delay } from 'node:timers/promises';

const exec = promisify(execFile);
const root = fileURLToPath(new URL('../../../', import.meta.url));
const output = path.join(root, '.codex-tmp/download-count-android');
const serial = process.env.ANDROID_SERIAL;
assert.ok(serial, 'Set ANDROID_SERIAL to a physical test device');
const app = 'com.codexswitch.mobile.downloadcounttest';
const adb = async (...args) => (await exec('adb', ['-s', serial, ...args], {
  encoding: 'utf8', timeout: 60_000, windowsHide: true, maxBuffer: 4 * 1024 * 1024,
})).stdout.trim();

async function nodes() {
  // UI automation can briefly be unavailable while another instrumentation session is closing.
  const result = await adb('shell', 'uiautomator', 'dump', '/sdcard/download-count-layout.xml').catch(() => '');
  if (!result.includes('dumped to:')) return [];
  const xml = await adb('shell', 'cat', '/sdcard/download-count-layout.xml');
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
  await adb('shell', 'screencap', '-p', '/sdcard/download-count-result.png');
  await adb('pull', '/sdcard/download-count-result.png', path.join(output, `${name}.png`));
}

async function counts(expected, count = 12) {
  for (let attempt = 0; attempt < 8; attempt++) {
    const matches = (await nodes()).filter(node => node.clickable === 'true'
      && node['content-desc'].includes(count + ' 项正在下载'));
    if (matches.length === expected) return;
    await delay(300);
  }
  assert.fail('Incorrect badge count: ' + expected);
}

async function tapContaining(label) {
  const values = await nodes();
  const node = values.find(value => value['content-desc'].includes(label));
  assert.ok(node, 'Missing ' + label);
  const [left, top, right, bottom] = [...node.bounds.matchAll(/\d+/g)].map(value => Number(value[0]));
  await adb('shell', 'input', 'tap', String(Math.round((left + right) / 2)), String(Math.round((top + bottom) / 2)));
  await delay(300);
}

async function checkCounts(scale) {
  await find('12 TASKS');
  await counts(2, 2);
  await tap('12 TASKS');
  await counts(2);
  await screenshot('active-' + scale);
  await tap('ACCOUNT');
  await counts(0);
  await tap('ACCOUNT');
  await counts(2);
  await tapContaining('聊天');
  await counts(1);
  await tapContaining('发现');
  await counts(2);
  await tapContaining('下载管理');
  await find('返回发现');
  await tap('返回发现');
  await counts(2);
  await tap('PAUSE');
  await counts(0);
  await tap('12 TASKS');
  await counts(2);
  await tap('FINISH');
  await counts(0);
  await tap('12 TASKS');
  await counts(2);
  await tap('CLEAR');
  await counts(0);
  await screenshot('empty-' + scale);
  console.log('PASS: two badges, account isolation, navigation and status changes at font scale ' + scale);
}

const originalScale = await adb('shell', 'settings', 'get', 'system', 'font_scale');
try {
  await mkdir(output, { recursive: true });
  const apk = 'apps/native/android/app/build-download-count/outputs/apk/release/app-release.apk';
  await adb('install', '-r', path.join(root, apk));
  for (const scale of [1.3, 1]) {
    await adb('shell', 'settings', 'put', 'system', 'font_scale', String(scale));
    await adb('shell', 'pm', 'clear', app);
    await adb('shell', 'am', 'start', '-W', '-n', `${app}/com.codexswitch.mobile.MainActivity`);
    await checkCounts(scale);
  }
} finally {
  if (originalScale === 'null') await adb('shell', 'settings', 'delete', 'system', 'font_scale');
  else await adb('shell', 'settings', 'put', 'system', 'font_scale', originalScale);
  await adb('shell', 'am', 'force-stop', app);
  await adb('shell', 'am', 'start', '-W', '-n', 'com.codexswitch.mobile/com.codexswitch.mobile.MainActivity');
}
