import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { promisify } from 'node:util';
import { setTimeout as delay } from 'node:timers/promises';

const exec = promisify(execFile);
const root = fileURLToPath(new URL('../../../', import.meta.url));
const output = path.join(root, '.codex-tmp/project-actions-android');
const serial = process.env.ANDROID_SERIAL;
assert.ok(serial, 'Set ANDROID_SERIAL to a physical test device');
const app = 'com.codexswitch.mobile.projectactionstest';
const project = '项目文件夹中文显示测试';
const adb = async (...args) => (await exec('adb', ['-s', serial, ...args], {
  encoding: 'utf8', timeout: 60_000, windowsHide: true, maxBuffer: 4 * 1024 * 1024,
})).stdout.trim();

async function nodes() {
  await adb('shell', 'uiautomator', 'dump', '/sdcard/project-actions-layout.xml');
  const xml = await adb('shell', 'cat', '/sdcard/project-actions-layout.xml');
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
  await adb('shell', 'screencap', '-p', '/sdcard/project-actions-result.png');
  await adb('pull', '/sdcard/project-actions-result.png', path.join(output, `${name}.png`));
}

async function verify(scale) {
  await find(`折叠项目：${project}`);
  await hold(`折叠项目：${project}`);
  await find(`管理项目：${project}`);
  await screenshot(`menu-${scale}`);
  await tap('置顶');
  await find(`折叠项目：${project}`);
  await hold(`折叠项目：${project}`);
  await tap('取消置顶');
  await tap(`折叠项目：${project}`);
  await find(`展开项目：${project}`);
  await hold(`展开项目：${project}`);
  await tap('移除项目');
  await find('移除这个项目？');
  await screenshot(`confirm-${scale}`);
  await tap('返回上一层');
  await find('置顶');
  await tap('移除项目');
  await tap('取消');
  await find(`展开项目：${project}`);
  await tap(`展开项目：${project}`);
  await find('项目里的对话');
  await hold(`折叠项目：${project}`);
  await tap('移除项目');
  await tap('移除项目');
  await find('折叠项目：最近');
  await find('项目里的对话');
  await find('其他项目的对话');
  await hold('折叠项目：最近');
  assert.ok(!(await nodes()).some(node => matches(node, '移除项目')));
  await screenshot(`removed-${scale}`);
  console.log(`PASS: project long press, pin/unpin, collapse, back/cancel, removal and retained chats at font scale ${scale}`);
}

const originalScale = await adb('shell', 'settings', 'get', 'system', 'font_scale');
try {
  await mkdir(output, { recursive: true });
  await adb('install', '-r', path.join(root,
    'apps/native/android/app/build-project-actions/outputs/apk/debug/app-debug.apk'));
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
