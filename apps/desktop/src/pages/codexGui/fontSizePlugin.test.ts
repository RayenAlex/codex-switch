import postcss from 'postcss';
import { expect, it } from 'vitest';
import { fontSizePlugin } from '../../../../../shared/appearance/fontSizePlugin';

it('scales pixel fonts and line heights without changing layout or relative typography', async () => {
  const source = '.label {font: 600 14px/20px sans-serif; width: 200px; padding: 12px}'
    + '.heading {font-size: clamp(24px, 3vw, 32px); line-height: 1.5}'
    + '.code {font-size: .9em}';
  const result = await postcss([fontSizePlugin()]).process(source, { from: undefined });
  expect(result.css).toContain('font: 600 calc(14px * var(--app-font-scale, 1))/'
    + 'calc(20px * var(--app-font-scale, 1)) sans-serif');
  expect(result.css).toContain('width: 200px; padding: 12px');
  expect(result.css).toContain('clamp(calc(24px * var(--app-font-scale, 1)), 3vw, '
    + 'calc(32px * var(--app-font-scale, 1)))');
  expect(result.css).toContain('font-size: .9em');
  expect(result.css).toContain('line-height: 1.5');
  expect((await postcss([fontSizePlugin()]).process(result.css, { from: undefined })).css).toBe(result.css);
});

it('leaves explicit GUI sizes unchanged so they are never scaled twice', async () => {
  const source = '.gui {font-size: calc(var(--gui-font-size, 14px) - 2px); line-height: max(18px, 1.4em)}';
  const result = await postcss([fontSizePlugin()]).process(source, { from: undefined });
  expect(result.css).toContain('font-size: calc(var(--gui-font-size, 14px) - 2px)');
  expect(result.css).toContain('max(calc(18px * var(--app-font-scale, 1)), 1.4em)');
});
