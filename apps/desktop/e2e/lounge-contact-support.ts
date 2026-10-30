import type { WebSocketRoute } from '@playwright/test';
import type { LoungeAccount } from '../../../shared/lounge/types';

export class LoungeContactsFixture {
  users: LoungeAccount[] = [];
  fail = false;
  requests: string[] = [];
  private routes = new Set<WebSocketRoute>();

  handle(route: WebSocketRoute, frame: Record<string, unknown>) {
    if (frame.type === 'authenticate') this.routes.add(route);
    if (frame.type !== 'sync-contacts') return;
    this.requests.push(String(frame.cursor ?? ''));
    if (this.fail) { route.send(JSON.stringify({ type: 'saved-contacts', id: frame.id, error: true })); return; }
    const remaining = this.users.filter(user => user.id > String(frame.cursor ?? ''))
      .sort((first, second) => first.id.localeCompare(second.id));
    const page = remaining.slice(0, 200);
    route.send(JSON.stringify({ type: 'saved-contacts', id: frame.id, users: page,
      ...(remaining.length > 200 ? { cursor: page.at(-1)?.id } : {}) }));
  }

  changed() {
    for (const route of this.routes) route.send(JSON.stringify({ type: 'saved-contacts-changed' }));
  }
}
