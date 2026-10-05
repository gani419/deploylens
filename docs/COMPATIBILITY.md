# Tool & Dependency Compatibility Guide

DeployLens is designed to run offline on local developer machines without external network dependencies or telemetry.

## Node.js & Package Manager Runtime

| Component | Tested Version | Minimum Supported | Notes |
| :--- | :--- | :--- | :--- |
| **Node.js** | `v22.18.0` / `v24 LTS` | `>=22.0.0` | Strict NodeNext ESM module resolution. |
| **pnpm** | `12.9.1` | `>=10.0.0` | Monorepo workspace orchestration. |
| **TypeScript** | `5.8.2` | `^5.7.0` | Strict mode enabled, zero implicit any. |
| **React** | `19.3.0` | `19.3.0` | Exact pinned React and React DOM release. |
| **Electron** | `34.3.0` | `^34.0.0` | Embedded Chromium & Node runtime (isolated renderer). |
| **Vite** | `6.2.0` | `^6.0.0` | Fast renderer bundling and dev server. |

---

## Android Toolchain Compatibility

DeployLens features built-in fallback parsers in pure TypeScript for APK and AAB inspection, allowing standard analysis even if the Android SDK is not installed or only partially present. When official platform tools are installed, DeployLens leverages them for authoritative verification.

| Tool | Tested Version | Detection Path | Supported Checks | Fallback Behavior |
| :--- | :--- | :--- | :--- | :--- |
| **`apksigner`** | Android SDK Build-Tools `37.0.0` / `36.0.0` | `$ANDROID_HOME/build-tools/<version>/apksigner` or PATH | Cryptographic signature scheme v1, v2, v3, and v4 verification; signer certificate extraction. | Pure TypeScript APK Signing Block parser extracts scheme v2/v3 blocks and signer certificates. |
| **`apkanalyzer`** | Android SDK cmdline-tools `latest` | `$ANDROID_HOME/cmdline-tools/latest/bin/apkanalyzer` or PATH | Manifest dump, package summary, DEX bytecode metrics. | Pure TypeScript Android Binary XML (AXML) parser decodes `AndroidManifest.xml` directly. |
| **`zipalign`** | Android SDK Build-Tools `37.0.0` / `36.0.0` | `$ANDROID_HOME/build-tools/<version>/zipalign` or PATH | 4-byte entry alignment verification for uncompressed assets and shared libraries. | Marked as `Not checked` if zipalign is unavailable (never claims passed without verification). |
| **`bundletool`** | `bundletool.jar` | PATH or environment | AAB manifest dump, universal APK generation, device targeting simulation. | Pure TypeScript AAB module and proto-manifest archive reader. |
| **`readelf`** | GNU readelf / LLVM readelf | System PATH | ELF 32/64-bit headers and program header load segment alignment. | Built-in TypeScript ELF header & segment analyzer (verifies `p_align >= 16384` for 16 KB page sizes). |

---

## iOS Toolchain Compatibility

| Tool | Host OS Requirement | Supported Checks | Limitation on Non-macOS Hosts |
| :--- | :--- | :--- | :--- |
| **`codesign`** | macOS (Darwin) only | Cryptographic code signature verification and sealed resource hash validation. | Unavailable on Windows and Linux. Produces **Not checked**, never "Passed". |
| **`security`** | macOS (Darwin) only | CMS / PKCS#7 decoding of `embedded.mobileprovision`. | DeployLens includes a cross-platform PKCS#7 envelope reader that extracts the embedded XML property list on Windows and Linux without macOS security tools. |
| **`plist`** | Cross-platform (Node.js) | XML and binary property list parsing (`bplist00` and XML). | Supported on Windows, Linux, and macOS. |
| **`macho`** | Cross-platform (Node.js) | Mach-O 32-bit, 64-bit, and Universal Fat binary architecture parsing (arm64, armv7, x86_64). | Supported on Windows, Linux, and macOS. |
| **`PrivacyInfo`** | Cross-platform (Node.js) | Privacy manifest syntax and API categories. | Supported on Windows, Linux, and macOS. |

---

## Security Safeguards

1. **Untrusted Archive Defense**: Safe ZIP reader with path traversal protection (blocks Zip Slip attempts like `../../`), entry count bounds (50,000 max), uncompressed size ceilings (2GB max), and decompression ratio limits (100:1 max) to prevent ZIP bombs.
2. **Process Execution**: Command invocation strictly uses argument arrays (`execFile`), never raw shell string interpolation.
3. **No Network Activity**: DeployLens makes 0 network calls during scan operations. All checks run locally offline.
4. **Temporary Workspaces**: Ephemeral directories are created in the system temp directory and cleaned up automatically upon scan completion, failure, cancellation, or process exit.
