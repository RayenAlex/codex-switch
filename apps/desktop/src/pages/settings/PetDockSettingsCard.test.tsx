// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { petDockApi } from '../../api/petDock';
import { quotaDisplayApi } from '../../api/quotaDisplay';
import type { AppSettings } from '../../types';
import { translate } from '../../i18n';
import { PetDockSettingsCard } from './PetDockSettingsCard';
import type { PetDockStatus } from '../../../../../shared/pet-dock/types';

vi.mock('../../api/petDock', () => ({ petDockApi: { load: vi.fn(), save: vi.fn(), saveLabels: vi.fn() } }));
vi.mock('../../api/quotaDisplay', () => ({ quotaDisplayApi: {
  supported: true, load: vi.fn(), save: vi.fn(),
} }));
let root: Root;
let container: HTMLDivElement;
const checked = () => container.querySelector('[role="switch"]')?.getAttribute('aria-checked');
const t = (key: Parameters<typeof translate>[1]) => translate('zh', key);
const click = () => act(async () => container.querySelector<HTMLButtonElement>('[role="switch"]')!.click());

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  vi.mocked(petDockApi.load).mockReset().mockResolvedValue({ enabled: false, showLabels: false, state: 'disabled' });
  vi.mocked(petDockApi.save).mockReset().mockResolvedValue({ enabled: true, showLabels: false, state: 'waitingForCodex' });
  vi.mocked(petDockApi.saveLabels).mockReset().mockResolvedValue({ enabled: true, showLabels: true, state: 'active' });
  vi.mocked(quotaDisplayApi.load).mockReset().mockResolvedValue({ enabled: false, average: null });
  vi.mocked(quotaDisplayApi.save).mockReset();
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it('shows the saved preference, enables it, and displays the actual connection state', async () => {
  await act(async () => root.render(<PetDockSettingsCard t={t} />));
  expect(checked()).toBe('false');
  await click();
  expect(petDockApi.save).toHaveBeenCalledWith(true);
  expect(checked()).toBe('true');
  expect(container.textContent).toContain(t('settings.petDock.waitingForCodex'));
});

it('changes the third switch independently of dock visibility and text labels', async () => {
  await act(async () => root.render(<PetDockSettingsCard t={t} />));
  const average = container.querySelector<HTMLButtonElement>('#quota-display-all-accounts')!;
  expect(container.querySelectorAll('[role="switch"]')).toHaveLength(3);
  expect(average.disabled).toBe(false);
  vi.mocked(quotaDisplayApi.save).mockResolvedValue({ quotaDisplayAllAccounts: true } as AppSettings);
  vi.mocked(quotaDisplayApi.load).mockResolvedValue({ enabled: true, average: null });
  await act(async () => average.click());
  expect(quotaDisplayApi.save).toHaveBeenCalledWith(true);
  expect(average.getAttribute('aria-checked')).toBe('true');
  expect(petDockApi.save).not.toHaveBeenCalled();
  expect(petDockApi.saveLabels).not.toHaveBeenCalled();
});

it('serializes the three controls while the average preference is being saved', async () => {
  vi.mocked(petDockApi.load).mockResolvedValue({ enabled: true, showLabels: false, state: 'active' });
  await act(async () => root.render(<PetDockSettingsCard t={t} />));
  let resolve!: (settings: AppSettings) => void;
  vi.mocked(quotaDisplayApi.save).mockImplementation(() => new Promise(done => { resolve = done; }));
  await act(async () => container.querySelector<HTMLButtonElement>('#quota-display-all-accounts')!.click());
  expect([...container.querySelectorAll<HTMLButtonElement>('[role="switch"]')]
    .every(control => control.disabled)).toBe(true);
  await act(async () => resolve({ quotaDisplayAllAccounts: true } as AppSettings));
});

it('keeps the previous setting and offers retry if saving fails', async () => {
  vi.mocked(petDockApi.load).mockResolvedValue({ enabled: true, showLabels: false, state: 'active' });
  vi.mocked(petDockApi.save).mockRejectedValue(new Error('service unavailable'));
  await act(async () => root.render(<PetDockSettingsCard t={t} />));
  await click();
  expect(petDockApi.save).toHaveBeenCalledWith(false);
  expect(checked()).toBe('true');
  expect(container.querySelector('[role="alert"]')?.textContent).toContain(t('settings.petDock.saveError'));
});

