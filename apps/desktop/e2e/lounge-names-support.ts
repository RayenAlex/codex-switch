import type { WebSocketRoute } from '@playwright/test';

export class LoungeNamesFixture {
  enabled = true;
  reject = false;
  nicknames = new Map<string, string>();
  remarks = new Map<string, string>();
  private socket?: WebSocketRoute;
  private send(frame: object) { this.socket?.send(JSON.stringify(frame)); }
  update(kind: 'nickname' | 'remark', id: string, value: string) {
    (kind === 'nickname' ? this.nicknames : this.remarks).set(id, value);
    this.send({ type: 'names', [kind === 'nickname' ? 'profiles' : 'remarks']: [{ id, [kind]: value }] });
  }
  handle(socket: WebSocketRoute, frame: { type: string; id?: string; userId?: string;
    nickname?: string; remark?: string; watch?: string[] }) {
    this.socket = socket;
    if (frame.type === 'profile-watch' && this.enabled) this.send({ type: 'names',
      profiles: frame.watch?.map(id => ({ id, nickname: this.nicknames.get(id) ?? '' })),
      remarks: frame.watch?.map(id => ({ id, remark: this.remarks.get(id) ?? '' })) });
    if (frame.type !== 'nickname' && frame.type !== 'remark') return;
    if (this.reject) this.send({ type: 'rejected', id: frame.id, code: `client.lounge.${frame.type}SaveFailed` });
    else {
      const id = frame.type === 'nickname' ? 'alice' : frame.userId!;
      this.update(frame.type, id, frame[frame.type]!.trim());
      this.send({ type: 'updated', id: frame.id });
    }
  }
}
