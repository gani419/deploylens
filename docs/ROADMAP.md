# Product direction

## Primary milestone: public web and desktop release

- Deploy the React website and Node inspection service together behind TLS. Firebase static Hosting alone cannot execute the inspection API.
- Keep uploads and reports ephemeral. Accounts, authentication, a database and report history are outside the initial release.
- Publish downloadable, signed DeployLens desktop applications for Windows, macOS and Linux from GitHub Releases or another trusted distribution location.
- Qualify real release APK/AAB/IPA samples, maximum-size uploads and host-specific signing tools before making production-readiness claims.
- Publish the privacy policy, operating limits, support contact, release notes and checksums with every public release.

The detailed release gates and definition of done are in [Web and desktop release plan](WEB_DESKTOP_RELEASE_PLAN.md).

## Optional add-ons

- Mobile client: retain the existing React Native code as an optional upload/report client. Mobile builds and store publication do not gate the web or desktop launch.
- VS Code extension: wrap the shared engine/contracts in an extension host and render findings in a webview or diagnostics panel.
- Hosted macOS workers: route iOS cryptographic checks to a macOS host rather than treating a Linux-hosted metadata scan as full signature verification.
- Database/history: add explicit retention, access and deletion controls before storing builds or reports.

## Later: runtime checks

Device/emulator startup, crash detection, representative screen checks, performance profiling and payment flows require a controlled runtime environment. The current engine is a static archive inspector with optional local installation helpers.

No private signing keys are requested for scans. Disposable keys used by regression tests are test-only fixtures generated in temporary directories.