it('does not overlap status polling, and stops polling after unmount', async () => {
  let resolve!: (status: PetDockStatus) => void;
  vi.mocked(petDockApi.load).mockImplementation(() => new Promise((done) => { resolve = done; }));
  await act(async () => root.render(<PetDockSettingsCard t={t} />));
  await act(async () => { await vi.advanceTimersByTimeAsync(10_000); });
  expect(petDockApi.load).toHaveBeenCalledTimes(1);
  await act(async () => resolve({ enabled: true, showLabels: false, state: 'active' }));
  await act(async () => root.render(null));
  await act(async () => { await vi.advanceTimersByTimeAsync(10_000); });
  expect(petDockApi.load).toHaveBeenCalledTimes(1);
});

it('honors a switch click during polling and ignores the earlier status response', async () => {
  await act(async () => root.render(<PetDockSettingsCard t={t} />));
  let resolve!: (status: PetDockStatus) => void;
  vi.mocked(petDockApi.load).mockImplementation(() => new Promise((done) => { resolve = done; }));
  await act(async () => { await vi.advanceTimersByTimeAsync(2_500); });
  await click();
  expect(checked()).toBe('true');
  await act(async () => resolve({ enabled: false, showLabels: false, state: 'disabled' }));
  expect(checked()).toBe('true');
});

it('shows platform limits and disables the switch on unsupported hosts', async () => {
  vi.mocked(petDockApi.load).mockResolvedValue({ enabled: false, showLabels: false, state: 'unsupported' });
  await act(async () => root.render(<PetDockSettingsCard t={t} />));
  expect(container.querySelector<HTMLButtonElement>('[role="switch"]')?.disabled).toBe(true);
  expect(container.textContent).toContain(t('settings.petDock.unsupported'));
});

const labelSwitch = () => container.querySelector<HTMLButtonElement>('#pet-quota-dock-labels')!;
const clickLabels = () => act(async () => labelSwitch().click());

it('saves text labels independently and preserves the active dock', async () => {
  vi.mocked(petDockApi.load).mockResolvedValue({ enabled: true, showLabels: false, state: 'active' });
  await act(async () => root.render(<PetDockSettingsCard t={t} />));
  expect(labelSwitch().getAttribute('aria-checked')).toBe('false');
  await clickLabels();
  expect(petDockApi.saveLabels).toHaveBeenCalledWith(true);
  expect(petDockApi.save).not.toHaveBeenCalled();
  expect(labelSwitch().getAttribute('aria-checked')).toBe('true');
  expect(checked()).toBe('true');
});

it('keeps the saved label preference visible but disabled when the dock is off', async () => {
  vi.mocked(petDockApi.load).mockResolvedValue({ enabled: false, showLabels: true, state: 'disabled' });
  await act(async () => root.render(<PetDockSettingsCard t={t} />));
  expect(labelSwitch().disabled).toBe(true);
  expect(labelSwitch().getAttribute('aria-checked')).toBe('true');
});

it('keeps the label preference and offers retry when label saving fails', async () => {
  vi.mocked(petDockApi.load).mockResolvedValue({ enabled: true, showLabels: true, state: 'active' });
  vi.mocked(petDockApi.saveLabels).mockRejectedValue(new Error('service unavailable'));
  await act(async () => root.render(<PetDockSettingsCard t={t} />));
  await clickLabels();
  expect(petDockApi.saveLabels).toHaveBeenCalledWith(false);
  expect(labelSwitch().getAttribute('aria-checked')).toBe('true');
  expect(container.querySelector('[role="alert"]')?.textContent).toContain(t('settings.petDock.saveError'));
});

it('ignores an earlier poll and serializes the two switches while labels are saving', async () => {
  vi.mocked(petDockApi.load).mockResolvedValue({ enabled: true, showLabels: false, state: 'active' });
  await act(async () => root.render(<PetDockSettingsCard t={t} />));
  let resolvePoll!: (status: PetDockStatus) => void;
  let resolveSave!: (status: PetDockStatus) => void;
  vi.mocked(petDockApi.load).mockImplementation(() => new Promise((done) => { resolvePoll = done; }));
  vi.mocked(petDockApi.saveLabels).mockImplementation(() => new Promise((done) => { resolveSave = done; }));
  await act(async () => { await vi.advanceTimersByTimeAsync(2_500); });
  await clickLabels();
  expect(labelSwitch().disabled).toBe(true);
  expect(container.querySelector<HTMLButtonElement>('#pet-quota-dock')?.disabled).toBe(true);
  await click();
  expect(petDockApi.save).not.toHaveBeenCalled();
  await act(async () => resolveSave({ enabled: true, showLabels: true, state: 'active' }));
  await act(async () => resolvePoll({ enabled: true, showLabels: false, state: 'active' }));
  expect(labelSwitch().getAttribute('aria-checked')).toBe('true');
});
