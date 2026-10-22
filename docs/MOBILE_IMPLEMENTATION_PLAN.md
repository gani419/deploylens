# Shared architecture and React Native implementation plan

Status: Phases 1 and 2 are implemented. Phase 2 uses React Native Community CLI; there is no Expo dependency or runtime. Phase 3 is the next mobile phase.

## Current readiness

- Web: current requested workflows are implemented, with build/type checks, automated unit/server and browser regressions; current Phase 1 evidence is recorded in docs/ARCHITECTURE.md. This is a testing-ready implementation, not a completed public production deployment. Representative signed builds, real Android/iPhone installation, macOS codesign validation, hosting, quotas and abuse controls still need release validation.
- Desktop: an Electron app with local scanning and a sandboxed preload bridge exists. Its interface is separate from the newer web workspace and does not yet have complete sharing/comparison/diagnostic UI parity. Windows/macOS installer packaging, signing and macOS notarization are unfinished. Bridge smoke coverage is not full desktop release qualification.
- Mobile: the React Native shell, native Android/iOS projects, navigation, themes, service settings and honest report empty states are present. File picking, upload, streamed inspection results and report rendering begin in Phase 3. The shared engine uses Node filesystem/process APIs and external tools and remains behind the inspection service.

## Target ownership

Use the existing pnpm monorepo. Keep runnable products under `apps/` and reusable packages under the root-level `packages/` directory. Do not put shared utilities or state under `apps/web` or `apps/mobile`.

```text
DeployLens/
  apps/
    web/
      src/
        components/
        hooks/
        styles/
      public/
    mobile/
      src/
        app/              # Entry, providers, navigation and configuration
        screens/          # Native screens
        components/       # Native visual components
        adapters/         # Document picker, upload, sharing and files
        theme/            # Native styles derived from shared tokens
      assets/             # Mobile-only assets
    desktop/
      electron/           # Electron main process and preload
      src/                # Desktop renderer and platform adapters
    server/
      src/                # Shared inspection HTTP service, workers, local-device routes
    cli/
  packages/
    contracts/            # Existing shared types and wire-event contracts
    utils/                # Pure formatting, app identity and validation helpers
    reporting/            # Comparison, share/research text and report view models
    store/                # In-memory client session state and actions
    api-client/           # Health/inspection protocol and transport interfaces
    config/               # Product identity, supported formats and theme tokens
    ui-web/               # Existing DOM UI, used by web/Electron only
    core/                 # Node-only scan lifecycle and archive handling
    android/              # Existing platform inspection algorithms/tool adapters
    ios/                  # Existing platform inspection algorithms/tool adapters
    rules/                # Existing versioned inspection rules
    store-guidance/       # Existing store listing generation
  docs/
  tests/
```

Phase 1 moves the server into `apps/server/src` and renames the existing DOM component package to `packages/ui-web`. Shared client packages must remain safe for the native runtime.

Avoid placeholder packages with no consumers. Extract each package when its real code is migrated, and update every import, script, test, Docker path and deployment instruction together. Keep the workspace lockfile authoritative.

## Sharing boundaries

- Share data contracts, pure transformations, comparison rules, generated message text, research templates, draft/review state and design tokens.
- Share session state without browser or native dependencies. It should not depend on React, a DOM, Node, `localStorage` or a particular storage library. React integration can sit at the app boundary. Add a state library only if the implementation needs it.
- File selection and transfer are adapters: the browser uses a `File`, mobile uses a picker URI/native file handle, and desktop uses a filesystem selection. Shared state stores portable metadata and platform-neutral handles, not DOM `File` or Node `Buffer` objects.
- Share upload event parsing and transitions, while keeping actual file transport, progress and cancellation behind platform adapters. The current raw-binary upload API must stay compatible during migration.
- Keep HTML export, browser downloads, `mailto` and DOM clipboard APIs in web adapters. Native exports write to the app cache and use the OS share sheet. Reuse the report content/model, not browser APIs.
- Keep CSS and HTML components in web/desktop. Mobile uses React Native `View`, `Text`, `Pressable`, `TextInput` and native styling. Common colors/spacing/product identity can feed both styling systems; CSS files are not native styles.
- Keep Node filesystem/process/tool execution out of the mobile dependency graph. The first mobile release sends a selected archive to the inspection service and displays the returned evidence. It does not pretend to scan with local Android SDK or Apple tools on a phone.
- Preserve current retention behavior: no database, no upload history and no automatic persistence of reports or drafts. Appearance and explicitly configured connection preferences are separate from build retention.

## Phase 1 — Shared foundations and safe extraction

Scope:

1. Inventory browser-only, Node-only and pure code; document dependency boundaries.
2. Extract product/configuration and pure presentation helpers into `packages/config` and `packages/utils`.
3. Extract comparison and text generation into `packages/reporting`; retain web file/HTML/MIME export adapters under web.
4. Introduce `packages/store` for session transitions, current/baseline summaries, reviewed items and editable drafts. Keep upload requests and file handles in app adapters.
5. Separate the inspection HTTP service into `apps/server`, preserving endpoints, limits, cleanup and local-only installation guards.
6. Separate/label the existing DOM component package as `ui-web`; update its web/desktop consumers.

Exit criteria:

- Web and desktop build/type checks still pass.
- Existing upload, report, editor, sharing, comparison and local-device tests pass.
- Shared client packages have no DOM or Node runtime imports, and application code imports them through workspace package names rather than sibling source paths.
- No mobile application changes are required to finish this phase.

