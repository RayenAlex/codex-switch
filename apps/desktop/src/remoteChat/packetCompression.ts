import { invoke } from '@tauri-apps/api/core';
import { nativePacketCompression } from '../../../../shared/remote-chat/nativePacketCompression';
import type { PacketCompressionFactory } from '../../../../shared/remote-chat/packetCompression';
import { createBrowserPacketCompression } from '../../../../shared/remote-chat/browserPacketCompression';

export const createDesktopPacketCompression: PacketCompressionFactory = () => {
  if (!('__TAURI_INTERNALS__' in globalThis)) return createBrowserPacketCompression();
  return nativePacketCompression(request => invoke<string>('remote_chat_packet_codec', { request }));
};
