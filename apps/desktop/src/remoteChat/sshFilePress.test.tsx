// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { showSshKeyboardMenu, useSshFilePress } from '../../../../shared/terminal/useSshFilePress';

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

async function fixture() {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true); vi.useFakeTimers();
  const target = document.createElement('div'); document.body.append(target);
  const root = createRoot(target);
  const open = vi.fn(); const menu = vi.fn();
  function Fixture({ disabled = false }: { disabled?: boolean }) {
    const press = useSshFilePress(disabled);
    return <ul {...press.events} onContextMenu={event => { event.preventDefault(); menu(); }}>
      <li><button data-ssh-path="/note.txt" onClick={open}>note.txt</button></li>
    </ul>;
  }
  await act(async () => root.render(<Fixture />));
  const button = target.querySelector('button')!;
  const pointer = (type: string, x = 10, y = 10) => {
    const event = new MouseEvent(type, { bubbles: true, cancelable: true, button: 0, clientX: x, clientY: y });
    Object.defineProperties(event, { isPrimary: { value: true }, pointerId: { value: 1 } });
    button.dispatchEvent(event);
  };
  return { target, root, button, open, menu, pointer,
    disable: () => act(async () => root.render(<Fixture disabled />)),
    stop: async () => { await act(async () => root.unmount()); target.remove(); } };
}

it('opens a menu after holding an entry and suppresses its release click, then allows the next tap', async () => {
  const f = await fixture();
  try {
    await act(async () => { f.pointer('pointerdown'); vi.advanceTimersByTime(500); });
    expect(f.menu).toHaveBeenCalledOnce();
    await act(async () => { f.pointer('pointerup'); f.button.click(); });
    expect(f.open).not.toHaveBeenCalled();
    await act(async () => { f.pointer('pointerdown'); f.pointer('pointerup'); f.button.click(); });
    expect(f.open).toHaveBeenCalledOnce();
  } finally { await f.stop(); }
});

it('does not open a menu during scrolling, a cancelled gesture, or a short tap', async () => {
  const f = await fixture();
  try {
    await act(async () => { f.pointer('pointerdown'); f.pointer('pointermove', 10, 40); vi.advanceTimersByTime(600); });
    await act(async () => { f.pointer('pointerdown'); f.pointer('pointercancel'); vi.advanceTimersByTime(600); });
    await act(async () => { f.pointer('pointerdown'); f.pointer('pointerup'); vi.advanceTimersByTime(600); });
    expect(f.menu).not.toHaveBeenCalled();
  } finally { await f.stop(); }
});

it('cancels pending holds when disabled or unmounted', async () => {
  const f = await fixture();
  await act(async () => f.pointer('pointerdown'));
  await f.disable();
  await act(async () => vi.advanceTimersByTime(600));
  expect(f.menu).not.toHaveBeenCalled();
  await f.stop();
  expect(vi.getTimerCount()).toBe(0);
});

it('uses the same context menu event for keyboard actions', async () => {
  const f = await fixture();
  try {
    await act(async () => showSshKeyboardMenu(f.button));
    expect(f.menu).toHaveBeenCalledOnce(); expect(f.open).not.toHaveBeenCalled();
  } finally { await f.stop(); }
});
