import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { hierarchy, prepareHierarchy } from '../../desktop/e2e/android-hierarchy.mjs';

const exec = promisify(execFile);
const root = fileURLToPath(new URL('../../../', import.meta.url));
const output = path.join(root, '.codex-tmp/chat-follow-android');
const serial = process.env.ANDROID_SERIAL;
assert.ok(serial, 'Set ANDROID_SERIAL to the test device');
const applicationId = 'com.codexswitch.mobile.scrolltest';
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const adb = async (...args) => (await exec('adb', ['-s', serial, ...args],
  { encoding: 'utf8', timeout: 30_000, maxBuffer: 4 * 1024 * 1024, windowsHide: true })).stdout;

async function nodes() {
  const xml = await hierarchy(adb);
  await writeFile(path.join(output, 'latest-ui.xml'), xml);
  return [...xml.matchAll(/<node\b([^>]*)>/g)].map(match => Object.fromEntries(
    [...match[1].matchAll(/([\w-]+)="([^"]*)"/g)].map(value => [value[1], value[2]])));
}

function bounds(node) {
  assert.ok(node, 'Expected view is present');
  return [...node.bounds.matchAll(/\d+/g)].map(value => Number(value[0]));
}

async function tap(label) {
  for (let attempt = 0; attempt < 20; attempt++) {
    const target = (await nodes()).find(node => node.text === label || node['content-desc'] === label);
    if (!target) { await pause(200); continue; }
    const [left, top, right, bottom] = bounds(target);
    await adb('shell', 'input', 'tap', String((left + right) >> 1), String((top + bottom) >> 1));
    return;
  }
  throw new Error(`Visible control not found: ${label}`);
}

async function swipe(distance) {
  const tree = await nodes();
  const [left, top, right, bottom] = bounds(tree.find(node => node.class === 'android.widget.ScrollView'));
  const x = String((left + right) >> 1);
  const y = Math.round(top + (bottom - top) * 0.4);
  await adb('shell', 'input', 'swipe', x, String(y), x, String(y + distance), '900');
}

async function screenshot(name) {
  const { stdout } = await exec('adb', ['-s', serial, 'exec-out', 'screencap', '-p'],
    { encoding: 'buffer', maxBuffer: 16 * 1024 * 1024, windowsHide: true });
  await writeFile(path.join(output, `${name}.png`), stdout);
}

const anchor = tree => bounds(tree.find(node => node.text === '历史消息 45'));
const report = { passed: false, cases: [] };
await mkdir(output, { recursive: true });
await prepareHierarchy({ adb, output });
const focus = (await adb('shell', 'dumpsys', 'window')).match(/mCurrentFocus=.* u0 ([\w.$]+\/[\w.$]+)/)?.[1];
try {
  await adb('install', '-r', path.join(root, 'apps/native/android/app/build/outputs/apk/release/chat-scroll-fixture.apk'));
  await adb('shell', 'am', 'force-stop', applicationId);
  await adb('shell', 'am', 'start', '-W', '-n', `${applicationId}/com.codexswitch.mobile.MainActivity`);
  await tap('progress');
  const initial = anchor(await nodes());
  const density = Number([...(await adb('shell', 'wm', 'density')).matchAll(/density: (\d+)/g)].at(-1)?.[1]) / 160;
  assert.ok(density > 0);
  await swipe(Math.round(60 * density));
  await pause(1500);
  const paused = anchor(await nodes());
  await screenshot('small-upward-scroll');
  assert.ok(paused[1] > initial[1] + 10, 'An upward drag under 100dp stays paused across timer renders');
  await tap('Start stream');
  await pause(1800);
  assert.deepEqual(anchor(await nodes()), paused, 'Streaming preserves the small upward reading offset');
  await screenshot('paused-during-stream');
  report.cases.push('small upward drag', 'timer renders', 'streaming while paused');
  await tap('回到底部');
  await screenshot('explicit-return');
  report.cases.push('explicit return to latest');
  // Recreate a static tail so the second drag can return to within the follow distance.
  await tap('plain');
  await tap('progress');
  const bottom = anchor(await nodes());
  await swipe(Math.round(60 * density));
  await swipe(-Math.round(40 * density));
  await pause(1500);
  const resumed = anchor(await nodes());
  assert.ok(Math.abs(resumed[1] - bottom[1]) <= 2, 'A downward drag near the bottom resumes following');
  await screenshot('downward-resumes-following');
  report.cases.push('downward drag resumes following');
  report.passed = true;
  console.log('PASS: small upward reading offsets survive refresh and streaming; downward scrolling resumes following');
} catch (error) {
  report.error = String(error);
  await screenshot('failure');
  throw error;
} finally {
  await writeFile(path.join(output, 'result.json'), JSON.stringify(report, null, 2));
  await adb('shell', 'am', 'force-stop', applicationId);
  if (focus && !focus.startsWith(applicationId)) await adb('shell', 'am', 'start', '-W', '-n', focus);
}
