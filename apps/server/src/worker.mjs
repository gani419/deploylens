import { DeployLensEngine } from '@deploylens/core';

process.once('message', async ({ artifactPath, fileName, scanId }) => {
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
      process.send?.(event);
    });
  } catch {
    // Do not expose tool output, filesystem paths or stack traces to visitors.
    process.send?.({ type: 'scan.error', message: 'Inspection could not complete. The archive may be malformed or use an unsupported format. No readiness verdict was issued.' });
  } finally {
    process.disconnect();
  }
});