Phase 1 implementation notes and verification are tracked in [Architecture](ARCHITECTURE.md).

## Phase 2 — React Native shell

Use React Native Community CLI and TypeScript, with native android/ and ios/ projects under apps/mobile. Select and pin compatible React Native, React, Community CLI, Metro, Android Gradle/JDK and CocoaPods/Xcode versions using official guidance. Do not copy the web React version into native dependencies automatically. No Expo dependency or runtime will be introduced.

Scope:

- Create `apps/mobile` with native navigation, home/upload entry, report section navigation, light/dark theme, shared product version and settings for the inspection service URL.
- Add file-picker, font and native-sharing dependencies only as needed, using React Native-compatible versions.
- Use native visual components and the existing sage-green direction; reuse common tokens and content.
- Show clear disconnected/empty states. Do not show fabricated inspection results when the server is absent.

Exit criteria:

- Dependency/React Native CLI doctor checks, TypeScript checks and native bundle generation pass.
- The shell launches on an Android emulator; record iOS build/run evidence separately.
- Shared client packages bundle without Node/DOM polyfills, duplicate React installations or accidental inspection-tool dependencies.

Implementation evidence (October 22, 2026):

- Pinned React Native 0.88.0, React 19.3.0 and Community CLI 20.2.0 with Community CLI-generated Android and iOS projects.
- TypeScript, preference tests, shared-package boundaries, Android production bundle and iOS production bundle pass.
- Android `assembleDebug` succeeds for the universal APK. The APK was installed and launched on the existing Pixel 6a/API 33 emulator; ADB confirmed the foreground activity and native accessibility trees for Home and Settings, with no React Native JavaScript or Android runtime crash.
- Navigation, SVG icons, shared sage-green tokens, system/light/dark appearance, product version, persistent service URL, URL validation and a timed `/api/health` check are implemented. Only appearance and connection preferences are persisted.
- The Community CLI doctor currently aborts on this Windows image because its `envinfo` dependency calls the removed `wmic` command. Node 22.18, JDK 17, Android SDK/ADB, CLI project discovery, native dependency autolinking and Gradle compilation were checked directly instead.
- iOS JavaScript bundle generation passes on Windows. CocoaPods, Xcode compile, simulator/device launch and code signing remain unverified because they require macOS and are recorded as release-validation work.

## Phase 3 — Mobile inspection flow

Scope:

- Pick one APK/AAB/IPA from Files, validate supported type/size, display filename/type, upload with progress and stream inspection events.
- Handle timeout, cancellation, malformed archives, connection loss and service busy responses.
- Keep single-build upload the default.
- Render release overview, Findings & fixes, All checks, Build details, platform diagnostics and manual verification.
- Surface declaration/reference analysis as heuristic evidence; no invented runtime tests or store approval claims.

Exit criteria:

- Real service integration works with APK, AAB and IPA fixtures and representative release archives.
- Cancellation does not leave stale results and server temporary files are cleaned up.
- Android emulator networking and a physical phone connection are tested; the device must reach the configured server. `localhost` on a phone is the phone, not the developer PC.
- Production uses an appropriate HTTPS service. Development LAN/emulator exceptions must not weaken production transport settings.

## Phase 4 — Mobile collaboration and report parity

Scope:

- Native share sheet with editable context and optional original build; explain unsupported file types/receivers.
- Cache-based report export and OS sharing, plus clipboard/research templates.
- Tap-to-edit store listing drafts and manual-review markers.
- Optional previous-build comparison using the same comparison logic as web.
- Clear/reset session behavior and cleanup of app-created temporary exports.

Exit criteria:

- Shared comparison results agree across web/mobile for identical inputs.
- Share/copy/edit flows work on physical Android and iOS devices, including cancellation and unsupported targets.
- Drafts and reports follow the stated retention policy.

## Phase 5 — Desktop parity and release qualification

Scope:

- Bring the desktop renderer to agreed web feature parity using shared models/state, keeping Electron IPC and local files behind desktop adapters.
- Validate real APK and eligible IPA installation with installed device tools, actual USB drivers, trusted devices and suitable signing/provisioning. A hosted/mobile client must not be offered server-local device access as if it controlled the visitor's USB devices.
- Finish Windows/macOS installers, signing/notarization and upgrade behavior.
- Validate Android/iOS mobile builds, accessibility, native sharing, large-file memory use, flaky networks and lifecycle/background behavior.
- Prepare store metadata/privacy declarations and public service operation checks. A database/history feature remains a separate future phase.

Exit criteria:

- Record an explicit platform/feature matrix, known limitations, automated test results and real-device evidence.
- Produce installable release artifacts for the chosen platforms. Do not call an app production-ready merely because its bundle compiles.

## Implementation order

Phases 1 and 2 are implemented. Reusable packages are consumed by the existing apps, and the native Android/iOS shell now sits on those boundaries. Phase 3 is next: real file selection, upload, streamed scan state and native result screens. Desktop feature parity, installers/signing and cross-platform release qualification remain Phase 5 rather than being marked complete based on the web implementation.

Official references:

- React Native without a framework: https://reactnative.dev/docs/getting-started-without-a-framework
- React Native environment setup: https://reactnative.dev/docs/set-up-your-environment
- Community CLI: https://github.com/react-native-community/cli
