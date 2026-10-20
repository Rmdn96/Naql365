import type { ChildProcess } from 'node:child_process';
export function assertBrowserPortFree(port: number): Promise<void>;
export function startBrowserServer(
  env: NodeJS.ProcessEnv,
  port: number,
  command?: string[],
): Promise<ChildProcess>;
export function stopBrowserServer(server: ChildProcess | undefined, port: number): Promise<void>;
