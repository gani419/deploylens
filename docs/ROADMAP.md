# Future Roadmap & Extensibility

DeployLens is built with modular package boundaries to support seamless evolution toward IDE integrations and local physical device automation without rewriting inspection logic.

## Phase 1 (Completed Delivery)
- Local shared inspection engine (`@deploylens/core`, `@deploylens/rules`, `@deploylens/android`, `@deploylens/ios`).
- CLI tool (`deploylens doctor` & `deploylens scan`).
- Electron desktop interface with drag-and-drop, live stage progression, categorized findings, and offline store guidance.
- Pure local offline execution, zero telemetry, zero database persistence.

---

## Phase 2: VS Code & Cursor IDE Extension
The shared engine (`@deploylens/core` and `@deploylens/contracts`) is decoupled from both Electron and the CLI. This allows straightforward integration into a VS Code extension:
- **Direct Workspace File Inspection**: Automatically detect output APK/AAB builds in `build/outputs/apk/release/` or Xcode IPA export directories.
- **Diagnostics & Problem Panel**: Render findings as VS Code diagnostics mapped directly to lines in `AndroidManifest.xml` or `Info.plist`.
- **Custom Editor / Webview Panel**: Reuse `@deploylens/ui` components inside a VS Code Webview panel for side-by-side inspection.

---

## Phase 3: Local Device Automation & Runtime Profiling
Architectural adapter interfaces (`DeviceRunnerAdapter`) are pre-designed for future physical device testing:
- **Local ADB Device Bridge**: Query connected physical devices or Android emulators via ADB without cloud services.
- **Installation & Launch Verification**: Validate `adb install -r <apk>` succeeds and detects immediate launch crashes (e.g. 16 KB page-size kernel crashes, missing shared libraries, missing permissions).
- **iOS Device Bridge (macOS)**: Connect to physical test devices via `xcrun devicectl` to verify provisioning profile installation and launch viability.
- **Layout Screenshots**: Capture automated screenshots across phone, tablet, and foldable configurations for store asset preparation.

---

## Architectural Principles Preserved
- All processing remains 100% on the developer's workstation.
- Zero credential requirements or telemetry.
- Private signing keys are never ingested or requested.
