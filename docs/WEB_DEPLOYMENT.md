# Website deployment

The primary product is an upload-first React website backed by a Node.js service. It does not require a database. Existing CLI and desktop clients continue to use the shared engine.

## Supported host

Use a persistent Node.js 22+ process with writable temporary storage and permission to launch child processes. Static hosting and Cloudflare Workers alone cannot run this engine. No site has been registered or deployed to Sites because its Worker runtime cannot execute the required JDK, Android SDK, or Apple tools.

```sh
pnpm install --frozen-lockfile
pnpm web:build
pnpm web
```

The server binds to `127.0.0.1:3000` by default. Put it behind an HTTPS reverse proxy for external access. Set `HOST=0.0.0.0` only inside the intended container/network. Preserve the external Host header through the proxy. Disable response buffering on `/api/scans` to stream progress, permit uploads up to 512 MB, and allow at least 260 seconds for the entire request. Requests use a binary body (`application/octet-stream`) and the filename query parameter; multipart encoding is not used.

`pnpm web:dev` starts Vite on port 5173 with `/api` proxied to the Node service on port 3000.

## Platform tools

- JDK 17+ on PATH (or `JAVA_HOME`): `jarsigner` verifies AAB signatures and `keytool` extracts actual certificates. Self-signed Android signing certificates are legitimate; chain trust warnings are separate from package integrity. Missing tools are not checked. The signing test creates a disposable test-only keystore.
- Android SDK build-tools: `apksigner` verifies APK integrity; `zipalign -c -P 16 -v 4` checks 4-byte entries and 16 KB uncompressed native library alignment. Configure `ANDROID_HOME`/`ANDROID_SDK_ROOT` or add tools to PATH.
- macOS with Apple command line tools: required for iOS cryptographic code verification. Linux/Windows hosts provide IPA metadata checks and explicitly mark cryptographic verification as not checked. No remote macOS worker pool is implemented yet.

## Upload lifecycle and limits

1. The home page requires an APK/AAB/IPA file before enabling inspection.
2. The server streams up to 512 MB into a generated private temporary directory. Client-provided paths are never accepted.
3. At most two uploads/scans run per server process. Additional requests receive HTTP 429 and `Retry-After`.
4. A separate Node worker scans each archive, with a 512 MB V8 heap setting. Buffer/native memory is additional: use an OS/container memory limit, allow adequate RAM and temporary disk, and load-test representative large builds before exposing the service publicly.
5. Upload and inspection each have a two-minute timeout. Disconnecting/cancelling terminates the worker process tree. Normal completion, parser failures, timeout, and cancellation remove the private upload directory. A stale-upload sweep runs at startup and every five minutes to clean orphaned uploads older than the maximum job duration plus a safety margin (at least ten minutes).
6. Responses are `application/x-ndjson` with progress and one terminal `scan.completed` or `scan.error` event. Error events never issue a readiness verdict. Responses have `Cache-Control: no-store`. Absolute upload paths and raw tool exceptions are not returned.
7. Reports remain in browser memory. Reloading or selecting another build clears them. JSON download is an explicit user action; the server keeps no report history.

Ordinary deletion is not secure disk erasure. Keep the temporary volume out of backups, access logs, and file-retention systems. Unexpected host shutdown can leave temporary files until the next sweep. An operator receives a generic error if deletion cannot complete.

## Before an unrestricted public launch

Run the service as an unprivileged user in a disposable environment with an OS memory/process/disk quota. The process boundary improves failure isolation but is not an operating-system security sandbox. Do not mount application secrets or signing keys into scan workers. Only toolchain/OS environment variables are passed to workers.

Configure TLS and abuse controls/rate limiting at the edge; there is no user authentication or distributed queue. The built-in concurrency bound is per process, not a cross-server quota. Run actual signed release APKs/AABs and developer-exported IPAs through the scanner and compare findings with official platform validation. Windows automated tests cannot establish macOS codesign behavior; run a macOS verification matrix before claiming complete iOS support.

Policy is a reviewed snapshot, not a live console integration. Google Play device categories are inferred from required hardware/software features. Granted extensions, existing-app availability, account eligibility, runtime behavior, and complete provisioning entitlement matching remain manual checks. Add future persistence behind a separate explicit retention feature rather than keeping these temporary directories as history.

## Container example

The repository Dockerfile builds the shared packages, website and inspection service. Its Linux runtime installs a JDK, Android Command-Line Tools and pinned Android Build-Tools so `jarsigner`, `keytool`, `apksigner`, `zipalign`, `apkanalyzer` and `readelf` can be detected. The command-line-tools download is checked against the SHA-256 value published by Android Developers. iOS cryptographic verification remains unavailable in this Linux image. The Docker image still needs to be built and scanned in CI before its first deployment.

```sh
docker build -t deploylens .
docker run --rm -p 127.0.0.1:3000:3000 --memory=4g --cpus=2 --pids-limit=128 --read-only --tmpfs /tmp:size=2g,mode=1777 deploylens
```

