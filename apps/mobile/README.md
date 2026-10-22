# DeployLens mobile

DeployLens mobile is a React Native Community CLI client. It selects one APK, AAB or IPA through the system document provider, uploads a private cache copy to the configured inspection service, streams NDJSON progress, and renders the resulting report. The inspection engine remains on the Node service and is not bundled into the phone application.

## Requirements

- Node.js 22 and the repository's pinned pnpm version
- JDK 17 and an Android SDK for Android builds
- macOS, Xcode and CocoaPods for iOS native builds
- A reachable DeployLens inspection service

From the repository root:

```powershell
pnpm.cmd install --frozen-lockfile
pnpm.cmd mobile:test
pnpm.cmd mobile:build
pnpm.cmd --filter @deploylens/mobile android:build
```

Start the service in one terminal and Metro in another:

```powershell
pnpm.cmd server
pnpm.cmd mobile
```

Run Android with `pnpm.cmd mobile:android`. The Android emulator reaches the host service at `http://10.0.2.2:3000`. A physical phone must use the development computer's reachable LAN address or a production HTTPS endpoint; `localhost` refers to the phone itself.

On macOS, install pods from `apps/mobile/ios` and run `pnpm mobile:ios`. Use a valid signing team when running on a physical iPhone.

## Data lifecycle

Selected archives are copied to the application cache because provider handles may expire. The current successful build remains in temporary cache for optional sharing until the report is reset, another build is chosen, or Remove cached original build is used. Failed/cancelled inspections and previous-build comparisons remove their copies when they end. Startup cleanup removes owned orphaned archive copies left by an interrupted process. Reports and archives are not retained as history; only appearance and inspection-service URL preferences persist.

## Collaboration and comparison (Phase 4)

Reports include native sharing with an editable subject/message and an optional original archive. Choose readable HTML or structured JSON and save/share through an available OS target. HTML includes edited listing drafts and manual-review markers without changing the automated verdict. Clipboard actions provide message, listing and research text. Receiver file limits and support vary; verify delivery in the chosen app.

Listing drafts save as you type. Drafts, review markers and comparison reports live in the inspection provider, survive screen navigation, and reset with the current report. Previous-build inspection has separate progress, cancellation and errors. Shared comparison rules reject unrelated apps and require explicit passing evidence at the same rule revision to confirm a fix.

Native share attachments use owned temporary export directories. Cancelled/failed exports are deleted immediately. Successful handoffs remain readable until the next app launch because a recipient can read files after the share sheet resolves. An optional build attachment is copied natively into that directory so clearing the current inspection cannot invalidate an ongoing handoff. No export is uploaded automatically or saved as report history. Copies explicitly saved by the recipient are controlled by that recipient.

See [Phase 4 progress](../../docs/PHASE_4_PROGRESS.md) for verification and open device checks.

## Release gate

The JavaScript bundles, Android native build and Android emulator APK inspection flow are verified. Before calling Phase 3 release-qualified, complete the physical-device and iOS matrix in [`../../docs/PHASE_1_3_AUDIT.md`](../../docs/PHASE_1_3_AUDIT.md).
