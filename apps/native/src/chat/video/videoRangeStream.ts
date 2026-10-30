import { t } from '../../i18n';
import { Buffer } from 'buffer';
import { getChatPolicy, MIB } from '../../../../../shared/remote-chat/policy';
import { VIDEO_CHUNK_BYTES, type VideoChunk, type VideoInfo } from '../../../../../shared/remote-chat/video';
import type { VideoRange } from './videoHttp';

export interface RangeSource {
  info: VideoInfo;
  read: (offset: number, length: number) => Promise<VideoChunk>;
}
/** Local playback failure whose message is already localized; callers show it by type, not by wording. */
export class VideoPlaybackError extends Error {}
export function checkVideoSize(size: number) {
  const limit = getChatPolicy().videoPreviewMaxMb;
  if (size > limit * MIB) throw new VideoPlaybackError(t("client.mobile.theVideoExceedsMbAndCannotBePlayed", { value1: limit }));
}

/** Pull one bounded chunk at a time; the socket write completes before the next remote read. */
export async function* videoRangeStream(source: RangeSource, range: VideoRange, signal: AbortSignal) {
  for (let offset = range.start; offset <= range.end;) {
    if (signal.aborted) return;
    checkVideoSize(source.info.size);
    const length = Math.min(VIDEO_CHUNK_BYTES, range.end - offset + 1);
    const chunk = await source.read(offset, length);
    if (signal.aborted) return;
    checkVideoSize(source.info.size);
    if (chunk.offset !== offset || typeof chunk.data !== 'string'
      || chunk.data.length !== Math.ceil(length / 3) * 4 || !/^[a-z\d+/]*={0,2}$/i.test(chunk.data)) {
      throw new VideoPlaybackError(t("client.mobile.videoLoadingInterruptedTryAgain"));
    }
    const bytes = Buffer.from(chunk.data, 'base64');
    if (bytes.length !== length) throw new VideoPlaybackError(t("client.mobile.videoLoadingInterruptedTryAgain"));
    yield bytes;
    offset += length;
  }
}
