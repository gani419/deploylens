# DeployLens

Inspect your app. Prepare your release.

DeployLens is a website-first mobile build inspection tool. Upload an Android APK/AAB or iOS IPA on the home page to inspect release configuration, signatures, SDK requirements, native libraries and privacy declarations. Results show evidence, remediation, checks that could not run, and store preparation guidance.

**Status: internal alpha.** Static inspection cannot certify production readiness or guarantee store approval. The scanner does not install or launch the uploaded app.

## Run the website

Requires Node.js 22+ and pnpm 12.9.1.

```sh
pnpm install --frozen-lockfile
pnpm web:build
pnpm web
```

Open http://127.0.0.1:3000. User-facing documentation is available at `/documentation`. Reports show the extracted app display name, detected platform/format, version, identifier and original upload separately. Android diagnostics include per-library ELF alignment and AAB native packaging settings; no live Android Profiler session is run. The Node server serves both the website and upload API. `PORT` and `HOST` configure the listener. For UI development, keep the API running and run `pnpm web:dev` in a second terminal.

A browser uploads the actual file bytes. This is not a file-path preview. Files are temporarily written to a private server workspace, scanned in a separate process, and deleted after success, failure, timeout or cancellation. No database, upload history, authentication, analytics, or automatic saved reports are implemented. A user can explicitly download their JSON report. Results stay in browser memory until the page is refreshed or another file is selected.

See [website deployment and retention](docs/WEB_DEPLOYMENT.md) before hosting.

## Signing and policy checks

- APK signatures are cryptographically verified with Android SDK `apksigner`. Signature-block presence alone never passes verification. Windows batch wrappers are launched through their Java JAR without a shell.
- AAB JAR signatures are verified with JDK `jarsigner`. Unsigned entries and tampered archives fail. Actual certificate metadata is extracted with `keytool`.
- iOS nested code is extracted into a temporary workspace on macOS and checked with `codesign --verify --deep --strict --all-architectures` with an Apple trust anchor. Displaying a certificate alone is insufficient. Provisioning profile metadata is checked for development distribution and expiration; complete entitlement/profile eligibility still requires Xcode/App Store Connect validation.
- Missing verification tools produce **not checked**, not passed. Unsupported or unreadable manifests never receive fabricated app identities, SDK levels, or architectures.
- Policy snapshot reviewed **October 21, 2026**: Google Play new/update target API 36 for phone/tablet, 35 for Wear OS/Automotive, 34 for TV/XR; iOS/iPadOS SDK 26+ for App Store Connect uploads. Category-specific extensions and account standing require console verification.

