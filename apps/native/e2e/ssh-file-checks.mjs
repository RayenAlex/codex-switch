import assert from 'node:assert/strict';

export async function checkSshFiles(ui, scale) {
  const { tap, wait, find, input, screenshot, longPress, back } = ui;
  await tap('远程文件浏览'); await wait('hello.txt');
  await screenshot(`files-${scale}`);
  await tap('中文目录'); await wait('nested.txt');
  await longPress('中文目录'); await tap('新建'); await tap('新建文件夹');
  await input('名称', 'phone-folder'); await tap('确定'); await wait('phone-folder');
  await longPress('phone-folder'); await wait('重命名'); await screenshot(`file-menu-${scale}`);
  await tap('重命名'); await input('名称', 'renamed'); await tap('确定'); await wait('renamed');
  await longPress('renamed'); await tap('删除'); await wait('确认删除');
  await screenshot(`delete-${scale}`); await tap('确认删除'); await wait('nested.txt');
  await tap('hello.txt'); await wait('文件内容');
  await tap('文件浏览设置');
  if (await find('1 秒')) { await tap('1 秒'); await wait('关闭自动保存'); await tap('关闭自动保存'); }
  await tap('文件浏览设置');
  await checkEditor(ui, { name: 'hello.txt', content: `edited-text-${scale}`, scale });
  await tap('返回文件列表'); await tap('app.ts'); await wait('文件内容');
  await checkEditor(ui, { name: 'app.ts', content: `const%sversion=${scale}`, scale });
  await input('文件内容', 'unsaved-draft');
  await tap('关闭文件 app.ts'); await wait('保留文件修改？'); await screenshot(`unsaved-${scale}`);
  await tap('取消'); await wait('文件内容');
  assert.equal((await find('文件内容')).text, 'unsaved-draft');
  await tap('关闭文件浏览器'); await wait('远程文件浏览');
  await tap('远程文件浏览'); await wait('文件内容');
  assert.equal((await find('文件内容')).text, 'unsaved-draft', 'Draft survives closing and reopening SSH files');
  await tap('返回文件列表'); await wait('hello.txt'); await tap('hello.txt'); await wait('文件内容');
  assert.equal((await find('文件内容')).text, `edited-text-${scale}`, 'Switching tabs preserves each file');
  await back(); await wait('远程文件浏览');
  await tap('切换横屏'); await wait('切换竖屏');
  await tap('远程文件浏览'); await wait('文件内容');
  await screenshot(`file-editor-landscape-${scale}`);
  await tap('关闭文件浏览器'); await wait('远程文件浏览');
  await tap('切换竖屏'); await wait('切换横屏');
}

async function checkEditor(ui, { name, content, scale }) {
  const { tap, wait, find, input, screenshot } = ui;
  await screenshot(`file-editor-${name}-${scale}`);
  await input('文件内容', content); await tap('保存'); await wait('已保存');
  await screenshot(`file-saved-${name}-${scale}`);
  await tap(`关闭文件 ${name}`); await tap('返回文件列表'); await wait(name);
  await tap(name); await wait('文件内容');
  assert.equal((await find('文件内容')).text, content.replaceAll('%s', ' '), `${name} must save bytes and reopen`);
}
