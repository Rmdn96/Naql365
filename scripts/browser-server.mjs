// Local browser infrastructure only. Never reuse another process's listener.
import { spawn, execFileSync } from 'node:child_process';
import { createServer, createConnection } from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';

export async function assertBrowserPortFree(port) {
  const probe = createServer();
  await new Promise((resolve, reject) => {
    probe.once('error', () => reject(Error('BROWSER_PORT_IN_USE')));
    probe.listen(port, '127.0.0.1', () => probe.close(resolve));
  });
}
async function listening(port) {
  return new Promise((resolve) => {
    const socket = createConnection({ host: '127.0.0.1', port });
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('error', () => {
      socket.destroy();
      resolve(false);
    });
  });
}
export async function stopBrowserServer(server, port) {
  if (!server?.pid) return;
  if (process.platform === 'win32') {
    if (server.exitCode === null && server.signalCode === null)
      execFileSync('taskkill', ['/PID', String(server.pid), '/T', '/F'], { stdio: 'ignore' });
  } else {
    // startBrowserServer creates an owned process group. Include the guarded
    // wrapper's synchronous Next.js descendant, not just the wrapper PID.
    try {
      process.kill(-server.pid, 'SIGTERM');
    } catch (error) {
      if (error.code !== 'ESRCH') throw error;
    }
  }
  const deadline = Date.now() + 5000;
  while (await listening(port)) {
    if (Date.now() >= deadline) throw Error('BROWSER_SERVER_CLEANUP_FAILED');
    await delay(50);
  }
  await assertBrowserPortFree(port);
}
export async function startBrowserServer(
  env,
  port,
  command = ['scripts/guarded-next.mjs', 'start', '-p', String(port)],
) {
  await assertBrowserPortFree(port);
  const server = spawn(process.execPath, command, {
    env,
    stdio: 'ignore',
    windowsHide: true,
    detached: process.platform !== 'win32',
  });
  let failed = false;
  server.once('error', () => {
    failed = true;
  });
  try {
    const deadline = Date.now() + 60000;
    while (Date.now() < deadline) {
      if (failed || server.exitCode !== null || server.signalCode !== null)
        throw Error('BROWSER_SERVER_EXITED');
      const ready = await fetch('http://127.0.0.1:' + port + '/en/login')
        .then((r) => r.ok)
        .catch(() => false);
      if (ready && !failed && server.exitCode === null && server.signalCode === null) return server;
      await delay(100);
    }
    throw Error('BROWSER_SERVER_UNAVAILABLE');
  } catch (error) {
    await stopBrowserServer(server, port);
    throw error;
  }
}