Official sources: [Google Play target API](https://support.google.com/googleplay/android-developer/answer/11926878), [Apple SDK minimums](https://developer.apple.com/news/?id=ueeok6yw), [Apple signature verification](https://developer.apple.com/library/archive/technotes/tn2206/).

## Architecture

The phased shared-code and React Native roadmap is documented in [Mobile implementation plan](docs/MOBILE_IMPLEMENTATION_PLAN.md). It distinguishes the current runnable web/desktop implementations from unfinished deployment, desktop parity and native release validation.

TypeScript/pnpm monorepo with a Node inspection engine. React 19 and Vite power the web and desktop interfaces. Electron provides the local desktop bridge. Commander powers the CLI. Vitest and Playwright cover regression and browser behavior.

- `apps/web/src`: browser-specific React UI, CSS, file/clipboard/download adapters and React bindings.
- `apps/server/src`: shared Node HTTP inspection service, isolated worker and local-only device installation routes.
- `apps/cli`: local `doctor` and `scan` commands.
- `apps/desktop`: Electron interface with a sandboxed CommonJS preload bridge.
- `apps/mobile`: React Native Community CLI application with native Android/iOS projects and service-backed inspection entry points.
- `packages/core`: scan lifecycle, bounded ZIP parsing, cleanup, assessments.
- `packages/android`, `packages/ios`: archive and platform inspection.
- `packages/rules`: versioned checks with official references.
- `packages/contracts`: portable metadata, event and HTTP service types.
- `packages/config`: product identity, supported formats, inspection defaults, colors and typography tokens.
- `packages/utils`: platform-independent identity, formatting and archive validation.
- `packages/reporting`: build comparison, share text and research descriptions.
- `packages/store`: framework-independent, in-memory inspection and report/draft state.
- `packages/api-client`: streaming protocol decoder and platform transport interfaces.
- `packages/ui-web`: DOM components for web/Electron; not React Native UI.
- `packages/store-guidance`: deterministic store listing/checklist generation.

Keep platform logic in shared packages. Future VS Code, desktop and mobile clients can wrap the same scan contract. A Linux server can inspect iOS metadata, but cryptographic iOS verification needs a macOS host.

## Local CLI and desktop

```sh
pnpm build
pnpm cli doctor --format json
pnpm cli scan fixtures/android/test-app.aab --format json
pnpm desktop
```

CLI exit statuses: 0 passed available checks; 2 action required; 3 review required; 4 incomplete/error. A missing file returns 1. Fixtures are synthetic regression archives, not installable release samples, and placeholder signatures must fail verification.

## Verification

```sh
pnpm build
pnpm test
pnpm typecheck
pnpm test:e2e
```

Browser tests use installed Google Chrome and verify upload, results, report download, corrupt input, mobile layout, and the Electron bridge. The real JDK signing regression uses disposable test keys and skips if a JDK is unavailable. Windows timeout/cancellation tests must be allowed to terminate their own child process trees.

No installer artifacts or public deployment are included. Desktop build and runtime are tested separately from OS installer signing/notarization.

## Web workspace and report presentation

The web app uses a full-width workspace, a persistent desktop sidebar and a keyboard-accessible mobile drawer. Report sections include Release overview, Findings & fixes, All checks, Build details, Android/iOS diagnostics, Store preparation and Manual verification. Findings explain the result, evidence, impact, next steps, verification and scope; the structured guidance is also included in exported JSON.

Appearance uses sage-green light and dark themes, with locally served Manrope headings and DM Sans body/subtitle text. Only `deploylens-theme` is saved in browser storage. Reports and review markers remain in memory. Common colors, font roles and sizes live in `packages/config/src`. The web build generates `apps/web/src/styles/theme-colors.css`; font-face declarations, browser fallbacks, shadows and layout remain in `variables.css` and web styles. Layout styles are split into `styles.css`, `workspace.css`, `home.css`, `report.css` and `documentation.css`; UI components contain no inline visual styles. Components and the upload lifecycle hook live separately under `components/` and `hooks/`.

### Sharing and optional build comparison

After inspection, **Share report & build** provides an editable subject/message, offline HTML report (printable to PDF), optional original-build download, native file sharing where supported, a single system Share action, and Copy message with an optional destination selector for mail/chat apps. A downloadable `.eml` includes the HTML report as a genuine attachment for compatible mail clients; the original archive must be attached separately. No email is sent automatically, cloud storage is not used, and there are no public report links. External apps may reject build files or attachments; direct compose links cannot attach local files.

**Compare builds** optionally inspects a previous archive of the same app while retaining the current report. It distinguishes confirmed fixes, newly reported issues, unresolved issues and unconfirmed fixes, with version/size/SDK/permission changes. A missing or skipped finding never counts as fixed. Single-build inspection remains the default. Drafts, selected original files, and both results stay in page memory until reload or a new inspection. Public product name/version are defined in `apps/web/src/product.ts` and shown in the footer.

### Opt-in local APK installation

Install Android SDK Platform-Tools and set `ANDROID_HOME` / `ANDROID_SDK_ROOT` or add `adb` to PATH. In PowerShell, enable local device access before starting the website:

```powershell
$env:DEPLOYLENS_LOCAL_DEVICES = '1'
$env:HOST = '127.0.0.1'
pnpm web
```

Open the local website (normally `http://127.0.0.1:3000`), inspect an APK, then use **Install on Android**. Authorize USB debugging or start an emulator, refresh devices, select a target, and confirm installation. Updating an existing app is an explicit opt-in; no uninstall is performed. Temporary installation copies are hash-checked against the inspected archive and removed afterward. This feature is disabled by default and restricted to local server connections and loopback hosts. Do not expose an enabled local device server through a reverse proxy or tunnel.

Hosted websites cannot access a visitor's local ADB devices. AAB conversion/APK-set installation is not included. Eligible IPA installation is available through local libimobiledevice/ideviceinstaller, including Windows with the Apple USB driver. Add the toolchain to PATH or set DEPLOYLENS_IOS_TOOLS to its directory. Unlock the USB-connected iPhone/iPad and trust the computer. IPAs must already be signed/provisioned for that device; no re-signing or trust bypass is performed. App Store profiles are directed to TestFlight. Both legacy and current installer command formats are supported. Installation does not launch the app, run runtime tests or change the assessment. The separate Electron interface does not yet expose this website installation feature.


### Diagnostic and workspace updates

Desktop navigation expands to a wider labeled menu or collapses to an accessible icon rail; mobile retains the drawer. Scrollbars are hidden while scrolling remains available. Build details use independent card columns. Store listing text edits directly in place and remains available across report navigation during the same page session. Comparison uses an archive drop zone instead of the native file control.

Android diagnostics now includes SDK/device compatibility, manifest features, release flags, transport declarations, permission inventories, exported components and package size alongside 16 KB alignment. Both platform diagnostics expose the new API-reference/declaration audit. The engine searches bounded DEX or iOS executable/framework entries (32 files, 64 MB aggregate, 32 MB per file); findings are heuristics and never claim runtime execution or automatic store rejection. Native/Dart/JNI, reflection, dynamic-feature manifests, encrypted/stripped code and iOS app-extension declarations remain outside full coverage. System pickers can avoid broad media permissions. Empty iOS purpose-key inventories no longer imply a successful permission audit.

Actionable findings include Research this issue: an editable Markdown context/reproduction draft, clipboard copy, and links to community and AI tools. Nothing is posted automatically.


## React Native mobile inspection (Phase 3)

The mobile app uses **React Native Community CLI** with TypeScript and native Android/iOS projects; it has no Expo dependency or runtime. It includes native navigation, sage-green light/dark/system themes, persistent inspection-service settings, native APK/AAB/IPA selection, file-path streaming with progress/cancellation, and native report sections for findings, checks, build details, platform diagnostics and manual verification.

```sh
pnpm mobile:build
pnpm mobile:test
pnpm mobile
pnpm mobile:android
```

The default Android emulator service URL is `http://10.0.2.2:3000`. A physical phone must use a reachable LAN/HTTPS address. Only appearance and service URL preferences are stored on the phone; reports and archives are not retained as mobile history. Android compilation and a complete APK picker/upload/report flow on a Pixel 6a emulator are verified. The iOS JavaScript bundle is verified on Windows, while CocoaPods/Xcode/device verification requires macOS. Representative AAB/IPA picker runs, physical devices and a production HTTPS service remain release-validation work.

Phase 1 extracted reusable client logic from web without importing browser or Node APIs into mobile-safe packages.

Run `pnpm build`, `pnpm typecheck`, `pnpm check:boundaries`, `pnpm test`, and `pnpm test:e2e` for repository verification. `pnpm web` / `pnpm server` both start the service in `apps/server/src`; `pnpm --filter @deploylens/web start` remains a forwarding convenience. The website still serves at port 3000 by default and Vite proxies `/api` to it during development.

Pure client packages compile without DOM or Node global types. The boundary check rejects imports of the Node inspection engine, DOM UI, or sibling source paths. Each app supplies its own upload, picker, clipboard, export and sharing adapters. Current and baseline inspection stores are separate; report-session state contains review markers and editable drafts, never platform file objects. State is not persisted.

See [Architecture and package boundaries](docs/ARCHITECTURE.md) and [Mobile implementation plan](docs/MOBILE_IMPLEMENTATION_PLAN.md).
