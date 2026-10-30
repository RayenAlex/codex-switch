import { getRandomBytes } from 'expo-crypto';
import { RTCPeerConnection as NativePeerConnection } from 'react-native-webrtc';
import { RtcPeer } from '../../../../shared/remote-chat/rtcPeer';
import type { LoungeSyncTransport } from '../../../../shared/lounge/syncConnection';
import { createNativePacketCipher } from '../chat/packetCipher';
import { createMobilePacketCompression } from '../chat/packetCompression';

export const nativeLoungeSync: LoungeSyncTransport = {
  randomBytes: getRandomBytes,
  createPacketCipher: createNativePacketCipher,
  createPacketCompression: createMobilePacketCompression,
  // Native WebRTC implements the same DataChannel subset as the existing mobile remote-chat adapter.
  createPeer: options => new RtcPeer(options, () => (
    new NativePeerConnection({ iceServers: options.iceServers }) as unknown as RTCPeerConnection)),
};
