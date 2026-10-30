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
const output = path.join(root, `.codex-tmp/message-attachments-${serial}`);
const applicationId = 'com.codexswitch.mobile.attachmenttest';
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
  throw new Error('Expected attachment state did not appear');
}

async function tap(node) {
  assert.ok(node, 'Expected control is present');
  const [left, top, right, bottom] = [...node.bounds.matchAll(/-?\d+/g)].map(value => Number(value[0]));
  await adb('shell', 'input', 'tap', String((left + right) >> 1), String((top + bottom) >> 1));
}

async function screenshot(name) {
  await adb('shell', 'screencap', '-p', '/sdcard/message-attachments-result.png');
  await adb('pull', '/sdcard/message-attachments-result.png', path.join(output, `${name}.png`));
}

const attachmentEntry = node => node['content-desc'] === '查看 1 个附件';
const hasText = (tree, text) => tree.some(node => node.text === text);

async function verifyScale(scale) {
  await adb('shell', 'settings', 'put', 'system', 'font_scale', String(scale));
  await adb('shell', 'am', 'force-stop', applicationId);
  await adb('shell', 'am', 'start', '-W', '-n', `${applicationId}/com.codexswitch.mobile.MainActivity`);
  let tree = await waitFor(tree => tree.filter(attachmentEntry).length === 2);
  assert.ok(hasText(tree, '看看 顶部状态栏在切换 tab 时 背景显示异常'));
  assert.ok(!tree.some(node => node.text?.includes('C:\\Users')));
  assert.ok(tree.some(node => node['content-desc'] === '查看 2 个附件'));
  await screenshot(`font-${scale}-messages`);
  await tap(tree.find(attachmentEntry));
  tree = await waitFor(tree => hasText(tree, '2,048 字节'));
  assert.ok(hasText(tree, '附件详情'));
  const name = 'attachment-顶部状态栏录屏-2026-10-25-17-56-11-991.mp4';
  assert.ok(hasText(tree, name));
  const filePath = tree.find(node => node.text?.startsWith('C:\\Users'))?.text;
  assert.ok(filePath?.endsWith(name));
  await screenshot(`font-${scale}-details`);
  await tap(tree.find(node => node.text === name));
  tree = await waitFor(tree => tree.some(node => node['resource-id'] === 'opened-file'));
  assert.equal(tree.find(node => node['resource-id'] === 'opened-file').text, filePath);
  await adb('shell', 'input', 'keyevent', '4');
  tree = await waitFor(tree => tree.filter(attachmentEntry).length === 2);
  await tap(tree.find(node => node['content-desc'] === '查看 2 个附件'));
  tree = await waitFor(tree => hasText(tree, '不适用于文件夹'));
  assert.ok(hasText(tree, '报告.txt'));
  assert.ok(hasText(tree, 'project'));
  await screenshot(`font-${scale}-multiple`);
  await adb('shell', 'input', 'keyevent', '4');
  await waitFor(tree => tree.filter(attachmentEntry).length === 2);
}

async function verifyThemeAndLanguage() {
  let tree = await nodes();
  await tap(tree.find(node => node['content-desc'] === 'Theme'));
  tree = await waitFor(tree => tree.filter(attachmentEntry).length === 2);
  await screenshot('dark-messages');
  await tap(tree.find(attachmentEntry));
  tree = await waitFor(tree => hasText(tree, '2,048 字节'));
  await screenshot('dark-details');
  await adb('shell', 'input', 'keyevent', '4');
  tree = await waitFor(tree => tree.filter(attachmentEntry).length === 2);
  await tap(tree.find(node => node['content-desc'] === 'en'));
  tree = await waitFor(tree => tree.some(node => node['content-desc'] === 'View attachments (1)'));
  await tap(tree.find(node => node['content-desc'] === 'View attachments (1)'));
  await waitFor(tree => hasText(tree, 'Attachment details'));
  await screenshot('english-details');
  await adb('shell', 'input', 'keyevent', '4');
}

await mkdir(output, { recursive: true });
await prepareHierarchy({ adb, output });
const originalScale = (await adb('shell', 'settings', 'get', 'system', 'font_scale')).trim();
try {
  await adb('install', '-r', path.join(root,
    'apps/native/android/app/build/outputs/apk/release/message-attachments-fixture.apk'));
  for (const scale of [1, 1.3]) await verifyScale(scale);
  await verifyThemeAndLanguage();
  await writeFile(path.join(output, 'result.json'), JSON.stringify({ passed: true, scales: [1, 1.3],
    cases: ['compact history', 'file-only live mentions', 'mixed references', 'metadata',
      'literal preview path', 'open and return', 'dark theme', 'language switching'] }, null, 2));
  console.log('PASS: Native attachment presentation, preview navigation, font scaling and language switching');
} finally {
  if (originalScale === 'null') await adb('shell', 'settings', 'delete', 'system', 'font_scale');
  else await adb('shell', 'settings', 'put', 'system', 'font_scale', originalScale);
  await adb('shell', 'am', 'force-stop', applicationId);
}
