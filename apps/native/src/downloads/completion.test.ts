import { afterEach, expect, it } from 'vitest';
import { downloadCompletionDetails } from '../../../../shared/downloads/completion';
import { setInterfaceLanguage } from '../../../../shared/localization/interfaceLanguage';

const createdAt = new Date(2026, 9, 25, 14, 0, 0).getTime();
const duration = (milliseconds: number) => downloadCompletionDetails({
  createdAt, completedAt: createdAt + milliseconds,
}).duration;

afterEach(() => setInterfaceLanguage('zh'));

it('formats elapsed time across subsecond, minute, hour and day boundaries', () => {
  expect(duration(0)).toBe('总用时：不到1秒');
  expect(duration(999)).toBe('总用时：不到1秒');
  expect(duration(1000)).toBe('总用时：1秒');
  expect(duration(59_999)).toBe('总用时：59秒');
  expect(duration(60_000)).toBe('总用时：1分0秒');
  expect(duration(3_661_000)).toBe('总用时：1小时1分1秒');
  expect(duration(90_061_000)).toBe('总用时：25小时1分1秒');
});

it('does not invent timing for legacy records or invalid clocks', () => {
  expect(downloadCompletionDetails({ createdAt })).toEqual({
    completedAt: '', duration: '', summary: '',
  });
  for (const completedAt of [NaN, Infinity, Number.MAX_VALUE]) {
    expect(downloadCompletionDetails({ createdAt, completedAt }).summary).toBe('');
  }
  expect(duration(-1)).toBe('');
  expect(downloadCompletionDetails({ createdAt: NaN, completedAt: createdAt })).toEqual({
    completedAt: '完成时间：2026/10/25 14:00:00', duration: '', summary: '2026/10/25 14:00:00',
  });
});

it('follows language changes with the offline client resources', () => {
  setInterfaceLanguage('en');
  expect(duration(3_661_000)).toBe('Total time: 1 hr 1 min 1 sec');
  setInterfaceLanguage('ru');
  expect(duration(61_000)).toBe('Общее время: 1 мин 1 с');
  setInterfaceLanguage('ja');
  expect(duration(3_661_000)).toBe('合計時間：1時間1分1秒');
});
