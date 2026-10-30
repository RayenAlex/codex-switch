// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { editedImageMessage, imageEditorHtml } from '../../../../shared/chat/imageEditorHtml';
import { MAX_CHAT_IMAGE_CHARS } from '../../../../shared/remote-chat/attachments';
import { createI18n } from '@remoteai/i18n';
import { resources } from '@remoteai/i18n/client';

const image = 'data:image/jpeg;base64,aW1hZ2U=';

it.each(['zh', 'en', 'ru', 'ja'] as const)('localizes image tools and dialogs on every surface in %s', language => {
  const translator = createI18n({ locale: language, resources });
  for (const options of [{}, { scriptUrl: '/image-editor.js' },
    { scriptUrl: '/image-editor.js', mode: 'direct' as const }]) {
    const html = imageEditorHtml(image, key => translator.text(key), language, options);
    const document = new DOMParser().parseFromString(html, 'text/html');
    expect(document.documentElement.lang).toBe(language === 'zh' ? 'zh-CN' : language);
    expect(document.querySelector('[data-tool="pen"]')?.textContent?.trim()).toBe(translator.t('client.shared.pen'));
    expect(document.querySelector('#colors')?.getAttribute('aria-label')).toBe(translator.t('client.shared.annotationColor'));
    expect(document.querySelector('#text-title')?.textContent).toBe(translator.t('client.shared.addText'));
    expect((document.querySelector('#undo')?.getAttribute('aria-label')
      ?? document.querySelector('#undo')?.textContent)?.trim())
      .toBe(translator.t('client.projectBrowser.undo'));
    expect(document.querySelector('#color-apply')?.textContent).toBe(translator.t('client.shared.useColor'));
    expect(document.body.textContent).not.toContain('client.shared.');
    if (language === 'en' || language === 'ru') expect(html).not.toMatch(/\p{Script=Han}/u);
  }
});

describe('image editor boundary', () => {
  it('accepts saved image data and ignores unrelated messages', () => {
    expect(editedImageMessage(JSON.stringify({ type: 'save', dataUrl: image }))).toBe(image);
    for (const message of [null, {}, { type: 'cancel' }, { type: 'save', dataUrl: 12 }]) {
      expect(editedImageMessage(JSON.stringify(message))).toBeNull();
    }
  });

  it('rejects remote URLs, invalid image data and oversized results', () => {
    for (const dataUrl of ['https://example.test/image.jpg', 'data:text/html;base64,aA==',
      'data:image/jpeg;base64,invalid<script>', image + 'a'.repeat(MAX_CHAT_IMAGE_CHARS)]) {
      expect(() => editedImageMessage(JSON.stringify({ type: 'save', dataUrl }))).toThrow();
      expect(() => imageEditorHtml(dataUrl)).toThrow();
    }
  });

  it('allows local images above the relay limit without changing remote limits', () => {
    const dataUrl = 'data:image/png;base64,' + 'a'.repeat(MAX_CHAT_IMAGE_CHARS);
    const message = JSON.stringify({ type: 'save', dataUrl });
    expect(imageEditorHtml(dataUrl, undefined, undefined, { mode: 'direct' })).toContain(dataUrl);
    expect(editedImageMessage(message, 'direct')).toBe(dataUrl);
    expect(() => imageEditorHtml(dataUrl)).toThrow();
    expect(() => editedImageMessage(message)).toThrow();
    expect(() => imageEditorHtml('https://example.test/image.png', undefined, undefined,
      { mode: 'direct' })).toThrow();
  });
});
