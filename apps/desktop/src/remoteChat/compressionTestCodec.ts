import { deflateRawSync, inflateRawSync } from 'node:zlib';
import type { PacketCompressionFactory } from '../../../../shared/remote-chat/packetCompression';

// Tests use Node's native zlib, independently of the Rust and browser-native production implementations.
export const testPacketCompression: PacketCompressionFactory = () => ({
  compress: async bytes => deflateRawSync(bytes, { level: 1 }),
  decompress: async (bytes, length) => inflateRawSync(bytes, { maxOutputLength: length }),
  close() {},
});
