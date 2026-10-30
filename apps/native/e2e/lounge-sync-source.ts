import { historyKey, historyPage, type LoungeHistoryStore } from '../../../shared/lounge/archive';
import { SyncArchive } from '../../../shared/lounge/syncArchive';
import { HistorySyncConnection } from '../../../shared/lounge/syncConnection';
import { LoungeSyncBroker } from '../../../shared/lounge/testing/syncBroker';
import { mergeDelivery } from '../../../shared/lounge/delivery';
import type { LoungeMessage } from '../../../shared/lounge/types';

export function createHistorySource() {
  const broker = new LoungeSyncBroker();
  const rows = new Map<string, LoungeMessage>();
  const store: LoungeHistoryStore = {
    get: async key => rows.get(key),
    save: async value => {
      rows.set(historyKey(value), { ...value,
        delivery: mergeDelivery(rows.get(historyKey(value))?.delivery, value.delivery) });
    },
    page: async query => historyPage([...rows.values()]
      .sort((a, b) => Date.parse(b.sentAt) - Date.parse(a.sentAt) || historyKey(b).localeCompare(historyKey(a)))
      .filter(value => !query.before || Date.parse(value.sentAt) < query.before.time
        || Date.parse(value.sentAt) === query.before.time && historyKey(value) < query.before.key), query),
  };
  let connection: HistorySyncConnection | undefined;
  const add = (text: string, images: string[] = [], direct = false) => {
    const message: LoungeMessage = { type: 'message', id: crypto.randomUUID(), text, images,
      sender: { id: 'bob', account: 'bob@example.test' }, sentAt: new Date().toISOString(),
      ...(direct ? { recipient: { id: 'alice', account: 'alice@example.test' }, conversation: 'bob', generation: 0,
        delivery: { direction: 'incoming', status: 'delivered', confirmed: 'delivered' } } : {}) };
    rows.set(historyKey(message), message); connection?.changed(historyKey(message));
    return message;
  };
  return {
    broker, add,
    hasText: (text: string) => [...rows.values()].some(message => message.text === text),
    read: (id: string) => rows.get(id)?.delivery?.status === 'read',
    start(baseUrl: string) {
      const archive = new SyncArchive({ owner: 'alice', store, current: () => true, accept: () => true,
        restored: () => {}, flush: async () => {} });
      connection = new HistorySyncConnection({ baseUrl, deviceId: 'other-device', archive,
        authorize: async () => ({ ticket: 'fixture-ticket' }), error: () => {},
        transport: { randomBytes: size => crypto.getRandomValues(new Uint8Array(size)),
          createPeer: () => { throw new Error('Test source uses the existing relay'); } } });
      connection.start();
    },
    stop() { connection?.stop(); broker.disconnectAll(); },
  };
}
