import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { promisify } from 'node:util';
import { setTimeout as delay } from 'node:timers/promises';

const exec = promisify(execFile);
const root = fileURLToPath(new URL('../../../', import.meta.url));
const output = path.join(root, '.codex-tmp/device-screen-android');
const serial = process.env.ANDROID_SERIAL;
assert.ok(serial, 'Set ANDROID_SERIAL to a physical test device');
const app = 'com.codexswitch.mobile.devicescreentest';
const adb = async (...args) => (await exec('adb', ['-s', serial, ...args], {
  encoding: 'utf8', timeout: 60_000, windowsHide: true, maxBuffer: 4 * 1024 * 1024,
})).stdout.trim();

async function nodes() {
  await adb('shell', 'uiautomator', 'dump', '/sdcard/device-screen-layout.xml');
  const xml = await adb('shell', 'cat', '/sdcard/device-screen-layout.xml');
  return [...xml.matchAll(/<node\b([^>]*)>/g)].map(match => Object.fromEntries(
    [...match[1].matchAll(/([\w-]+)="([^"]*)"/g)].map(attribute => [attribute[1], attribute[2]])));
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
  await delay(500);
}

async function screenshot(name) {
  await adb('shell', 'screencap', '-p', '/sdcard/device-screen-result.png');
  await adb('pull', '/sdcard/device-screen-result.png', path.join(output, `${name}.png`));
}

const originalScale = await adb('shell', 'settings', 'get', 'system', 'font_scale');
try {
  await mkdir(output, { recursive: true });
  await adb('install', '-r', path.join(root, 'apps/native/android/app/build/outputs/apk/release/device-screen-fixture.apk'));
  for (const scale of [1, 1.3]) {
    await adb('shell', 'settings', 'put', 'system', 'font_scale', String(scale));
    await adb('shell', 'am', 'force-stop', app);
    await adb('shell', 'am', 'start', '-W', '-n', `${app}/com.codexswitch.mobile.MainActivity`);
    await find('设备管理');
    await screenshot(`devices-${scale}`);
    await tap('工作电脑 的更多操作');
    await find('恢复电脑屏幕');
    await screenshot(`menu-${scale}`);
    await tap('关闭电脑屏幕');
    await find('暂时关闭电脑屏幕？');
    await screenshot(`confirm-${scale}`);
    await tap('取消');
    await tap('关闭电脑屏幕');
    await tap('关闭电脑屏幕');
    await find('已发送关闭屏幕指令');
    await find('设备管理');
    await tap('工作电脑 的更多操作');
    await tap('恢复电脑屏幕');
    await find('已发送恢复显示指令');
    await find('设备管理');
    await screenshot(`restored-${scale}`);
    console.log(`PASS: device screen actions and native text at font scale ${scale}`);
  }
} finally {
  if (originalScale === 'null') await adb('shell', 'settings', 'delete', 'system', 'font_scale');
  else await adb('shell', 'settings', 'put', 'system', 'font_scale', originalScale);
  await adb('shell', 'am', 'force-stop', app);
  await adb('shell', 'am', 'start', '-W', '-n', 'com.codexswitch.mobile/com.codexswitch.mobile.MainActivity');
}
