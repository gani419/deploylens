import { DeployLensEngine } from '@deploylens/core';
import { createQueuedSender } from './workerIpc.mjs';

process.once('message', async ({ artifactPath, fileName, scanId }) => {
  const sender = createQueuedSender((event, callback) => process.send(event, callback));
  try {
    const engine = new DeployLensEngine();
    await engine.inspectArtifact({ artifactPath }, event => {
      // The public scan ID is independent of private filesystem paths.
      event.scanId = scanId;
      if (event.type === 'scan.started') event.artifact = { ...event.artifact, path: fileName, fileName };
      if (event.type === 'scan.completed') {
        event.summary.scanId = scanId;
        event.summary.artifact = { ...event.summary.artifact, path: fileName, fileName };
      }
      sender.enqueue(event);
    });
    await sender.flush();
  } catch {
    // Do not expose tool output, filesystem paths or stack traces to visitors.
    sender.enqueue({ type: 'scan.error', message: 'Inspection could not complete. The archive may be malformed or use an unsupported format. No readiness verdict was issued.' });
    try { await sender.flush(); } catch { /* The parent connection is already unavailable. */ }
  } finally {
    if (process.connected) process.disconnect();
  }
});
