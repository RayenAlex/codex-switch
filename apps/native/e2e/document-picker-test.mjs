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
const output = path.join(root, `.codex-tmp/document-picker-${serial}`);
const applicationId = 'com.codexswitch.mobile.documentpickertest';
const component = `${applicationId}/com.codexswitch.mobile.MainActivity`;
const adb = async (...args) => (await exec('adb', ['-s', serial, ...args],
  { encoding: 'utf8', timeout: 60_000, maxBuffer: 4 * 1024 * 1024, windowsHide: true })).stdout;

async function nodes() {
  const xml = await hierarchy(adb);
  return [...xml.matchAll(/<node\b([^>]*)>/g)].map(match => Object.fromEntries(
    [...match[1].matchAll(/([\w-]+)="([^"]*)"/g)].map(value => [value[1], value[2]])));
}

async function waitFor(predicate) {
  for (let attempt = 0; attempt < 15; attempt++) {
    const tree = await nodes();
    if (predicate(tree)) return tree;
  }
  throw new Error('Expected document picker state did not appear');
}

async function tap(node) {
  assert.ok(node, 'Expected control is present');
  const [left, top, right, bottom] = [...node.bounds.matchAll(/-?\d+/g)].map(value => Number(value[0]));
  await adb('shell', 'input', 'tap', String((left + right) >> 1), String((top + bottom) >> 1));
}

const addButton = node => node['content-desc'] === '添加内容';
const fileOption = node => node['content-desc'] === '手机文件';
const pickerVisible = tree => tree.some(node => node.package === 'com.google.android.documentsui'
  || node.package === 'com.android.documentsui');

async function openPicker() {
  let tree = await waitFor(tree => tree.some(addButton));
  await tap(tree.find(addButton));
  tree = await waitFor(tree => tree.some(fileOption));
  await tap(tree.find(fileOption));
  return waitFor(pickerVisible);
}

async function screenshot(name) {
  await adb('shell', 'screencap', '-p', '/sdcard/document-picker-result.png');
  await adb('pull', '/sdcard/document-picker-result.png', path.join(output, `${name}.png`));
}

async function verifySelectionAndRetry() {
  const name = 'document-picker-result.png'; // Created by this test; no user documents are read.
  const selected = tree => tree.some(node => node['content-desc'] === `移除附件 ${name}`);
  const tree = await openPicker();
  await tap(tree.find(node => node.text === name));
  await waitFor(selected);
  await openPicker();
  await adb('shell', 'input', 'keyevent', 'KEYCODE_BACK');
  await waitFor(tree => !pickerVisible(tree) && selected(tree));
  await screenshot('selected-file-after-cancel');
}

await mkdir(output, { recursive: true });
await prepareHierarchy({ adb, output });
await adb('install', '-r', path.join(root,
  'apps/native/android/app/build-document-picker/outputs/apk/release/app-release.apk'));
await adb('shell', 'am', 'force-stop', applicationId);
await adb('shell', 'am', 'start', '-W', '-n', component);
await waitFor(tree => tree.some(addButton));
const initialPid = (await adb('shell', 'pidof', applicationId)).trim();
try {
  for (let cycle = 0; cycle < 10; cycle++) {
    await openPicker();
    if (cycle === 0) await screenshot('picker-open');
    await adb('shell', 'input', 'keyevent', 'KEYCODE_BACK');
    if (cycle % 2) {
      await adb('shell', 'input', 'keyevent', 'KEYCODE_HOME');
      await adb('shell', 'am', 'start', '-W', '-n', component);
    }
    const tree = await waitFor(tree => tree.some(addButton) && !pickerVisible(tree));
    assert.ok(!tree.some(node => node.text === '正在读取文件…' || node.text === '文件添加失败，请重新选择。'));
    assert.equal((await adb('shell', 'pidof', applicationId)).trim(), initialPid, 'App must not restart after cancel');
    console.log(`PASS: cancel ${cycle + 1}/10`);
  }
  await screenshot('after-cancel');
  await verifySelectionAndRetry();
  assert.equal((await adb('shell', 'pidof', applicationId)).trim(), initialPid);
  await writeFile(path.join(output, 'result.json'), JSON.stringify({ passed: true, cancellations: 10,
    backgroundReturns: 5, selectionAfterCancel: true, preservedAttachment: true, pid: initialPid }, null, 2));
  console.log('PASS: select a file after cancellation and preserve it through another cancellation');
} finally {
  await adb('shell', 'am', 'force-stop', applicationId);
}
