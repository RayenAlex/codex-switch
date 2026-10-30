import { NativeModules } from 'react-native';
import { nativePacketCompression } from '../../../../shared/remote-chat/nativePacketCompression';
import type { PacketCompressionFactory } from '../../../../shared/remote-chat/packetCompression';

interface ConnectivityCodec {
  packetCompression?: boolean;
  call(request: string): Promise<string>;
  packetCodec?(request: string): Promise<string>;
}

export const createMobilePacketCompression: PacketCompressionFactory = () => {
  const module = NativeModules.ChatConnectivity as ConnectivityCodec | undefined;
  if (!module?.packetCompression) return undefined;
  return nativePacketCompression(async request => {
    const call = module.packetCodec ?? module.call;
    const result = JSON.parse(await call(JSON.stringify({ operation: 'packet-codec', request }))) as {
      data?: string; error?: string;
    };
    if (result.error || typeof result.data !== 'string') throw new Error('Packet codec failed');
    return result.data;
  });
};
