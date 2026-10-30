import { resources as clientResources } from '@remoteai/i18n/client';
const english: Readonly<Record<string, string>> = clientResources.en;
const russian: Readonly<Record<string, string>> = clientResources.ru;
import { expect, it } from 'vitest';



const chinese = /[一-鿿]/;
const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map(match => match[1]).sort();
const russianCopy: Readonly<Record<string, string>> = russian;

it('gives every shared English string a Russian translation', () => {
  const missing = Object.keys(english).filter(source => !Object.hasOwn(russianCopy, source));
  expect(missing).toEqual([]);
});

it('keeps the placeholders of every shared English string in Russian, without Chinese text', () => {
  for (const source of Object.keys(english)) {
    const value = russianCopy[source] ?? '';
    expect(placeholders(value), source).toEqual(placeholders(clientResources.zh[source as keyof typeof clientResources.zh]));
    expect(value, source).not.toMatch(chinese);
  }
});
