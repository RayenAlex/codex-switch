import { nativePacketCompression } from '../../../shared/remote-chat/nativePacketCompression';
import type { PacketCompressionFactory } from '../../../shared/remote-chat/packetCompression';
import { invoke } from './rpc';

/** The installed service shares the Rust worker implementation used by interactive desktop chat. */
export const createServicePacketCompression: PacketCompressionFactory = () => nativePacketCompression(async request => {
  const response = await invoke<{ data?: string; error?: string }>('service_native_path', {
    request: { operation: 'packet-codec', request },
  });
  if (response.error || typeof response.data !== 'string') throw new Error('Packet codec failed');
  return response.data;
});
