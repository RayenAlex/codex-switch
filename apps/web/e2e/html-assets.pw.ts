import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';

const path = 'D:/remote project/review/index.html';
const image = '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="80"><rect width="120" height="80" '
  + 'fill="#168570"/></svg>';
const text = '<!doctype html><link rel="stylesheet" href="styles/page.css"><h1>Review preview</h1>'
  + '<img alt="Before" src="../before%20image.svg?version=2"><img alt="After" src="after.svg">'
  + '<img alt="Responsive" srcset="after.svg 1x, ../before%20image.svg 2x">'
  + '<div id="background" style="width:120px;height:80px;background-image:url(after.svg)"></div>'
  + '<input type="range" aria-label="Compare" oninput="document.body.dataset.value=this.value">'
  + '<script src="scripts/page.js"></script>';
const assets = Object.fromEntries(Object.entries({
  'D:/remote project/before image.svg': [image, 'image/svg+xml'],
  'D:/remote project/review/after.svg': [image, 'image/svg+xml'],
  'D:/remote project/review/styles/page.css': ['@import "theme.css"; h1{color:rgb(17,119,85)}', 'text/css'],
  'D:/remote project/review/styles/theme.css': ['body{background:rgb(32,38,46)}', 'text/css'],
  'D:/remote project/review/scripts/page.js': ['document.body.dataset.ready="yes";'
    + 'try{parent.document.body.dataset.escaped="yes"}catch{document.body.dataset.isolated="yes"}', 'text/javascript'],
}).map(([path, [content, mime]]) => [path, { data: Buffer.from(content).toString('base64'), mime }]));

test('a stalled image does not hide the report or block other images and controls', async ({ page }) => {
  await page.clock.install();
  await page.addInitScript(fixture => Object.assign(window, { htmlFixture: fixture }), {
    path, assets, stalledPath: 'D:/remote project/review/stalled.png',
    text: '<h1>Report ready</h1><img src="stalled.png"><img alt="Available" src="after.svg">'
      + '<button onclick="this.textContent=\'Clicked\'">Compare</button>',
  });
  await page.goto('e2e/html-assets-harness.html?drawer');
  await page.getByRole('button', { name: 'Open report', exact: true }).click();
  const frame = page.frameLocator('iframe');
  await expect(frame.getByRole('heading', { name: 'Report ready' })).toBeVisible({ timeout: 5000 });
  await expect.poll(() => frame.getByAltText('Available').evaluate((image: HTMLImageElement) => image.naturalWidth))
    .toBe(120);
  await frame.getByRole('button', { name: 'Compare' }).click();
  await expect(frame.getByRole('button', { name: 'Clicked' })).toBeVisible();
  await page.clock.fastForward(31_000);
  await expect(page.getByRole('status')).toHaveText('部分图片或媒体未能加载，可以重新打开预览再试。');
  await expect(frame.getByRole('button', { name: 'Clicked' })).toBeVisible();
  await page.evaluate(() => (window as unknown as { setPreviewLanguage: (language: string) => void })
    .setPreviewLanguage('en'));
  await expect(page.getByRole('status')).toHaveText(
    'Some images or media could not be loaded. Reopen the preview to try again.');
  await expect(frame.getByRole('button', { name: 'Clicked' })).toBeVisible();
});

test('HTML resolves adjacent and parent assets through the selected computer and keeps scripts isolated', async ({ page }) => {
  const unexpected: string[] = [];
  page.on('request', request => { if (/before%20image|after\.svg|styles\/|scripts\/page/.test(request.url())) {
    unexpected.push(request.url());
  } });
  await page.addInitScript(fixture => Object.assign(window, { htmlFixture: fixture }), { path, text, assets });
  await page.goto('e2e/html-assets-harness.html');
  const frame = page.frameLocator('iframe');
  await expect(frame.getByRole('heading')).toHaveCSS('color', 'rgb(17, 119, 85)');
  await expect(frame.locator('body')).toHaveCSS('background-color', 'rgb(32, 38, 46)');
  for (const alt of ['Before', 'After', 'Responsive']) {
    await expect.poll(() => frame.getByAltText(alt).evaluate((image: HTMLImageElement) => image.naturalWidth))
      .toBe(alt === 'Responsive' ? 60 : 120);
  }
  await expect(frame.locator('body')).toHaveAttribute('data-ready', 'yes');
  await expect(frame.locator('body')).toHaveAttribute('data-isolated', 'yes');
  expect(await page.evaluate(() => document.body.dataset.escaped)).toBeUndefined();
  await frame.getByRole('slider').fill('75');
  await expect(frame.locator('body')).toHaveAttribute('data-value', '75');
  expect(unexpected).toEqual([]);
  const state = await page.evaluate(() => {
    const state = window as unknown as { assetReads: string[]; assetSessions: Map<string, string> };
    return { reads: state.assetReads, sessions: state.assetSessions.size };
  });
  expect(new Set(state.reads).size).toBe(state.reads.length);
  expect(state.sessions).toBe(0);
  await page.screenshot({ path: test.info().outputPath('html-assets.png'), fullPage: true });
  await page.getByRole('button', { name: '源码', exact: true }).click();
  await expect(page.locator('pre')).toContainText('../before%20image.svg?version=2');
});

test('original report loads all images and videos and retains the comparison slider', async ({ page }) => {
  const filePath = process.env.HTML_PREVIEW_TEST_FILE;
  test.skip(!filePath, 'Set HTML_PREVIEW_TEST_FILE to verify an existing local report without adding its assets to the repo.');
  const text = await readFile(filePath!, 'utf8');
  const assets: Record<string, { data: string; mime: string }> = {};
  for (const match of text.matchAll(/\b(?:src|poster)="([^"]+)"/g)) {
    const path = resolve(dirname(filePath!), match[1]).replace(/\\/g, '/');
    const type = path.endsWith('.mp4') ? 'video/mp4' : path.endsWith('.jpg') ? 'image/jpeg' : 'image/png';
    assets[path] = { data: (await readFile(path)).toString('base64'), mime: type };
  }
  await page.addInitScript(fixture => Object.assign(window, { htmlFixture: fixture }),
    { path: filePath!.replace(/\\/g, '/'), text, assets });
  await page.goto('e2e/html-assets-harness.html');
  const frame = page.frameLocator('iframe');
  await expect(frame.locator('img').first()).toBeVisible();
  await expect.poll(() => frame.locator('img').evaluateAll(images =>
    images.every(image => (image as HTMLImageElement).naturalWidth > 0)), { timeout: 30_000 }).toBe(true);
  await expect.poll(() => frame.locator('video').evaluateAll(videos =>
    videos.every(video => (video as HTMLVideoElement).videoWidth > 0)), { timeout: 30_000 }).toBe(true);
  await frame.getByRole('slider').fill('75');
  await expect(frame.locator('#after')).toHaveCSS('clip-path', 'inset(0px 0px 0px 75%)');
  await expect(page.getByRole('status')).toHaveCount(0);
  await frame.locator('h1').first().scrollIntoViewIfNeeded();
  await page.screenshot({ path: test.info().outputPath('original-html-report.png'), fullPage: true });
});
