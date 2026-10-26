# Web and desktop release plan

DeployLens is now focused on two release products: a hosted web application and a downloadable desktop application for Windows, macOS and Linux. The mobile client is an optional add-on and does not block this release.

## Implemented foundation

- The web workspace accepts APK, AAB and IPA archives, streams inspection progress and presents findings, evidence, fixes, checks, build details, platform diagnostics, store preparation, manual verification, sharing and build comparison.
- Uploaded content is detected from its archive structure. The report separates app identity, uploaded filename and artifact type.
- The Node inspection service uses bounded jobs, worker processes, upload limits, cancellation and temporary workspaces with stale-file cleanup.
- The Electron desktop shell serves the same workspace and inspection service over loopback. It has Windows NSIS/ZIP and configured macOS DMG/ZIP and Linux AppImage/tar targets.
- Reports do not require accounts, authentication or a database. The product privacy policy documents temporary processing and user-controlled sharing.
- Repository CI now covers application checks and Windows packaged inspection. Manual/tag workflows configure Windows, macOS and Linux packaging, signed-release enforcement, checksums and GitHub Release publication.
- The production container includes pinned Android Command-Line/Build Tools and supports Cloud Run end-to-end HTTP/2 for uploads larger than Cloud Run's HTTP/1 limit.

## Required before a public web release

1. **Deploy and qualify the complete service.** The manual Cloud Run/Firebase workflow and same-origin API rewrite are configured. Create the Google Cloud IAM/billing/environment settings, run the deployment, and qualify it with real uploads. Firebase's 60-second dynamic rewrite timeout remains unsuitable for slower scans; use the direct HTTP/2 Cloud Run service or another supported edge in that case.
2. **Harden production operation.** Configure TLS, request and upload timeouts, body limits, rate limiting, concurrency and CPU/memory/disk/process quotas, a writable temporary volume, health checks, graceful shutdown, log redaction and monitoring. Do not mount signing keys or unrelated secrets into workers.
3. **Report and monitor tool capabilities.** The production image now installs the JDK and Android SDK Build-Tools for authoritative AAB/APK signing and alignment checks. Confirm their detection in the deployed scan evidence. If a tool is absent, the UI must continue to say `Not checked`. Full IPA cryptographic verification needs a macOS inspection host.
4. **Validate representative archives.** Run real signed release APKs, AABs and developer-exported IPAs; corrupted and hostile archives; near-limit files; concurrent jobs; cancellation; timeouts and interrupted processes. Compare the evidence with official platform tools.
5. **Finish public-site operations.** Connect the chosen domain, publish the privacy policy and support contact, add production security headers, verify browser/accessibility behavior and document service limits and maintenance behavior.

## Required before downloadable desktop releases

1. **Build on every target operating system.** Produce Windows x64, macOS Apple Silicon and Intel/universal as selected, and Linux x64 artifacts using a CI release matrix. The current repository has packaging configuration, but only Windows artifacts have been built and inspected in this workspace.
2. **Sign platform artifacts.** Sign Windows installers and executables. Sign and notarize the macOS app/DMG with hardened runtime. Publish checksums and verify signatures after download. Validate Linux desktop metadata and packaging on supported distributions.
3. **Run install and upgrade qualification.** Test clean install, first launch, archive inspection, local report export, upgrade, uninstall and retained preferences on Windows. Test Gatekeeper launch and notarization on macOS. Test AppImage/tar launch on representative Ubuntu/Fedora environments and X11/Wayland sessions.
4. **Qualify the release workflow.** The tag/manual workflow now builds all configured platforms, creates checksums and publishes GitHub Release assets. Configure signing/notarization secrets and complete a dry run before creating the first public tag.
5. **Choose the update experience.** The safe initial option is a visible link to signed GitHub releases and manual updates. If automatic updates are added, configure a signed update feed and test rollback/failure behavior on every platform.
6. **Handle external platform tools clearly.** The desktop app currently detects local JDK, Android SDK, ADB, Apple `codesign` and libimobiledevice tools. Decide which prerequisites users install and which are bundled, show capability status before inspection and document setup per OS. Never convert a missing tool into a passing result.
7. **Complete release polish.** Verify the implemented single-instance behavior on every OS, provide useful local startup/error logs without upload contents, publish third-party notices and confirm that no analytics, authentication or remote upload is enabled by default.

## Privacy baseline

The initial release has no accounts, authentication, advertising, behavioral analytics, application database or saved report history. Hosted uploads are transmitted to the selected inspection server, processed in temporary workspaces and deleted after completion, failure, cancellation or timeout. Desktop processing stays on the local computer unless the user explicitly chooses a remote service or sharing destination.

Infrastructure providers can still create ordinary network and access logs. The operator of the public instance must make that configuration match the published policy. Any future accounts, database history, crash reporting, analytics or longer retention require a policy update before deployment.

## Release definition of done

The first public release is complete when:

- the production web URL can inspect representative builds end to end and accurately labels unavailable host checks;
- signed Windows, notarized macOS and qualified Linux downloads are published with checksums and release notes;
- clean-install and upgrade smoke tests pass on the supported OS matrix;
- privacy, documentation, support and known limits are reachable without signing in;
- automated type, unit/server, browser and desktop-source/package checks pass from the release commit;
- no mobile deliverable is required for the web/desktop release.

See [Desktop release procedure](DESKTOP_RELEASE.md) for workflow inputs, required secrets and artifact qualification.
