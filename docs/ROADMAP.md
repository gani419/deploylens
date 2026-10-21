# Product direction

## Primary milestone: website alpha

- Upload-first React website with a Node inspection service, streamed progress, findings and JSON report download.
- Ephemeral uploads and results; no database or upload history.
- Shared engine with evidence-based signing outcomes and versioned policy snapshots.
- Current gate: validate real release APK/AAB/IPA samples, execute the macOS signing matrix, load-test maximum-sized uploads, and configure a supported host with TLS and abuse controls.

## Next: integrations and distribution

- VS Code extension: wrap shared engine/contracts in an extension host; render findings in a webview or diagnostics panel.
- Desktop: preserve working Electron bridge; add OS installer packaging, signing and macOS notarization when desktop becomes a release target.
- Mobile: provide an upload/report client backed by the same service. Native on-device scanning needs separate platform/tooling work.
- Hosted macOS workers: route iOS cryptographic checks to an appropriate host rather than pretending Linux can run Apple tools.
- Optional database/history: introduce explicit retention and deletion controls. Temporary upload directories are not a history store.

## Later: runtime checks

Device/emulator installation, startup/crash detection, representative screen checks, performance and payment flows remain future work. The present engine is a static archive inspector.

No private signing keys are requested for scans. Disposable keys used by regression tests are test-only fixtures generated in temporary directories.
