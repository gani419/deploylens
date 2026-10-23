# Phase 5 progress

Started: October 23, 2026.

Status: desktop implementation complete on Windows. Changes remain local until the owner explicitly requests a Git push. Public release qualification still requires signing credentials and macOS/Linux/device environments.

## Delivered

- Added Electron Builder configuration for unpacked applications and Windows NSIS/ZIP, macOS DMG/ZIP and Linux AppImage/tar.gz targets.
- Bundled the Electron main process, preload, inspection worker and web assets so packaged applications do not depend on pnpm workspace symlinks at runtime.
- Replaced the reduced desktop renderer with the shared production web workspace on an ephemeral loopback-only service. Desktop now exposes the same report navigation, themes, diagnostics, editable store preparation, manual markers, research drafts, sharing/export, comparison and local-device workflow as the website.
- Hardened desktop IPC. Only the main frame may select builds, inspect, cancel, open links or write the clipboard. Permission requests are denied, packaged DevTools are disabled, and inspection accepts only the real path most recently returned by the native APK/AAB/IPA picker.
- Removed the unrestricted file filter and reject unsupported extensions before an archive reaches the engine.
- Added the DeployLens product icon to Windows, macOS and Linux packaging with a reproducible SVG-to-PNG/ICO build step.
- Added source-shell, packaged-app and Windows installer qualification scripts.

## Desktop parity

| Capability | Web | Mobile | Desktop at Phase 5 start | Phase 5 state |
| --- | --- | --- | --- | --- |
| Local APK/AAB/IPA inspection | Service | Service client | Local engine | Complete |
| Release assessment and store guidance | Yes | Yes | Yes | Complete |
| Full report side navigation and light/dark themes | Yes | Native sections | No | Complete through shared workspace |
| Android/iOS diagnostic panels | Yes | Yes | Partial assessment facts | Complete through shared workspace |
| Editable listing drafts and manual markers | Yes | Yes | Copy-only templates | Complete through shared workspace |
| Research drafts | Yes | Yes | Partial copy actions | Complete through shared workspace |
| Report/build sharing and HTML/JSON export | Yes | Yes | No | Complete through shared workspace |
| Previous-build comparison | Yes | Yes | No | Complete through shared workspace |
| Local Android/eligible iPhone installation | Local web service | Not visitor USB | No desktop UI | UI/service complete; hardware validation pending |
| Installable desktop artifact | N/A | Native projects | No | Branded unsigned Windows NSIS and ZIP verified locally |

## Local Windows artifacts

- `DeployLens-1.0.0-win-x64.exe` — 81,164,779 bytes — SHA-256 `067340AD34D7613AB99BF359DBB625EE5016F3F2407699B66E72944E834443A8`
- `DeployLens-1.0.0-win-x64.zip` — 112,817,314 bytes — SHA-256 `297E435A5EE31D3C7D98B9AE2DB915CE943F64CB0D3A7AFA142DC239733AA12C`

These artifacts use the DeployLens icon but are unsigned. They are local qualification outputs, not public releases.

## Verification evidence

- Workspace type checks passed for all 17 applicable projects.
- Package-boundary validation passed.
- Unit/integration suite passed: 20 files and 122 tests, including signing, archive safety, permission diagnostics, web upload cleanup and offline operation.
- Browser suite passed all 15 web flows. On this managed Windows host, Chrome retained its process tree after reporting the completed tests, so the runner required host cleanup after the pass output.
- `pnpm desktop:verify` passed the Electron preload bridge, shared workspace, real APK inspection, sharing/comparison controls and local-device dialog. The verifier explicitly terminates Electron's Windows process tree because this managed host blocks normal sandbox cleanup.
- `verify-packaged-app.ps1` passed a real inspection through the packaged executable and its embedded worker.
- The NSIS installer silently installed the application and the installed executable passed the packaged inspection. The generated silent uninstaller returned success but left installed files on this managed host, so uninstall is not recorded as passed.

## External release gates

- Re-run uninstall and upgrade tests on a normal Windows release machine. Code signing requires an owner-provided certificate.
- Build, sign and notarize macOS artifacts on macOS with owner-provided Apple credentials.
- Build and smoke-test Linux packages on a supported Linux environment.
- Complete a manual accessibility/keyboard review on each release operating system.
- Validate APK installation with ADB and eligible IPA installation with trusted hardware, drivers and valid provisioning. No signing or provisioning bypass is provided.
- Record large-archive memory use and platform tool availability on release hardware.
