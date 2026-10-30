import assert from 'node:assert/strict';
import { test } from 'node:test';
import { testBrowserArguments, testBrowserChannel, testBrowserExecutable, testBrowserLaunchOptions }
  from './test-browser.mjs';

test('defaults to the bundled browser on every host', () => {
  for (const platform of ['win32', 'darwin', 'linux']) {
    assert.equal(testBrowserChannel(undefined, platform), undefined);
    assert.equal(testBrowserChannel('  ', platform), undefined);
    assert.equal(testBrowserChannel(' chromium ', platform), 'chromium');
  }
});

test('rejects system Chrome and Edge channels before launching on Windows', () => {
  for (const browser of ['chrome', 'msedge']) {
    for (const suffix of ['', '-beta', '-dev', '-canary']) {
      assert.throws(() => testBrowserChannel(` ${browser}${suffix} `, 'win32'), /lock the Windows account/);
    }
  }
  assert.throws(() => testBrowserChannel('MSEdge', 'win32'), /playwright install chromium/);
});

test('retains explicit branded browser coverage on other platforms', () => {
  assert.equal(testBrowserChannel('msedge', 'linux'), 'msedge');
  assert.equal(testBrowserChannel('chrome-beta', 'darwin'), 'chrome-beta');
});

test('Windows executable overrides can only select the bundled browser', () => {
  const bundled = 'C:\\cache\\ms-playwright\\chromium-1243\\chrome-win64\\chrome.exe';
  assert.equal(testBrowserExecutable(undefined, bundled, 'win32'), bundled);
  assert.equal(testBrowserExecutable(' ', bundled, 'win32'), bundled);
  const equivalent = bundled.toUpperCase().replaceAll('\\', '/');
  assert.equal(testBrowserExecutable(equivalent, bundled, 'win32'), equivalent);
  for (const executable of ['msedge.exe', 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe']) {
    assert.throws(() => testBrowserExecutable(executable, bundled, 'win32'), /lock the Windows account/);
  }
});

test('non-Windows extension tests retain custom browser paths', () => {
  assert.equal(testBrowserExecutable('/opt/chromium', '/cache/chromium', 'linux'), '/opt/chromium');
});

test('merges the workaround with all caller feature switches without changing other arguments', () => {
  const args = ['--disable-gpu', '--disable-features=WebRtcHideLocalIpsWithMdns',
    '--disable-features=OtherFeature,WebRtcHideLocalIpsWithMdns'];
  const snapshot = [...args];
  const result = testBrowserArguments(args, 'win32');
  assert.deepEqual(args, snapshot);
  assert.equal(result[0], '--disable-gpu');
  assert.equal(result.filter(arg => arg.startsWith('--disable-features=')).length, 1);
  assert.equal(result[1], '--disable-features=AutofillAiWalletPrivatePasses,WebRtcHideLocalIpsWithMdns,OtherFeature');
  assert.deepEqual(testBrowserArguments(args, 'linux'), args);
});

test('preserves launch settings and Playwright defaults while replacing only its feature switch', () => {
  const options = { headless: true, args: ['--disable-features=WebRtcHideLocalIpsWithMdns'],
    ignoreDefaultArgs: ['--mute-audio'], slowMo: 20 };
  const snapshot = structuredClone(options);
  const result = testBrowserLaunchOptions(options, 'win32');
  assert.deepEqual(options, snapshot);
  assert.equal(result.headless, true);
  assert.equal(result.slowMo, 20);
  assert.equal(result.ignoreDefaultArgs[0], '--mute-audio');
  const replacedFeatures = result.ignoreDefaultArgs[1].split('=')[1].split(',');
  const actualFeatures = result.args.at(-1).split('=')[1].split(',');
  for (const feature of replacedFeatures) assert.ok(actualFeatures.includes(feature));
  assert.ok(actualFeatures.includes('AutofillAiWalletPrivatePasses'));
  assert.ok(actualFeatures.includes('WebRtcHideLocalIpsWithMdns'));
  assert.deepEqual(testBrowserLaunchOptions(options, 'linux'), options);
  assert.throws(() => testBrowserLaunchOptions({ ignoreDefaultArgs: true }, 'win32'), /Revalidate/);
});
