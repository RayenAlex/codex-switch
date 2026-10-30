import { DesktopReceiver } from '../../../shared/remote-desktop/receiver';
import { DEFAULT_SETTINGS, desktopClient } from '../../../shared/remote-desktop/protocol';
import type { RemoteDesktopHost } from '../../desktop/src/remoteDesktop/host';

export function createTakeoverFixture(host: RemoteDesktopHost) {
  let viewer: DesktopReceiver | undefined;
  const state = { ready: false, failures: [] as string[],
    closed: () => viewer?.closed ?? true,
    connect: async () => {
      await viewer?.stop();
      host.register('previous-viewer', []);
      state.ready = false;
      viewer = new DesktopReceiver({
        client: desktopClient(async <T>(body: object) => await host.request(body, 'previous-viewer') as T),
        createPeer: config => new RTCPeerConnection(config),
        stream: stream => { state.ready = !!stream; }, status: () => {}, stats: () => {},
        failed: message => { state.failures.push(message); },
      });
      await viewer.start(DEFAULT_SETTINGS);
    },
  };
  return state;
}

declare global { interface Window { desktopTakeoverTest: ReturnType<typeof createTakeoverFixture> } }
