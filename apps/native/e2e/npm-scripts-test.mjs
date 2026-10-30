import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const exec = promisify(execFile);
const root = fileURLToPath(new URL('../../../', import.meta.url));
const output = path.join(root, '.codex-tmp/npm-scripts-mobile');
const serial = process.env.ANDROID_SERIAL;
assert.ok(serial, 'Set ANDROID_SERIAL to the physical test device');
const applicationId = 'com.codexswitch.mobile.npmscriptstest';
const adb = async (...args) => (await exec('adb', ['-s', serial, ...args],
  { encoding: 'utf8', timeout: 60_000, maxBuffer: 4 * 1024 * 1024, windowsHide: true })).stdout;
const decode = text => text.replace(/&quot;/g, '"').replace(/&amp;/g, '&')
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>');
const bounds = node => [...node.bounds.matchAll(/\d+/g)].map(value => Number(value[0]));
async function nodes() {
  await adb('shell', 'uiautomator', 'dump', '/sdcard/npm-scripts-layout.xml');
  const xml = await adb('shell', 'cat', '/sdcard/npm-scripts-layout.xml');
  await writeFile(path.join(output, 'latest-layout.xml'), xml);
  return [...xml.matchAll(/<node\b([^>]*)>/g)].map(match => Object.fromEntries(
    [...match[1].matchAll(/([\w-]+)="([^"]*)"/g)].map(value => [value[1], decode(value[2])])))
    .filter(node => node.package === applicationId);
}
async function find(label) {
  const deadline = Date.now() + 20_000;
  do {
    const match = (await nodes()).find(node => node.text === label || node['content-desc'] === label);
    if (match) return match;
  } while (Date.now() < deadline);
  throw new Error(`Control not visible: ${label}`);
}
async function tap(label) {
  const [left, top, right, bottom] = bounds(await find(label));
  await adb('shell', 'input', 'tap', String((left + right) >> 1), String((top + bottom) >> 1));
}
async function screenshot(name) {
  const result = await exec('adb', ['-s', serial, 'exec-out', 'screencap', '-p'],
    { encoding: 'buffer', maxBuffer: 8 * 1024 * 1024, windowsHide: true });
  await writeFile(path.join(output, `${name}.png`), result.stdout);
}
async function verify(scale) {
  await adb('shell', 'settings', 'put', 'system', 'font_scale', String(scale));
  await adb('shell', 'am', 'force-stop', applicationId);
  await adb('shell', 'am', 'start', '-W', '-n', `${applicationId}/com.codexswitch.mobile.MainActivity`);
  await tap('打开工具');
  await tap('文件浏览');
  await tap('package.json');
  await find('运行 dev');
  await screenshot(`editor-${scale}`);
  await tap('运行 dev');
  await find('npm run dev');
  await screenshot(`terminal-${scale}`);
  await tap('收起终端');
  await find('停止 dev');
  await screenshot(`running-${scale}`);
  await tap('停止 dev');
  await find('运行 dev');
  await tap('运行 dev');
  await tap('关闭终端 1');
  await find('运行 dev');
  await screenshot(`closed-${scale}`);
  await tap('运行 build');
  await find('npm run build');
  await tap('收起终端');
  await find('运行 build');
  await screenshot(`completed-${scale}`);
  await tap('关闭文件浏览器');
  await find('打开工具');
}

await mkdir(output, { recursive: true });
const scale = (await adb('shell', 'settings', 'get', 'system', 'font_scale')).trim();
await adb('install', '-r', path.join(output, 'build/outputs/apk/release/npm-scripts-fixture.apk'));
try {
  await verify(1);
  await verify(1.3);
  await writeFile(path.join(output, 'result.json'), JSON.stringify({ passed: true, serial, fontScales: [1, 1.3] }));
  console.log('PASS: native script run, stop, terminal close and completion at font scales 1.0 and 1.3');
} catch (error) {
  await screenshot('failed');
  throw error;
} finally {
  await adb('shell', 'settings', 'put', 'system', 'font_scale', scale);
  await adb('shell', 'am', 'force-stop', applicationId);
  await adb('uninstall', applicationId);
  await adb('shell', 'rm', '/sdcard/npm-scripts-layout.xml');
}
