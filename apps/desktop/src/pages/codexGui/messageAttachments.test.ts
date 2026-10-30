import { expect, it } from 'vitest';
import { messageAttachments } from '../../../../../shared/chat/messageAttachments';
import { quotedMessage } from '../../../../../shared/chat/quotedMessage';

it('extracts historical files and folders while preserving the surrounding user text', () => {
  const path = 'C:\\Users\\CXR\\诊断 日志\\attachment-report.jsonl';
  expect(messageAttachments(`看看这个日志\r\n文件： ${path}\r\n文件夹：/home/user/project\r\n继续检查`)).toEqual({
    text: '看看这个日志\n继续检查', references: [], attachments: [
      { kind: 'file', name: 'attachment-report.jsonl', path },
      { kind: 'folder', name: 'project', path: '/home/user/project' },
    ],
  });
});

it('keeps ordinary prose, quoted examples, code fences and malformed paths unchanged', () => {
  const source = '  保留格式\r\n文件：说明文字\r\n文件：relative.txt\r\n这里的文件：C:/a.txt\r\n'
    + '> 文件：C:/quote.txt\r\n    文件：C:/indented.txt\r\n文件：https://example.com/a.txt\r\n'
    + '```text\r\n文件：C:/code.txt\r\n```\r\n~~~\r\n文件：/code.txt\r\n~~~\r\n';
  expect(messageAttachments(source)).toEqual({ text: source, attachments: [], references: [] });
});

it('leaves attachment-looking text inside reply quotes and extracts files after them', () => {
  const message = quotedMessage('引用对话内容：\n> 文件：C:/quote.txt\n\n请检查\n文件：C:/real.txt');
  expect(message.quotes).toEqual(['文件：C:/quote.txt']);
  expect(messageAttachments(message.text).attachments.map(file => file.path)).toEqual(['C:/real.txt']);
});

it('combines live mentions and saved paths without duplicate files or losing other references', () => {
  const plugin = { name: 'Documents', path: 'plugin://documents' };
  const conversation = { name: 'Previous chat', path: 'codex-thread://thread' };
  const result = messageAttachments('文件：C:/report.txt\n文件：C:/report.txt', [
    { name: '诊断报告', path: 'C:/report.txt' }, { name: 'upload.txt', path: '' }, plugin, conversation,
  ]);
  expect(result.text).toBe('');
  expect(result.attachments).toEqual([
    { kind: 'file', name: '诊断报告', path: 'C:/report.txt' },
    { kind: 'file', name: 'upload.txt', path: '' },
  ]);
  expect(result.references).toEqual([plugin, conversation]);
});

it('keeps literal percent signs and network paths intact for display', () => {
  expect(messageAttachments('文件：\\\\server\\share\\100% report.txt').attachments).toEqual([
    { kind: 'file', name: '100% report.txt', path: '\\\\server\\share\\100% report.txt' },
  ]);
});
