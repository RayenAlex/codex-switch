import { createRoot } from 'react-dom/client';
import { createAsyncGitFixture } from '../../../shared/remote-chat/testing/gitFixture';
import { useRemoteGit } from '../../../shared/remote-chat/useRemoteGit';
import { GitToolbar } from '../../web/src/chat/git/GitToolbar';
import { GitChanges } from '../../web/src/chat/git/GitChanges';
import { GitFileActionDialog } from '../../web/src/chat/git/GitFileActionDialog';
import { GitHistory } from '../../web/src/chat/git/GitHistory';
import { GitRevisionDialog } from '../../web/src/chat/git/GitRevisionDialog';
import { enqueueGitPatch } from '../../web/src/downloads/gitPatch';
import { GitRevisionDownloads } from './git-revision-download';
import { useGitTheme } from '../../web/src/chat/git/gitTheme';
import '../../web/src/chat/git/git.css';
import { displayError } from '../../web/src/i18n';

const client = createAsyncGitFixture();
if (new URLSearchParams(location.search).has('taskConflict')) {
  const fileAction = client.fileAction;
  client.fileAction = async request => {
    if (request.files.some(file => file.path === 'src/app.ts')) {
      throw new Error(JSON.stringify({ code: 'client.gitActivity.filesBusy', params: {
        details: '修复登录页面中的表单验证和提交状态 (task-login) → src/app.ts\n发布任务 (task-release) → src/app.ts',
      } }));
    }
    return fileAction(request);
  };
}
const historyMode = new URLSearchParams(location.search).has('history');
if (new URLSearchParams(location.search).has('longBranch')) {
  const branch = `feature/${'long-branch-name-'.repeat(6)}git-actions`;
  const changes = client.changes;
  const repository = client.repository;
  client.changes = async cwd => ({ ...await changes(cwd), branch });
  client.repository = async cwd => ({ ...await repository(cwd), upstream: `origin/${branch}` });
}

function Fixture() {
  const panel = useRemoteGit({ client, cwd: '/demo/project', connected: true, active: true, refreshInterval: 1000 });
  const theme = useGitTheme();
  return <div className="chat-git" style={{ ...theme, height: '100vh' }}>
    <GitToolbar panel={panel} connected />
    {panel.notice && <p role="status" className="git-notice">{panel.notice}</p>}
    {panel.error && <p role="alert" className="git-error">{displayError(panel.error)}</p>}
    {historyMode ? <GitHistory panel={panel} connected
      onPatch={commit => enqueueGitPatch(client, '/demo/project', commit.hash)} />
      : <GitChanges panel={panel} connected />}
    {panel.fileAction && <GitFileActionDialog panel={panel} connected />}
    {panel.revisionAction && <GitRevisionDialog panel={panel} connected />}
    {historyMode && <GitRevisionDownloads git={client} />}
  </div>;
}

createRoot(document.getElementById('root')!).render(<Fixture />);
