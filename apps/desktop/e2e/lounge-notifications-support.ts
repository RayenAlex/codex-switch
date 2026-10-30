import type { WebSocketRoute } from '@playwright/test';

export class LoungeNotificationsFixture {
  private state = { muted: new Set<string>(), sockets: new Set<WebSocketRoute>() };
  fail = false;
  shareWith(other: LoungeNotificationsFixture) { other.state = this.state; }
  get muted() { return [...this.state.muted]; }
  handle(socket: WebSocketRoute, frame: Record<string, unknown>) {
    if (frame.type === 'authenticate') this.state.sockets.add(socket);
    if (frame.type !== 'notification-setting' || typeof frame.conversation !== 'string'
      || typeof frame.muted !== 'boolean') return;
    if (this.fail) {
      socket.send(JSON.stringify({ type: 'rejected', id: frame.id, code: 'client.lounge.notificationSaveFailed' }));
      return;
    }
    this.update(frame.conversation, frame.muted);
    socket.send(JSON.stringify({ type: 'updated', id: frame.id }));
  }
  update(conversation: string, muted: boolean) {
    if (muted) this.state.muted.add(conversation); else this.state.muted.delete(conversation);
    for (const socket of this.state.sockets) socket.send(JSON.stringify({
      type: 'notification-settings', conversation, muted }));
  }
}
