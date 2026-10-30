import { createBrowserPacketCompression } from '../../../shared/remote-chat/browserPacketCompression';

window.packetCodecCheck = async (input, encoded) => {
  const codec = createBrowserPacketCompression();
  if (!codec) throw new Error('Native browser codec unavailable');
  const bytes = Uint8Array.from(input);
  let ticks = 0;
  const timer = setInterval(() => { ticks++; }, 1);
  try {
    let compressed = new Uint8Array();
    for (let index = 0; index < 80; index++) {
      compressed = await codec.compress(bytes);
      const decoded = await codec.decompress(compressed, bytes.length);
      if (decoded.some((byte, offset) => byte !== bytes[offset])) throw new Error('Round trip failed');
    }
    const external = await codec.decompress(Uint8Array.from(encoded), bytes.length);
    let bounded = false, truncated = false, trailing = false;
    try { await codec.decompress(compressed, 1); } catch { bounded = true; }
    try { await codec.decompress(compressed.slice(0, -1), bytes.length); } catch { truncated = true; }
    const extra = new Uint8Array(compressed.length + 1); extra.set(compressed);
    try { await codec.decompress(extra, bytes.length); } catch { trailing = true; }
    return { compressed: [...compressed], external: [...external], ticks, bounded, truncated, trailing };
  } finally { clearInterval(timer); codec.close(); }
};

declare global {
  interface Window {
    packetCodecCheck: (input: number[], encoded: number[]) => Promise<{
      compressed: number[]; external: number[]; ticks: number; bounded: boolean; truncated: boolean; trailing: boolean;
    }>;
  }
}
