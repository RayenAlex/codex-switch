import { expect, test, type Locator, type Page } from '@playwright/test';
import { sshEditorFixture } from './ssh-editor-fixture';

test.use({ viewport: { width: 1600, height: 1000 }, actionTimeout: 15_000 });

async function selectionContrast(editor: Locator) {
  return editor.evaluate(content => {
    const root = content.closest('.cm-editor')!;
    const selection = root.querySelector('.cm-selectionBackground')!;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1;
    const context = canvas.getContext('2d')!;
    const colors = (element: Element) => getComputedStyle(element);
    const backgrounds: string[] = [];
    for (let element: Element | null = selection; element; element = element.parentElement) {
      backgrounds.unshift(colors(element).backgroundColor);
    }
    const luminance = () => Array.from(context.getImageData(0, 0, 1, 1).data).slice(0, 3)
      .map(value => value / 255).map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4)
      .reduce((total, value, index) => total + value * [0.2126, 0.7152, 0.0722][index], 0);
    context.fillStyle = '#fff'; context.fillRect(0, 0, 1, 1);
    for (const background of backgrounds) {
      context.fillStyle = background; context.fillRect(0, 0, 1, 1);
    }
    const background = luminance();
    context.fillStyle = colors(content).color; context.fillRect(0, 0, 1, 1);
    const foreground = luminance();
    return (Math.max(background, foreground) + 0.05) / (Math.min(background, foreground) + 0.05);
  });
}

async function checkSelection(page: Page, editor: Locator, name: string) {
  await editor.press('Control+Home');
  await editor.press('Control+Shift+End');
  await expect(editor).toBeFocused();
  const selection = editor.locator('..').locator('.cm-selectionBackground').first();
  await expect(selection).toBeVisible();
  await expect.poll(() => selectionContrast(editor)).toBeGreaterThanOrEqual(4.5);
  await page.screenshot({ path: test.info().outputPath(`${name}-focused.png`), animations: 'disabled' });
  await editor.evaluate(element => (element as HTMLElement).blur());
  await expect(editor).not.toBeFocused();
  await expect(selection).toBeVisible();
  await expect.poll(() => selectionContrast(editor)).toBeGreaterThanOrEqual(4.5);
  await page.screenshot({ path: test.info().outputPath(`${name}-blurred.png`), animations: 'disabled' });
}

async function openSsh(page: Page, mode: string) {
  await sshEditorFixture(page);
  await page.goto(`/e2e/ssh-harness.html?mode=${mode}&cloud=1`);
  await page.getByRole('button', { name: mode === 'web' ? '打开远程终端' : '打开终端', exact: true }).click();
  await page.getByRole('button', { name: '终端连接选项' }).click();
  await page.getByRole('menuitem', { name: 'Editor server', exact: true }).click();
  await page.getByRole('button', { name: '远程文件浏览', exact: true }).click();
  const resize = page.getByRole('separator', { name: '调整详情抽屉宽度' });
  await resize.focus(); await page.keyboard.press('End');
  await expect(page.locator('.pf-browser')).toHaveAttribute('data-narrow', 'false');
  await page.getByRole('treeitem', { name: 'hello.txt', exact: true }).click();
}

for (const mode of ['local', 'remote', 'web']) {
  test(`${mode}: file selections stay readable in both themes`, async ({ page }) => {
    await page.goto(`/e2e/project-browser-harness.html?mode=${mode}&dark`);
    await page.getByRole('button', { name: '文件浏览', exact: true }).click();
    await page.getByRole('treeitem', { name: 'notes.txt', exact: true }).click();
    const editor = page.getByRole('textbox', { name: '文件内容', exact: true });
    await checkSelection(page, editor, 'text-dark');
    await page.getByRole('treeitem', { name: 'settings.json', exact: true }).click();
    await expect(editor.locator('.cm-line span')).not.toHaveCount(0);
    await checkSelection(page, editor, 'code-dark');
    // Change the live palette without recreating the editor or its selection.
    await page.getByRole('button', { name: '切换主题' }).evaluate(button => (button as HTMLElement).click());
    await checkSelection(page, editor, 'code-light');
  });

  test(`${mode}: SSH selections follow live theme changes`, async ({ page }) => {
    await openSsh(page, mode);
    const editor = page.getByRole('textbox', { name: '文件内容', exact: true });
    await checkSelection(page, editor, 'ssh-light');
    await page.getByRole('button', { name: '切换主题' }).evaluate(button => (button as HTMLElement).click());
    await checkSelection(page, editor, 'ssh-dark');
    await page.getByRole('treeitem', { name: 'script.ts', exact: true }).click();
    await checkSelection(page, editor, 'ssh-code-dark');
  });

  for (const theme of ['dark', 'light']) {
    test(`${mode}: merge selections stay readable in ${theme} mode`, async ({ page }) => {
      await page.goto(`/e2e/git-conflicts.html?mode=${mode}${theme === 'dark' ? '&dark' : ''}`);
      await page.getByRole('button', { name: '解决冲突', exact: true }).first().click();
      await checkSelection(page, page.locator('.gm-result .cm-content'), `merge-${theme}`);
    });
  }
}
