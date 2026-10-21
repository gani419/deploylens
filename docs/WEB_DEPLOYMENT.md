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

The repository Dockerfile builds only shared packages and the website. Its Linux runtime includes a JDK for AAB verification; APK tools must be added/configured separately. iOS cryptographic verification remains unavailable in this Linux image. The Docker image has not been built in this Windows review environment.

```sh
docker build -t deploylens .
docker run --rm -p 127.0.0.1:3000:3000 --memory=4g --cpus=2 --pids-limit=128 --read-only --tmpfs /tmp:size=2g,mode=1777 deploylens
```

For the initial local review, use the Node commands above. Installer signing/notarization, distributed workers, database history, and public infrastructure are subsequent delivery work.

## Report identity, documentation and Android diagnostics

`/documentation` is a directly addressable user guide; the Node server serves the app entry point for this route. In-page navigation preserves the current report in memory. The report identity card separates the display name, identifier, version/build, uploaded filename and the archive format detected from contents. Mismatched extensions and unsupported/ambiguous archive structures are rejected.

Android labels are resolved from AAB `base/resources.pb` and common APK `resources.arsc` string/alias entries. If a label cannot be resolved (including unsupported resource encodings), the report uses the identifier instead of inventing a project name. The test suite also compiles real APK/protobuf resource tables with AAPT2 when Android SDK build-tools and API 36 are available.

The Android diagnostics tab exposes per-library 64-bit ELF load alignment, ZIP alignment for APKs, and the native packaging alignment requested by `BundleConfig.pb` for AABs. Generated APKs and runtime compatibility are separate checks. Missing/truncated ELF headers never count as alignment passes.

Android Studio Profiler is not embedded or invoked by the upload service. We expose the manifest profileable/debuggable declarations and provide device-based profiling instructions. Implementing live CPU/memory/trace reports needs an isolated emulator/device execution service; no device access, installation, emulator launch or trace collection is performed here. Browser tests default to port 3100 so they do not interrupt a developer's website on port 3000; `DEPLOYLENS_TEST_PORT` overrides the test port.
