import { describe, expect, it } from 'vitest';
// @ts-expect-error The production helper is deliberately framework-independent Node ESM.
import { createQueuedSender } from '../apps/server/src/workerIpc.mjs';

describe('inspection worker IPC', () => {
  it('waits for queued reports to flush in order before shutdown', async () => {
    const delivered: string[] = [];
    const sender = createQueuedSender((event: { type: string }, callback: (error?: Error | null) => void) => {
      setTimeout(() => { delivered.push(event.type); callback(); }, event.type === 'scan.completed' ? 20 : 1);
    });

    sender.enqueue({ type: 'stage.completed' });
    sender.enqueue({ type: 'scan.completed', payload: 'x'.repeat(2 * 1024 * 1024) });
    expect(delivered).toEqual([]);
    await sender.flush();
    expect(delivered).toEqual(['stage.completed', 'scan.completed']);
  });
});
