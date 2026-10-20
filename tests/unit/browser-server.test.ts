import { afterEach, expect, it } from 'vitest';
import { createServer } from 'node:net';
import {
  assertBrowserPortFree,
  startBrowserServer,
  stopBrowserServer,
} from '../../scripts/browser-server.mjs';
const owned: { server: Awaited<ReturnType<typeof startBrowserServer>>; port: number }[] = [];
async function freePort() {
  const probe = createServer();
  await new Promise<void>((resolve) => probe.listen(0, '127.0.0.1', resolve));
  const port = (probe.address() as { port: number }).port;
  await new Promise<void>((resolve) => probe.close(() => resolve()));
  return port;
}
function command(port: number) {
  const child = `require('node:http').createServer((q,r)=>r.end('owned-child')).listen(${port},'127.0.0.1')`;
  return [
    '-e',
    `require('node:child_process').spawnSync(process.execPath,['-e',${JSON.stringify(child)}],{stdio:'inherit'})`,
  ];
}
afterEach(async () => {
  for (const item of owned.splice(0)) await stopBrowserServer(item.server, item.port);
});
it('owns and disposes a nested server before another harness reuses its port', async () => {
  const port = await freePort();
  const first = await startBrowserServer(process.env, port, command(port));
  owned.push({ server: first, port });
  expect(await (await fetch('http://127.0.0.1:' + port)).text()).toBe('owned-child');
  await expect(assertBrowserPortFree(port)).rejects.toThrow('BROWSER_PORT_IN_USE');
  await expect(startBrowserServer(process.env, port, command(port))).rejects.toThrow(
    'BROWSER_PORT_IN_USE',
  );
  // Refusing a conflicting listener must not terminate somebody else's server.
  expect((await fetch('http://127.0.0.1:' + port)).ok).toBe(true);
  await stopBrowserServer(first, port);
  owned.pop();
  await assertBrowserPortFree(port);
  const next = await startBrowserServer(process.env, port, command(port));
  owned.push({ server: next, port });
  expect((await fetch('http://127.0.0.1:' + port)).ok).toBe(true);
});
it('fails immediately when the owned child exits instead of accepting false readiness', async () => {
  const port = await freePort();
  await expect(startBrowserServer(process.env, port, ['-e', 'process.exit(23)'])).rejects.toThrow(
    'BROWSER_SERVER_EXITED',
  );
  await assertBrowserPortFree(port);
});
it('captures structured catalog boundary lines without forwarding unrelated server output', async () => {
  const port = await freePort(),
    events: Record<string, unknown>[] = [];
  const child = `require('node:http').createServer((q,r)=>{console.log('discarded synthetic server output');process.stdout.write('CATALOG_');process.stdout.write('SSR '+JSON.stringify({stage:'rpc',httpStatus:200,rpcError:false})+'\\n');console.error('CATALOG_SSR not-json');r.end('ready')}).listen(${port},'127.0.0.1')`;
  const server = await startBrowserServer(process.env, port, ['-e', child], (event) =>
    events.push(event),
  );
  owned.push({ server, port });
  await expect.poll(() => events.length).toBe(1);
  expect(events).toEqual([{ stage: 'rpc', httpStatus: 200, rpcError: false }]);
});
