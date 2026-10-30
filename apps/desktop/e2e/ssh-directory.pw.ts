import { expect, test, type Locator, type Page } from '@playwright/test';
import type { SshProfile } from '../../../shared/terminal/sshProfiles';
import type { TerminalEvent, TerminalRead } from '../../../shared/terminal/types';

test.skip(!process.env.SSH_DIRECTORY_FIXTURE, 'Requires the --integration WSL SSH fixture and Rust bridge on 1508');
const bridge = 'http://127.0.0.1:1508';
const quote = (value: string) => `'${value.replace(/'/g, `'"'"'`)}'`;

async function connect(page: Page, mode: string) {
  const fixture = await (await page.request.get(`${bridge}/config`)).json();
  let profiles: SshProfile[] = [];
  let id = '';
  page.on('response', async response => {
    if (response.url() !== `${bridge}/rpc`) return;
    const body = await response.json();
    if (body.data?.id) id = body.data.id;
  });
  await page.route('http://127.0.0.1:1499/sync/ssh-profiles**', async route => {
    if (route.request().method() === 'PUT') profiles = [{ ...route.request().postDataJSON(), revision: 1 }];
    await route.fulfill({ json: profiles });
  });
  await page.goto(`/e2e/ssh-harness.html?mode=${mode}&bridge=1508`);
  await page.getByRole('button', { name: mode === 'web' ? '打开远程终端' : '打开终端', exact: true }).click();
  await page.getByRole('button', { name: '终端连接选项' }).click();
  await page.getByRole('menuitem', { name: '新建 SSH 连接…' }).click();
  await page.getByLabel('IP 或主机名').fill(fixture.host);
  await page.getByLabel('端口').fill(String(fixture.port));
  await page.getByLabel('用户名', { exact: true }).fill(fixture.username);
  await page.getByLabel('密码', { exact: true }).fill(fixture.password);
  await page.getByRole('button', { name: '连接并保存', exact: true }).click();
  await page.getByRole('button', { name: '信任并连接', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect.poll(() => id).not.toBe('');
  await expect.poll(async () => output((await read(page, id)).events)).toContain('\x1b]133;B\x07');
  return { id, root: fixture.root as string };
}

async function read(page: Page, id: string, cursor = 0): Promise<TerminalRead> {
  return (await page.request.post(`${bridge}/read`, { data: { id, cursor } })).json();
}

function output(events: TerminalEvent[]) {
  return Buffer.from(events.flatMap(event => event.type === 'output' ? event.data : [])).toString();
}

async function typeCommand(page: Page, command: string, enter = true) {
  await page.locator('[role="tabpanel"]:visible .xterm-helper-textarea').focus();
  await page.keyboard.insertText(command);
  if (enter) await page.keyboard.press('Enter');
}

async function drop(page: Page, target: Locator, options: { name: string; directory: string }) {
  const transfer = await page.evaluateHandle(name => {
    const data = new DataTransfer(); data.items.add(new File(['真实上传内容'], name)); return data;
  }, options.name);
  await target.dispatchEvent('dragover', { dataTransfer: transfer });
  await expect(page.getByRole('status').filter({ hasText: '松开以上传到' })).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: '松开以上传到' })).toContainText(options.directory);
  await target.dispatchEvent('drop', { dataTransfer: transfer });
  await transfer.dispose();
}

for (const mode of ['local', 'remote', 'web']) {
  test(`${mode}: actual SSH cwd follows both ways and shell drop uploads to that directory`, async ({ page }, info) => {
    test.setTimeout(90_000);
    await page.request.post(`${bridge}/reset`);
    await page.setViewportSize({ width: 1440, height: 920 });
    const { id, root } = await connect(page, mode);
    const directory = `${root}/中文目录`;
    const name = `拖入-${mode}-${Date.now()}.txt`;
    await typeCommand(page, `cd -- ${quote(directory)}`);
    await expect.poll(async () => output((await read(page, id)).events))
      .toContain(`\x1b]7;file://localhost${directory}\x07`);
    await drop(page, page.locator('[role="tabpanel"]:visible .xterm'), { name, directory });
    const path = page.getByRole('textbox', { name: '远程路径' });
    await expect(path).toHaveValue(directory);
    await expect(page.getByRole('tree')).toContainText(name);
    const uploaded = await (await page.request.post(`${bridge}/rpc`, { data: {
      type: 'files', id, request: { type: 'read', path: `${directory}/${name}` },
    } })).json();
    expect(uploaded).toMatchObject({ data: { type: 'file' } });
    expect(Buffer.from(uploaded.data.data, 'base64').toString()).toBe('真实上传内容');

    const cursor = (await read(page, id)).cursor;
    await typeCommand(page, `printf '__TYPED__%s\\n' "$PWD"`, false);
    await expect.poll(async () => output((await read(page, id, cursor)).events))
      .toContain('\x1b]633;P;RemoteAiInput=1\x07');
    await page.getByRole('button', { name: '上一级', exact: true }).click();
    await expect(path).toHaveValue(root);
    // Browsing must not append a cd to the command the user has already started typing.
    expect(output((await read(page, id, cursor)).events)).not.toContain(`cd -- ${quote(root)}`);
    await page.locator('[role="tabpanel"]:visible .xterm-helper-textarea').focus();
    await page.keyboard.press('Enter');
    await expect.poll(async () => output((await read(page, id, cursor)).events))
      .toContain(`__TYPED__${directory}`);
    await expect.poll(async () => output((await read(page, id, cursor)).events))
      .toContain(`\x1b]7;file://localhost${root}\x07`);
    await expect(path).toHaveValue(root);
    await expect(page.locator('[role="tabpanel"]:visible .xterm-screen')).toContainText(`cd -- ${quote(root)}`);
    await page.screenshot({ path: info.outputPath(`ssh-directory-${mode}.png`), animations: 'disabled' });
    await page.request.post(`${bridge}/rpc`, { data: {
      type: 'files', id, request: { type: 'delete', path: `${directory}/${name}` },
    } });
  });
}
