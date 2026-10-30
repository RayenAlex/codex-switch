import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { hierarchy, prepareHierarchy } from '../../desktop/e2e/android-hierarchy.mjs';

const exec = promisify(execFile);
const root = fileURLToPath(new URL('../../../', import.meta.url));
const serial = process.env.ANDROID_SERIAL;
assert.ok(serial, 'Set ANDROID_SERIAL to the test device');
const output = path.join(root, '.codex-tmp/chat-stutter');
const applicationId = 'com.codexswitch.mobile.drawertest';
const adb = async (...args) => (await exec('adb', ['-s', serial, ...args],
  { encoding: 'utf8', timeout: 60_000, maxBuffer: 4 * 1024 * 1024, windowsHide: true })).stdout;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const nodes = async () => [...(await hierarchy(adb)).matchAll(/<node\b([^>]*)>/g)].map(match => Object.fromEntries(
  [...match[1].matchAll(/([\w-]+)="([^"]*)"/g)].map(value => [value[1], value[2]])));
const bounds = node => [...node.bounds.matchAll(/-?\d+/g)].map(value => Number(value[0]));
const find = (tree, id) => tree.find(node => node['resource-id'] === id);
async function tap(id) {
  const node = find(await nodes(), id);
  assert.ok(node, `Missing ${id}`);
  const [left, top, right, bottom] = bounds(node);
  await adb('shell', 'input', 'tap', String((left + right) >> 1), String((top + bottom) >> 1));
}
async function state(expected) {
  for (let attempt = 0; attempt < 15; attempt++) {
    const label = find(await nodes(), 'drawer-state')?.text ?? '';
    if (label.startsWith(expected)) return label;
    await sleep(100);
  }
  throw new Error(`Drawer did not reach ${expected}`);
}
async function screenshot(name) {
  await adb('shell', 'screencap', '-p', '/sdcard/drawer-result.png');
  await adb('pull', '/sdcard/drawer-result.png', path.join(output, `${name}.png`));
}

await mkdir(output, { recursive: true });
await prepareHierarchy({ adb, output });
await adb('install', '-r', path.join(root, 'apps/native/android/app/build/outputs/apk/release/drawer-fixture.apk'));
await adb('shell', 'am', 'force-stop', applicationId);
await adb('shell', 'am', 'start', '-W', '-n', `${applicationId}/com.codexswitch.mobile.MainActivity`);
await state('closed');
const size = (await adb('shell', 'wm', 'size')).match(/(\d+)x(\d+)/);
const width = Number(size[1]);
const height = Number(size[2]);
const swipe = (from, to, duration = 400) => adb('shell', 'input', 'swipe',
  String(Math.round(width * from)), String(Math.round(height * .4)),
  String(Math.round(width * to)), String(Math.round(height * .4)), String(duration));
await screenshot('native-closed');
await swipe(.3, .8);
await state('open');
await screenshot('native-open');
const row = (await nodes()).find(node => node['content-desc'] === '聊天列表 2');
assert.ok(row, 'The real conversation row is visible');
const [rowLeft, rowTop, rowRight, rowBottom] = bounds(row);
const rowX = String((rowLeft + rowRight) >> 1);
const rowY = String((rowTop + rowBottom) >> 1);
await adb('shell', 'input', 'swipe', rowX, rowY, rowX, rowY, '750');
assert.match(await state('open'), /drawer-1$/, 'Long press still opens conversation actions');
await swipe(.75, .70);
await state('open');
await swipe(.75, .15);
await state('closed');
await swipe(.3, .35);
await state('closed');
await swipe(.08, .75);
await state('open');
await adb('shell', 'input', 'swipe', String(width >> 1), String(Math.round(height * .75)),
  String(width >> 1), String(Math.round(height * .3)), '500');
await state('open');
await screenshot('native-list-scrolled');
await swipe(.75, .15);
await state('closed');
await tap('open-drawer');
await state('open');
await adb('shell', 'input', 'tap', String(width - 15), String(Math.round(height * .4)));
await state('closed');
// The recording must show intermediate positions during the JS stall, not just a final open drawer afterward.
const recording = adb('shell', 'screenrecord', '--size', '720x1600', '--bit-rate', '2000000',
  '--time-limit', '12', '/sdcard/drawer-busy.mp4').catch(error => ({ error }));
await sleep(500);
await tap('busy-js');
await sleep(400);
await swipe(.3, .8, 900);
await state('open');
await swipe(.75, .15, 700);
await state('closed');
for (let cycle = 0; cycle < 3; cycle++) {
  await swipe(.3, .8, 200); await state('open');
  await swipe(.75, .15, 200); await state('closed');
}
const recorded = await recording;
if (typeof recorded !== 'string') throw recorded.error;
await adb('pull', '/sdcard/drawer-busy.mp4', path.join(output, 'native-busy.mp4'));
await writeFile(path.join(output, 'native-result.json'), JSON.stringify({ passed: true, serial,
  cases: ['surface-open', 'edge-open', 'close', 'short-open', 'short-close', 'vertical-list-scroll', 'row-long-press',
    'button-open', 'mask-close', 'busy-js-drag', 'repeated-streaming-drags'] }, null, 2));
console.log('PASS: native drawer gestures while streaming and while JS is blocked');
await adb('shell', 'am', 'force-stop', applicationId);
