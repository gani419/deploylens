# Platform Capability Matrix

DeployLens dynamically queries the host environment and adjusts inspection depth accordingly. This matrix documents check outcomes based on available platform tools and operating systems.

| Stage / Check | Windows / Linux (No Android SDK) | Windows / Linux (With Android SDK) | macOS (With Android & Xcode CLI) |
| :--- | :---: | :---: | :---: |
| **Android Archive Integrity** | Fully Supported (Built-in ZIP) | Fully Supported (Built-in ZIP) | Fully Supported (Built-in ZIP) |
| **Android Manifest Extraction** | Fully Supported (Built-in AXML) | Fully Supported (`apkanalyzer` / AXML) | Fully Supported (`apkanalyzer` / AXML) |
| **SDK Compatibility (targetSdk, minSdk, maxSdk)** | Fully Supported | Fully Supported | Fully Supported |
| **Release Configuration (debuggable, testOnly)** | Fully Supported | Fully Supported | Fully Supported |
| **APK Signature Verification** | Structural V2/V3 Block Parse | Cryptographic Verification (`apksigner`) | Cryptographic Verification (`apksigner`) |
| **AAB Signature Verification** | JAR Signature Block Parse | JAR Signature Block Parse | JAR Signature Block Parse |
| **Native 64-Bit Coverage** | Fully Supported (Built-in ELF) | Fully Supported (Built-in ELF) | Fully Supported (Built-in ELF) |
| **16 KB ELF Page Alignment** | Fully Supported (Built-in ELF) | Fully Supported (Built-in ELF / `readelf`) | Fully Supported (Built-in ELF / `readelf`) |
| **APK Zip Alignment** | Not Checked (`zipalign` missing) | Fully Supported (`zipalign`) | Fully Supported (`zipalign`) |
| **Security & Permissions Audit** | Fully Supported | Fully Supported | Fully Supported |
| **Module / Packaging Breakdown** | Fully Supported | Fully Supported | Fully Supported |
| **iOS IPA Payload Structure** | Fully Supported | Fully Supported | Fully Supported |
| **iOS Info.plist Parsing (XML & Binary)** | Fully Supported (Built-in) | Fully Supported (Built-in) | Fully Supported (Built-in) |
| **iOS Mach-O Architectures** | Fully Supported (Built-in) | Fully Supported (Built-in) | Fully Supported (Built-in) |
| **iOS Purpose Strings Audit** | Fully Supported | Fully Supported | Fully Supported |
| **iOS App Transport Security (ATS)** | Fully Supported | Fully Supported | Fully Supported |
| **iOS Privacy Manifest Parsing** | Fully Supported | Fully Supported | Fully Supported |
| **iOS Mobileprovision Profile Parse** | Cross-Platform CMS Reader | Cross-Platform CMS Reader | Cross-Platform / `security cms` |
| **iOS Cryptographic Code Signing** | Not Checked (Requires macOS) | Not Checked (Requires macOS) | Fully Supported (`codesign -dvvv`) |
| **Store Listing Guidance Generation** | Fully Supported (Local Templates) | Fully Supported (Local Templates) | Fully Supported (Local Templates) |

---

## Capability Status Definitions

- **Fully Supported**: Check executes completely using native platform tools or self-contained binary inspection algorithms.
- **Not Checked**: The check cannot be performed with cryptographic authority due to missing host platform tools (e.g. `codesign` on Windows). It is reported as `Not checked` with an explanation and impacts the readiness status (`REVIEW REQUIRED`). It is **never** falsely marked as "Passed".
- **Not Applicable**: The rule does not apply to this artifact type (e.g. `zipalign` on an AAB, or AAB bundle signing on an APK).
