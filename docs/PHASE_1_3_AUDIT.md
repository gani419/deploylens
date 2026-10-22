# Phase 1–3 completion audit

Audit date: October 22, 2026

Phase 4 is gated on the Phase 3 release-validation rows below. Passing compilation or fixture tests does not replace physical-device evidence.

## Phase 1 — shared foundations

Status: complete.

| Exit criterion | Evidence |
| --- | --- |
| Shared client packages remain free of DOM/Node dependencies | `pnpm check:boundaries` passes. |
| Web, desktop, CLI and server compile after extraction | `pnpm build` passes for every workspace application and package. |
| Upload, report, sharing, comparison, cancellation and server cleanup regressions pass | 112 Vitest checks and 16 browser/Electron checks pass. |
| Server and UI ownership are separated | The Node service is under `apps/server`; web transport is under `apps/web`; portable contracts, state and decoding are root packages. |

No Phase 1 implementation gaps were found. The older architecture text that called mobile “planned” was corrected.

## Phase 2 — React Native shell

Status: implementation complete; iOS native release evidence is gated by macOS hardware.

| Exit criterion | Evidence |
| --- | --- |
| Community CLI application without Expo | React Native 0.88 project contains native Android and iOS projects and has no Expo dependency. |
| Shared packages bundle without DOM/Node polyfills | Boundary checks plus Android and iOS production Metro bundles pass. |
| Theme, navigation, settings and service health states | Implemented in native components; TypeScript and preference tests pass. |
| Android native compilation | `assembleDebug` succeeds for all configured ABIs. |
| iOS native compilation and launch | Requires macOS/Xcode; the iOS production JavaScript bundle passes on Windows. |

## Phase 3 — mobile inspection flow

Status: implementation complete; release qualification remains blocked on the external matrix below.

| Exit criterion | Evidence |
| --- | --- |
| APK/AAB/IPA selection and validation | Native document-provider adapter accepts the three supported formats, enforces service size limits and rejects virtual/invalid documents. |
| Streaming upload, progress and event rendering | Native path streaming uses the shared NDJSON protocol; the emulator APK flow previously completed against the real service. |
| Cancellation, malformed streams and connection/service errors | Native transport tests cover progress, terminal errors, HTTP errors, truncated success responses and cancellation. A response without a terminal event can no longer appear complete. |
| Temporary-file cleanup | Completion/failure/cancellation cleanup and startup orphan cleanup are implemented; server cleanup is covered by integration tests. |
| Native result sections | Overview, findings, checks, build details, platform diagnostics and manual verification are implemented. |
| Android native artifact | The debug APK builds successfully with React Native native dependencies and all configured ABIs. |

### Required external release matrix

These are validation tasks, not missing application code:

- Connect a physical Android phone and inspect representative signed release APK and AAB inputs through a reachable HTTPS service. Confirm cancellation, background/foreground transitions, cache cleanup and a flaky-network retry.
- On macOS, run CocoaPods/Xcode compile, an iOS simulator launch and a signed physical-iPhone run. Select and inspect a representative developer-exported IPA and confirm cache cleanup and transport security.
- Deploy the Node inspection service behind HTTPS with its JDK/Android tools, upload/time limits, writable temporary volume, memory/process quotas and edge rate limiting. Firebase currently hosts only the static web client.
- Record large representative archive memory/time results. The synthetic fixtures exercise parsing and protocol behavior but are not store-submittable release builds.

`adb devices -l` returned no connected devices during this audit. Windows cannot supply the Xcode/macOS evidence. Phase 4 must remain unstarted until the owner supplies those environments and the rows above are recorded as passed.

## Current automated evidence

- `pnpm build`: passed, including web/desktop/CLI/server and Android/iOS Metro bundles.
- `pnpm test`: 19 files and 112 tests passed.
- `pnpm mobile:test`: 2 suites and 6 tests passed.
- `pnpm test:e2e`: 16 browser/Electron tests passed.
- `pnpm --filter @deploylens/mobile android:build`: Android `assembleDebug` passed.
