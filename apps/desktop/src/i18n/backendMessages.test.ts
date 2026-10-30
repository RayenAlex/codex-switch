import { afterEach, describe, expect, it } from 'vitest';
import { resources } from '@remoteai/i18n/client';
import { remoteErrorText, formatRemoteError } from '../../../../shared/localization/errors';
import { setInterfaceLanguage } from '../../../../shared/localization/interfaceLanguage';
import templateKeys from '@remoteai/i18n/error-templates';
const sourceCopy: Readonly<Record<string, string>> = resources.zh;
const backendEnglish = resources.en;
const backendRussian = resources.ru;
const featureCopyEnglish = Object.fromEntries(templateKeys.map(key => [key, sourceCopy[key]]));
const featureCopyRussian = featureCopyEnglish;
const chinese = /[\u4e00-\u9fff]/;
const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map(match => match[1]).sort();

describe('formatRemoteError', () => {
  afterEach(() => setInterfaceLanguage('zh'));

  it('uses the shared dictionaries and the interface language', () => {
    expect(formatRemoteError('zh', '取消')).toBe('取消');
    expect(formatRemoteError('en', '取消')).toBe('Cancel');
    expect(formatRemoteError('ru', '取消')).toBe('Отмена');
    expect(formatRemoteError('ru', '未匹配的后端内容')).toBe('未匹配的后端内容');
    expect(formatRemoteError('en', undefined)).toBe('undefined');
    setInterfaceLanguage('ru');
    expect(remoteErrorText('取消')).toBe('Отмена');
    expect(remoteErrorText('取消', 'en')).toBe('Cancel');
    setInterfaceLanguage('zh');
    expect(remoteErrorText('取消')).toBe('取消');
  });

  it('keeps backend dictionary placeholders and leaves no Chinese in translations', () => {
    for (const [source, value] of [...Object.entries(backendEnglish), ...Object.entries(backendRussian)]) {
      expect(placeholders(value), source).toEqual(placeholders(sourceCopy[source]));
      if (value !== sourceCopy[source]) expect(value, source).not.toMatch(chinese);
    }
  });

  it('matches every shared template against a message of its own shape', () => {
    for (const [language, dictionary] of [['en', featureCopyEnglish], ['ru', featureCopyRussian]] as const) {
      for (const source of Object.keys(dictionary)) {
        const original = sourceCopy[source];
        const names = placeholders(original);
        if (!names.length || !chinese.test(original.replace(/\{\w+\}/g, ''))) continue;
        const sample = original.replace(/\{(\w+)\}/g, (_, name: string) => `X${names.indexOf(name)}`);
        const result = formatRemoteError(language, sample);
        expect(typeof result, source).toBe('string');
        expect(result, `${language}: ${source}`).not.toBe(sample);
      }
    }
  });
});
