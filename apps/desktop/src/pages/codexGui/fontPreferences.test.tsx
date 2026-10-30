// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import {
  saveGlobalFontSize, saveGuiFontSize, setGuiFollowGlobal, useGlobalFontSize, useGuiFontSize, useGuiFollowGlobal,
} from '../../../../../shared/appearance/fontSize';

let root: Root;
let host: HTMLDivElement;

function Preferences() {
  return <output>{JSON.stringify({ global: useGlobalFontSize(), gui: useGuiFontSize(),
    follow: useGuiFollowGlobal() })}</output>;
}

const snapshot = () => JSON.parse(host.textContent ?? '{}');
const render = () => act(() => root.render(<Preferences />));

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  localStorage.clear();
  host = document.createElement('div');
  root = createRoot(host);
});
afterEach(() => { act(() => root.unmount()); localStorage.clear(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it('follows global changes until customized, and resumes following when re-enabled', () => {
  render();
  expect(snapshot()).toEqual({ global: 14, gui: 14, follow: true });
  act(() => { saveGlobalFontSize(20); });
  expect(snapshot()).toEqual({ global: 20, gui: 20, follow: true });
  act(() => { saveGuiFontSize(18); saveGlobalFontSize(24); });
  expect(snapshot()).toEqual({ global: 24, gui: 18, follow: false });
  act(() => { setGuiFollowGlobal(true); });
  expect(snapshot()).toEqual({ global: 24, gui: 24, follow: true });
  act(() => { saveGlobalFontSize(16); });
  expect(snapshot()).toEqual({ global: 16, gui: 16, follow: true });
});

it('turning off follow freezes the current size, including after remounting', () => {
  saveGlobalFontSize(20); render();
  act(() => { setGuiFollowGlobal(false); saveGlobalFontSize(14); });
  act(() => root.unmount()); root = createRoot(host); render();
  expect(snapshot()).toEqual({ global: 14, gui: 20, follow: false });
});

it.each([14, 18])('preserves the existing explicit GUI size %s on upgrade', size => {
  localStorage.setItem('codex-switch:gui-font-size', String(size));
  saveGlobalFontSize(22); render();
  expect(snapshot()).toEqual({ global: 22, gui: size, follow: false });
});

it.each(['null', '"20"', '{broken', '{}'])('inherits for corrupt legacy data %s', stored => {
  localStorage.setItem('codex-switch:gui-font-size', stored);
  saveGlobalFontSize(18); render();
  expect(snapshot()).toEqual({ global: 18, gui: 18, follow: true });
});

it('updates global and custom sizes across windows and when preferences are cleared', () => {
  render();
  act(() => {
    localStorage.setItem('codex-switch:global-font-size', '21');
    window.dispatchEvent(new StorageEvent('storage'));
  });
  expect(snapshot()).toEqual({ global: 21, gui: 21, follow: true });
  act(() => {
    localStorage.setItem('codex-switch:gui-font-size', '16');
    window.dispatchEvent(new StorageEvent('storage'));
  });
  expect(snapshot().gui).toBe(16);
  act(() => { localStorage.clear(); window.dispatchEvent(new StorageEvent('storage')); });
  expect(snapshot()).toEqual({ global: 14, gui: 14, follow: true });
});

it('keeps the saved state and reports failed writes or a failed return to global', () => {
  saveGuiFontSize(18); render();
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('full'); });
  vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new Error('denied'); });
  act(() => {
    expect(saveGlobalFontSize(24)).toBe(false);
    expect(saveGuiFontSize(20)).toBe(false);
    expect(setGuiFollowGlobal(true)).toBe(false);
  });
  expect(snapshot()).toEqual({ global: 14, gui: 18, follow: false });
});
