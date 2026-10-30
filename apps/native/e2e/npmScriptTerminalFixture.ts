import type { GuiToolsClient } from '../../../shared/remote-chat/guiTools';
import type { TerminalEvent, TerminalInfo } from '../../../shared/terminal/types';
import { createSshFixture } from './sshFixture';
import { savedFiles } from '../../desktop/e2e/project-browser-fixture';

/** Simulate the PC protocol while exercising the actual native terminal UI and editor bridge. */
export function npmScriptTerminalFixture(): GuiToolsClient['terminal'] {
  const sessions = new Map<string, { info: TerminalInfo; events: TerminalEvent[] }>();
  let sequence = 0;
  const output = (text: string): TerminalEvent => ({ type: 'output', data: Array.from(text, char => char.charCodeAt(0)) });
  return {
    ssh: createSshFixture('npm', () => {}),
    link: async () => { throw new Error('Fixture links are unavailable'); },
    list: async cwd => [...sessions.values()].filter(value => value.info.projectCwd === cwd).map(value => value.info),
    open: async (cwd, _size, projectCwd, options) => {
      if (options?.npmScript === 'failStart') throw new Error('Fixture launch failed');
      const info: TerminalInfo = { id: `npm-${++sequence}`, cwd, projectCwd: projectCwd ?? cwd,
        shell: 'Fixture shell', npmScript: options?.npmScript, npmScriptCwd: cwd };
      const session = { info, events: [output(`npm run ${options?.npmScript}\r\nPROJECT ${cwd}\r\nReady\r\n`),
        output(`SAVED ${savedFiles.at(-1)?.text ?? ''}\r\n`)] };
      sessions.set(info.id, session);
      if (options?.npmScript === 'build') setTimeout(() => {
        session.info = { ...info, exited: true };
        session.events.push(output('Build complete\r\n'), { type: 'exit', code: 0 });
      }, 1500);
      return info;
    },
    read: async (id, cursor) => ({ found: sessions.has(id), cursor: sessions.get(id)?.events.length ?? 0,
      truncated: false, events: sessions.get(id)?.events.slice(cursor) ?? [] }),
    write: async (id, data) => { sessions.get(id)?.events.push(output(data)); },
    resize: async () => {}, binaryMode: async () => {}, writeBinary: async () => {},
    close: async id => { sessions.delete(id); },
  };
}
