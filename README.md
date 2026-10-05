# DeployLens

> **Inspect your app. Prepare your release.**

DeployLens is a fully local mobile app build inspection tool. A developer selects an Android APK/AAB or an iOS IPA, and DeployLens inspects the artifact step by step, validates platform configurations, checks store readiness, and generates offline Google Play and Apple App Store preparation guidance.

---

## Key Highlights

- **100% Local Execution**: All build inspection happens locally on your workstation.
- **Zero Telemetry or Cloud APIs**: No login, accounts, remote backend, analytics, telemetry, or external AI APIs.
- **Strict Ephemeral State**: Scan results and app metadata are kept purely in memory. No SQLite, IndexedDB, or local file logging.
- **Archive Security**: Built-in safe ZIP reader with path traversal protection (Zip Slip prevention), entry count caps, and bomb ratio checks.
- **Original Artifact Immutability**: DeployLens never modifies, re-signs, or alters the input binary.
- **Shared Architecture**: CLI and Electron desktop interface share the exact same inspection engine (`@deploylens/core`).

---

## Monorepo Architecture

```
DeployLens/
├── apps/
│   ├── cli/            # Commander CLI tool (`deploylens doctor`, `deploylens scan`)
│   └── desktop/        # Electron desktop interface with React 19 and Vite
├── packages/
│   ├── contracts/      # Typed metadata, findings, stages, capabilities, events
│   ├── core/           # Scan lifecycle, safe ZIP reader, workspace cleanup, engine
│   ├── android/        # AXML parser, ELF segment inspector, APK/AAB signing
│   ├── ios/            # Plist parser, Mach-O parser, privacy manifest, macOS adapter
│   ├── rules/          # Versioned technical and policy rules with official sources
│   ├── store-guidance/ # Local deterministic templates and store release checklist
│   └── ui/             # Reusable presentation components (React 19, CSS variables)
├── fixtures/           # Controlled test fixtures (.apk, .aab, .ipa, corrupt, traversal)
└── docs/               # Architecture, tool matrix, compatibility, and roadmap
```

---

## Installation & Setup

### Prerequisites
- **Node.js**: `v22.x` LTS or `v24.x` LTS
- **pnpm**: `v10.x` or `v12.x` (Corepack or `npm install -g pnpm`)
- **Android SDK** (optional): `apksigner`, `apkanalyzer`, `zipalign`
- **macOS / Xcode CLI** (optional for iOS cryptographic codesign verification)

### Setup
```bash
# Clone the repository
git clone https://github.com/gani419/deploylens.git
cd deploylens

# Install dependencies
pnpm install

# Build all packages and applications
pnpm build

# Run test suite
pnpm test
```

---

## CLI Usage

### Check Local Tool Capabilities
```bash
# Human readable output
pnpm cli doctor

# Clean JSON output for automated scripting
pnpm cli doctor --format json
```

### Inspect an Artifact
```bash
# Human readable live progression and assessment
pnpm cli scan fixtures/android/valid-app.apk

# With optional app details to customize store listing templates
pnpm cli scan fixtures/android/test-app.aab --purpose "Personal finance tracker" --users "Students"

# Clean JSON output (no progress text mixed into stdout)
pnpm cli scan fixtures/android/valid-app.apk --format json
```

### CLI Exit Codes
- `0`: Scan passed all available checks (`PASSED AVAILABLE CHECKS`) or doctor completed successfully.
- `1`: Invalid input arguments, missing file, or corrupt archive header.
- `2`: Confirmed submission blockers identified (`ACTION REQUIRED`).
- `3`: Unresolved review flags or host tool coverage gaps (`REVIEW REQUIRED`).
- `4`: Critical inspection failure or stage exception (`INCOMPLETE`).

---

## Desktop Application

Run the Electron application:
```bash
# Start Vite development server
pnpm desktop

# Or run production built desktop bundle
pnpm desktop:build
pnpm --filter @deploylens/desktop start
```

### Desktop Flow
1. **Screen 1 (Select Build)**: Drag-and-drop or browse for `.apk`, `.aab`, or `.ipa`. Inspects file metadata, displays local tool capabilities, and accepts optional in-memory app details.
2. **Screen 2 (Live Validation)**: Real-time stage progression with indicators and expandable findings rows.
3. **Screen 3 (Final Assessment)**: Evidence-based readiness status (`ACTION REQUIRED`, `REVIEW REQUIRED`, `PASSED AVAILABLE CHECKS`, `INCOMPLETE`), blocker and risk counts, coverage ratio, and mandatory unverified areas.
4. **Screen 4 (Store Preparation)**: Local deterministic listing title/description generator with validated character counters, and release checklist.

---

## Supported Inspection Stages

### Android (9 Stages)
1. **Validate artifact**: Identity, archive integrity, required manifest entries.
2. **Read app information**: Package ID, app label, version code, version name.
3. **Read OS and device declarations**: `minSdkVersion`, `targetSdkVersion` (API 34/35 Google Play policy), `maxSdkVersion` audit (reports "Not declared" if absent).
4. **Inspect release configuration**: `android:debuggable` and `android:testOnly` (distinguishing explicit values from resolved defaults).
5. **Inspect signing**: APK Signature Schemes v1/v2/v3/v4; original AAB bundle upload key verification.
6. **Inspect native libraries**: ABI inventory, 64-bit architecture coverage, ELF 16 KB page alignment for Android 15, and 4-byte zip alignment.
7. **Review permissions and security configuration**: High-risk/restricted permissions requiring Google Play policy declaration, cleartext HTTP traffic, and exported components.
8. **Review packaging**: Archive breakdown (DEX, native libs, assets, resources) and large file analysis.
9. **Generate store guidance and assessment**: Category inference and submission checklist.

### iOS (8 Stages)
1. **Validate IPA archive and Payload structure**: Standard `Payload/<App>.app` hierarchy.
2. **Read main app Info.plist**: Binary and XML property list parsing.
3. **Extract identity and versioning**: `CFBundleIdentifier`, `CFBundleShortVersionString`, `CFBundleVersion`, `MinimumOSVersion`, `UIDeviceFamily`.
4. **Inspect embedded frameworks and architectures**: Mach-O parsing (arm64, armv7, universal fat binaries), frameworks, and app extensions.
5. **Inspect purpose strings and transport security**: Required privacy usage strings (`NSCameraUsageDescription`, etc.) and ATS configuration.
6. **Parse privacy manifests**: Structural audit of `PrivacyInfo.xcprivacy` and Required Reason APIs.
7. **Inspect entitlements and signing**: `embedded.mobileprovision` profile type, entitlements, and macOS `codesign` validation.
8. **Generate store guidance and assessment**: App Store Connect metadata limits, keywords, and review notes checklist.

---

## Documentation

- [Tool & Dependency Compatibility Guide](docs/COMPATIBILITY.md)
- [Platform Capability Matrix](docs/CAPABILITY_MATRIX.md)
- [Rule Authoring Guide](docs/RULE_AUTHORING.md)
- [Future Roadmap (Device Automation & IDE Integration)](docs/ROADMAP.md)

---

## Official Disclaimer

> **This tool can make mistakes or miss issues. Results are guidance and do not guarantee production readiness or approval by Google Play or the App Store. Always verify findings manually and test your app before submitting it.**
