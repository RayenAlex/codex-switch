import { displayText } from '../../i18n/index';
import { afterEach, expect, it, vi } from 'vitest';
import { DEFAULT_CHAT_POLICY, MIB, setChatPolicy } from '../../../../../shared/remote-chat/policy';
import { setInterfaceLanguage } from "../../../../../shared/localization/interfaceLanguage";
import { translateMessage } from "../../../../../shared/localization/messages";
import { checkVideoSize, VideoPlaybackError, videoRangeStream } from './videoRangeStream';
import { videoErrorMessage } from './useVideoStream';

vi.mock('react-native', () => ({ AppState: { currentState: 'active', addEventListener: vi.fn() } }));
vi.mock('react-native-tcp-socket', () => ({ default: { createServer: vi.fn() } }));

const GENERIC = "client.mobile.cannotPlayTheVideoCheckYourComputerConnectionAndTry";
const info = { id: '12345678-1234-4234-a234-123456789012', size: 3, mimeType: 'video/mp4' as const };
const thrown = (action: () => unknown) => {
  try { action(); } catch (error) { return error; }
  throw new Error('Expected the action to throw.');
};
afterEach(() => { setInterfaceLanguage('zh'); setChatPolicy(DEFAULT_CHAT_POLICY); });

it.each(['en', 'ru'] as const)('shows localized playback limits and interruptions in %s', async (language) => {
  setInterfaceLanguage(language);
  setChatPolicy({ ...DEFAULT_CHAT_POLICY, videoPreviewMaxMb: 1 });
  const limit = thrown(() => checkVideoSize(MIB + 1));
  expect(limit).toBeInstanceOf(VideoPlaybackError);
  expect(videoErrorMessage(limit)).toBe(translateMessage(language, "client.mobile.theVideoExceedsMbAndCannotBePlayed", { value1: 1 }));
  expect(videoErrorMessage(limit)).not.toBe(displayText(GENERIC, {}, language));
  const stream = videoRangeStream({ info, read: async () => ({ offset: 1, data: 'AAAA' }) },
    { start: 0, end: 2, partial: true }, new AbortController().signal);
  const interrupted = await stream.next().catch((error: unknown) => error);
  expect(interrupted).toBeInstanceOf(VideoPlaybackError);
  expect(videoErrorMessage(interrupted)).toBe(translateMessage(language, "client.mobile.videoLoadingInterruptedTryAgain"));
});

it('keeps host video errors for display-time translation and hides unrelated failures', () => {
  setInterfaceLanguage('en');
  const host = '视频暂时无法读取，请确认文件可访问，且格式为 MP4、MOV 或 WebM。';
  expect(videoErrorMessage(new Error(host))).toBe(host);
  expect(videoErrorMessage(new Error('Video connection closed'))).toBe(displayText(GENERIC, {}, 'en'));
  expect(videoErrorMessage('视频')).toBe(displayText(GENERIC, {}, 'en'));
});

it('keeps the Chinese playback messages byte-identical', () => {
  setChatPolicy({ ...DEFAULT_CHAT_POLICY, videoPreviewMaxMb: 1 });
  expect(videoErrorMessage(thrown(() => checkVideoSize(MIB + 1)))).toBe('视频超过 1 MB，无法播放。');
  expect(videoErrorMessage(new Error('Video connection closed'))).toBe(displayText(GENERIC, {}, 'zh'));
});
