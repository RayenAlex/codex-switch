export function createNamesFixture(broadcast) {
  const nicknames = new Map(); const remarks = new Map();
  let rejected = false;
  function update(kind, id, value) {
    (kind === 'nickname' ? nicknames : remarks).set(id, value);
    broadcast({ type: 'names', [kind === 'nickname' ? 'profiles' : 'remarks']: [{ id, [kind]: value }] });
  }
  function handle(socket, frame) {
    const send = value => socket.send(JSON.stringify(value));
    if (frame.type === 'profile-watch') send({ type: 'names',
      profiles: frame.watch.map(id => ({ id, nickname: nicknames.get(id) ?? '' })),
      remarks: frame.watch.map(id => ({ id, remark: remarks.get(id) ?? '' })) });
    if (frame.type !== 'nickname' && frame.type !== 'remark') return;
    if (rejected) send({ type: 'rejected', id: frame.id, code: `client.lounge.${frame.type}SaveFailed` });
    else {
      update(frame.type, frame.type === 'nickname' ? 'alice' : frame.userId, frame[frame.type].trim());
      send({ type: 'updated', id: frame.id });
    }
  }
  return { nicknames, remarks, update, handle, reject: value => { rejected = value; },
    reset: () => { nicknames.clear(); remarks.clear(); rejected = false; nicknames.set('bob', '小明'); } };
}
