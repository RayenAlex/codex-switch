import { expect, test } from '@playwright/test';

const path = '/review/index.html';
const image = '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="80"></svg>';
const asset = (text: string, mime: string) => ({ data: Buffer.from(text).toString('base64'), mime });
const assets = {
  '/review/image.svg': asset(image, 'image/svg+xml'),
  '/review/styles/page.css': asset('@import "theme.css"; h1{color:rgb(17,119,85)}', 'text/css'),
  '/review/styles/theme.css': asset('.background{background-image:url(../stalled.png)}', 'text/css'),
};

test('inline, embedded and imported CSS images do not hold the document behind a stalled transfer', async ({ page }) => {
  await page.clock.install();
  await page.addInitScript(fixture => Object.assign(window, { htmlFixture: fixture }), {
    path, assets, stalledPath: '/review/stalled.png',
    text: '<link rel="stylesheet" href="styles/page.css"><style>.ready{background-image:url(image.svg)}</style>'
      + '<h1>Report ready</h1><div class="background">Imported background</div>'
      + '<div class="ready" style="width:120px;height:80px">Ready background</div>'
      + '<div id="edited" style="background-image:url(stalled.png)">Inline background</div>'
      + '<button onclick="document.querySelector(\'#edited\').style.backgroundImage=\'none\'">Edit style</button>',
  });
  await page.goto('e2e/html-assets-harness.html');
  const frame = page.frameLocator('iframe');
  await expect(frame.getByRole('heading')).toHaveCSS('color', 'rgb(17, 119, 85)');
  await expect(frame.locator('.ready')).toHaveCSS('background-image', /data:image\/svg\+xml;base64/);
  await frame.getByRole('button', { name: 'Edit style' }).click();
  await page.clock.fastForward(31_000);
  await expect(page.getByRole('status')).toContainText('部分图片');
  await expect(frame.locator('.background')).toHaveCSS('background-image', 'url("data:,")');
  await expect(frame.locator('#edited')).toHaveCSS('background-image', 'none');
});

test('load handlers run once with decoded image dimensions without resetting early interactions', async ({ page }) => {
  await page.clock.install();
  await page.addInitScript(fixture => Object.assign(window, { htmlFixture: fixture }), {
    path, assets, stalledPath: '/review/stalled.png',
    text: '<img id="image" src="image.svg"><img src="stalled.png"><output id="result"></output>'
      + '<button onclick="this.textContent=\'Clicked\'">Compare</button>'
      + '<script>window.loadCount=0;window.onload=()=>{window.loadCount++;'
      + 'document.querySelector("#result").textContent=String(document.querySelector("#image").naturalWidth)};'
      + 'window.addEventListener("load",()=>{document.body.dataset.loads=String(window.loadCount)});</script>',
  });
  await page.goto('e2e/html-assets-harness.html');
  const frame = page.frameLocator('iframe');
  await expect.poll(() => frame.locator('#image').evaluate((image: HTMLImageElement) => image.naturalWidth)).toBe(120);
  await expect(frame.locator('#result')).toHaveText('');
  await frame.getByRole('button', { name: 'Compare' }).click();
  await page.clock.fastForward(31_000);
  await expect(frame.locator('#result')).toHaveText('120');
  await expect(frame.locator('body')).toHaveAttribute('data-loads', '1');
  await expect(frame.getByRole('button', { name: 'Clicked' })).toBeVisible();
});
