"""Disposable WSL SSH/SFTP fixture. Never changes the machine's SSH configuration."""
import argparse
import asyncio
import fcntl
import json
import os
from pathlib import Path
import pty
import secrets
import signal
import struct
import subprocess
import sys
import tempfile
import termios

if os.environ.get('SSH_FIXTURE_PYTHON'):
    sys.path.insert(0, os.environ['SSH_FIXTURE_PYTHON'])
import asyncssh


def resize(master, width, height):
    fcntl.ioctl(master, termios.TIOCSWINSZ, struct.pack('HHHH', height or 24, width or 80, 0, 0))


async def copy_output(process, master):
    while True:
        try:
            data = await asyncio.to_thread(os.read, master, 8192)
        except OSError:
            return
        if not data:
            return
        process.stdout.write(data)


async def copy_input(process, master):
    while True:
        try:
            data = await process.stdin.read(8192)
        except asyncssh.TerminalSizeChanged as event:
            resize(master, event.width, event.height)
            continue
        except (asyncssh.BreakReceived, asyncssh.SignalReceived):
            continue
        if not data:
            return
        os.write(master, data)


async def shell(process, root, integration):
    command = process.command
    if command and not process.get_terminal_type():
        child = await asyncio.create_subprocess_exec(
            '/bin/sh', '-c', command, cwd=root, env={**os.environ, 'SHELL': '/bin/bash'},
            stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE)
        stdout, stderr = await child.communicate()
        process.stdout.write(stdout)
        process.stderr.write(stderr)
        process.exit(child.returncode)
        return
    master, slave = pty.openpty()
    width, height, _, _ = process.get_terminal_size()
    resize(master, width, height)
    args = ['/bin/sh', '-c', command] if command and integration else ['/bin/bash', '--noprofile', '--norc', '-i']
    child = subprocess.Popen(args, stdin=slave, stdout=slave, stderr=slave,
        cwd=root, env={**os.environ, 'HOME': str(root), 'SHELL': '/bin/bash',
                       'PS1': 'wsl-ssh> ', 'TERM': 'xterm-256color'}, start_new_session=True)
    os.close(slave)
    tasks = [asyncio.create_task(copy_output(process, master)), asyncio.create_task(copy_input(process, master))]
    try:
        await asyncio.wait(tasks, return_when=asyncio.FIRST_COMPLETED)
    finally:
        for task in tasks:
            task.cancel()
        if child.poll() is None:
            os.killpg(child.pid, signal.SIGHUP)
        os.close(master)
        try:
            await asyncio.wait_for(asyncio.to_thread(child.wait), 2)
        except asyncio.TimeoutError:
            os.killpg(child.pid, signal.SIGKILL)
            await asyncio.to_thread(child.wait)
        await asyncio.gather(*tasks, return_exceptions=True)
        process.exit(0)


class Server(asyncssh.SSHServer):
    def __init__(self, password, key):
        self.password = password
        self.key = key.convert_to_public()

    def begin_auth(self, username):
        return True

    def password_auth_supported(self):
        return True

    def public_key_auth_supported(self):
        return True

    def validate_password(self, username, password):
        return username == 'fixture' and secrets.compare_digest(password, self.password)

    def validate_public_key(self, username, key):
        return username == 'fixture' and key == self.key


class RealPathSftp(asyncssh.SFTPServer):
    """Expose the shell's real paths while still restricting files to the disposable directory."""
    def __init__(self, channel, root):
        super().__init__(channel)
        self.root = os.fsencode(root)

    def map_path(self, path):
        if path in (b'..', self.root + b'/..'):
            return self.root
        resolved = os.path.realpath(os.path.join(self.root, path))
        if resolved != self.root and not resolved.startswith(self.root + b'/'):
            raise asyncssh.SFTPPermissionDenied('Outside fixture directory')
        return resolved

    def reverse_map_path(self, path):
        return self.map_path(path)


async def serve(args, root):
    (root / '中文目录').mkdir()
    (root / 'hello.txt').write_text('Hello from WSL SSH\n你好，远程文件！\n', encoding='utf-8')
    (root / '.hidden').write_text('hidden\n', encoding='utf-8')
    if args.integration:
        (root / '.bash_profile').write_text(
            "PS1='wsl-ssh> '\nPROMPT_COMMAND=':; # preserve a trailing command and comment'\n", encoding='utf-8')
    password = secrets.token_urlsafe(24)
    key = asyncssh.generate_private_key('ssh-ed25519')
    async with await asyncssh.create_server(
        lambda: Server(password, key), args.bind, args.port,
        server_host_keys=[asyncssh.generate_private_key('ssh-ed25519')],
        process_factory=lambda process: shell(process, root, args.integration), encoding=None,
        sftp_factory=lambda channel: RealPathSftp(channel, root) if args.integration
        else asyncssh.SFTPServer(channel, chroot=str(root))):
        host = args.host or subprocess.check_output(['hostname', '-I']).decode().split()[0]
        config = dict(host=host, port=args.port, username='fixture', password=password,
                      privateKey=key.export_private_key().decode(), root=str(root) if args.integration else '/')
        args.config.parent.mkdir(parents=True, exist_ok=True)
        args.config.write_text(json.dumps(config), encoding='utf-8')
        args.config.chmod(0o600)
        print('WSL SSH fixture ready', flush=True)
        stopped = asyncio.Event()
        loop = asyncio.get_running_loop()
        for event in (signal.SIGINT, signal.SIGTERM):
            loop.add_signal_handler(event, stopped.set)
        try:
            await stopped.wait()
        finally:
            args.config.unlink(missing_ok=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--config', type=Path,
                        default=Path(__file__).resolve().parents[3] / '.codex-tmp/ssh-wsl/config.json')
    parser.add_argument('--bind', default='0.0.0.0')
    parser.add_argument('--host', help='Address reachable by the Windows test client')
    parser.add_argument('--port', type=int, default=22022)
    parser.add_argument('--integration', action='store_true', help='Enable shell hooks and matching SFTP paths')
    args = parser.parse_args()
    with tempfile.TemporaryDirectory(prefix='remoteai-ssh-fixture-') as temporary:
        asyncio.run(serve(args, Path(temporary)))


if __name__ == '__main__':
    main()
