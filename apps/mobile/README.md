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

Selected archives are copied to the application cache because provider handles may expire. The copy is removed after completion, failure, cancellation or reset. Startup cleanup removes orphaned APK/AAB/IPA copies left by an interrupted process. Reports and archives are not retained as history; only appearance and inspection-service URL preferences persist.

## Release gate

The JavaScript bundles, Android native build and Android emulator APK inspection flow are verified. Before calling Phase 3 release-qualified, complete the physical-device and iOS matrix in [`../../docs/PHASE_1_3_AUDIT.md`](../../docs/PHASE_1_3_AUDIT.md).
