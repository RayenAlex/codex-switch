import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const { patchDocumentPicker } = require('./patch-document-picker.cjs') as {
  patchDocumentPicker: (source: string) => string;
};
const source = readFileSync(join(dirname(require.resolve('expo-document-picker/package.json')),
  'android/src/main/java/expo/modules/documentpicker/DocumentPickerModule.kt'), 'utf8');

it('can run at install and prebuild without accumulating changes', () => {
  const patched = patchDocumentPicker(source);
  expect(patchDocumentPicker(patched)).toBe(patched);
  const windowsSource = patched.replace(/\r?\n/g, '\r\n');
  expect(patchDocumentPicker(windowsSource)).toBe(windowsSource);
});

it('requires review when the upstream lifecycle changes', () => {
  expect(() => patchDocumentPicker('changed source')).toThrow('source changed');
});
