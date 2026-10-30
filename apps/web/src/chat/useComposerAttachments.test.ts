import { afterEach, expect, it } from 'vitest';
import { translateMessage } from "../../../../shared/localization/messages";
import { setLanguage } from '../i18n';
import { AttachmentRejection, attachmentErrorMessage } from './useComposerAttachments';

afterEach(() => setLanguage('zh'));

it('shows validator copy that was already localized when thrown', () => {
  setLanguage('en');
  const message = 'Each file must be 2 MB or smaller. Choose a smaller file.';
  expect(attachmentErrorMessage(new AttachmentRejection(message))).toBe(message);
});

it('translates Chinese validator copy at render time', () => {
  setLanguage('ru');
  const source = "client.chat.couldNotReadTheFilePleaseChooseItAgain";
  expect(attachmentErrorMessage(new AttachmentRejection(source))).toBe(translateMessage('ru', source));
  expect(attachmentErrorMessage(new AttachmentRejection(source))).not.toBe(source);
});

it('keeps Chinese output unchanged', () => {
  setLanguage('zh');
  expect(attachmentErrorMessage(new AttachmentRejection('文件无法读取，请重新选择。'))).toBe('文件无法读取，请重新选择。');
  expect(attachmentErrorMessage(new TypeError('boom'))).toBe('文件添加失败，请重新选择。');
});

it('hides unexpected failures behind the generic message regardless of wording', () => {
  setLanguage('en');
  const fallback = translateMessage('en', "client.chat.couldNotAddTheFilePleaseChooseItAgain");
  expect(attachmentErrorMessage(new Error('文件 internal failure'))).toBe(fallback);
  expect(attachmentErrorMessage('附件')).toBe(fallback);
});