For the initial local review, use the Node commands above. Installer signing/notarization, distributed workers and database history are separate delivery work.

## Cloud Run and Firebase

The manual `Deploy web service` GitHub workflow builds the Dockerfile through Google Cloud and deploys a `deploylens` Cloud Run service in `asia-east1`. Configure the GitHub `production` environment, the `GCP_PROJECT_ID` repository variable, and the `GCP_WORKLOAD_IDENTITY_PROVIDER` and `GCP_SERVICE_ACCOUNT` secrets. Workload Identity Federation avoids storing a long-lived Google service-account key in GitHub.

The workflow enables Cloud Run end-to-end HTTP/2 and sets `DEPLOYLENS_HTTP2=1`. This is required because Cloud Run limits an HTTP/1 request body to 32 MiB; the Node service otherwise supports uploads up to 512 MiB. The server has a tested cleartext HTTP/2 mode for Cloud Run's container connection. Run large-file qualification against the deployed URL before advertising the configured maximum.

Firebase Hosting is optional. `firebase.json` routes `/api/**` to the `deploylens` Cloud Run service and serves the versioned frontend assets from Firebase. Firebase Hosting dynamic rewrites have a 60-second request timeout, shorter than the service's two-minute inspection timeout. Use the direct Cloud Run URL or another reverse proxy with the documented timeout and streaming support when an inspection can exceed 60 seconds. Firebase static Hosting without the API rewrite is not a working DeployLens deployment.

The workflow is manual and uses a protected GitHub environment so deployment remains an explicit action. It does not create billing, IAM, Workload Identity, budget alerts, a custom domain or DNS records. Those cloud-account operations must be completed before the first run.

## Report identity, documentation and Android diagnostics

`/documentation` is a directly addressable user guide and `/privacy` contains the product privacy policy; the Node server serves the app entry point for both routes. In-page navigation preserves the current report in memory. The report identity card separates the display name, identifier, version/build, uploaded filename and the archive format detected from contents. Mismatched extensions and unsupported/ambiguous archive structures are rejected.

Android labels are resolved from AAB `base/resources.pb` and common APK `resources.arsc` string/alias entries. If a label cannot be resolved (including unsupported resource encodings), the report uses the identifier instead of inventing a project name. The test suite also compiles real APK/protobuf resource tables with AAPT2 when Android SDK build-tools and API 36 are available.

The Android diagnostics tab exposes per-library 64-bit ELF load alignment, ZIP alignment for APKs, and the native packaging alignment requested by `BundleConfig.pb` for AABs. Generated APKs and runtime compatibility are separate checks. Missing/truncated ELF headers never count as alignment passes.

Android Studio Profiler is not embedded or invoked by the upload service. We expose the manifest profileable/debuggable declarations and provide device-based profiling instructions. Implementing live CPU/memory/trace reports needs an isolated emulator/device execution service; archive inspection does not execute runtime tests. An optional local-only installer can install APKs using ADB or eligible signed IPAs using libimobiledevice/ideviceinstaller. It is disabled by default, requires DEPLOYLENS_LOCAL_DEVICES=1 on a loopback-bound local server, and cannot be used by a hosted site to reach visitor devices. No emulator launch or trace collection is performed. Browser tests default to port 3100 so they do not interrupt a developer's website on port 3000; `DEPLOYLENS_TEST_PORT` overrides the test port.


## Optional device tools and permission-reference diagnostics

For IPA installation on Windows, provide libimobiledevice (idevice_id) and ideviceinstaller with their dependencies and the Apple USB driver. Add the toolchain to PATH or set DEPLOYLENS_IOS_TOOLS. The iPhone must be unlocked and trust the computer. The IPA must already have valid signing/provisioning for that device and distribution method; development apps may require Developer Mode. Installation can update an existing app with the same bundle identifier. No re-signing, device registration or provisioning bypass is performed. Do not expose a local device-enabled server via a reverse proxy or tunnel. Real device/driver compatibility still requires a hardware validation matrix.

The static API/declaration audit searches eligible DEX and main iOS/framework executables, with 32-file / 64 MB total / 32 MB per-file bounds. Skipped files and coverage limitations are included in the result. Suspected undeclared camera/microphone/photo/location/contact references are review findings, not confirmed runtime failures. Android native/JNI/Dart, reflection/downloaded code, feature manifests, encrypted/stripped iOS code and extension-specific declarations need separate analysis. Runtime allow/deny/settings flow checks remain unverified.


## Service ownership after Phase 1

The HTTP service, scan worker and local device adapter now live under `apps/server/src`, independently of the browser UI. `pnpm web` and `pnpm server` start that service; its default static directory is `apps/web/dist`. The Docker runtime copies both application folders. Browser upload transport lives under `apps/web/src/adapters`, while the shared wire decoder, state and report transformations live under root-level packages. Endpoints, retention, worker isolation and loopback device guards are unchanged by this move.
