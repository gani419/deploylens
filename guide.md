# DeployLens Local Run & User Guide

Welcome to **DeployLens**, a fully local mobile application build inspection tool for Android APK/AAB and iOS IPA artifacts.

This guide provides step-by-step instructions to run DeployLens as **localhost** in your web browser, run the native **Electron desktop application**, and use the **Command-Line Interface (CLI)** with all available options and test fixtures.

---

## Table of Contents
1. [Prerequisites & System Requirements](#1-prerequisites--system-requirements)
2. [Installation & Project Setup](#2-installation--project-setup)
3. [Running as Localhost (Web Browser Preview)](#3-running-as-localhost-web-browser-preview)
4. [Running the Native Electron Desktop Application](#4-running-the-native-electron-desktop-application)
5. [Running via Command-Line Interface (CLI)](#5-running-via-command-line-interface-cli)
6. [CLI Options, Flags & Exit Codes Reference](#6-cli-options-flags--exit-codes-reference)
7. [Running Test Fixtures & Sample Builds](#7-running-test-fixtures--sample-builds)
8. [Running the Automated Test Suite](#8-running-the-automated-test-suite)
9. [Desktop UI Screen Walkthrough](#9-desktop-ui-screen-walkthrough)
10. [Troubleshooting & FAQ](#10-troubleshooting--faq)

---

## 1. Prerequisites & System Requirements

DeployLens runs 100% locally on your machine with zero external network calls, zero accounts, and zero database persistence.

### Required:
- **Node.js**: `v22.x` LTS or `v24.x` LTS (tested on `v22.18.0`)
- **pnpm**: `v10.x` or `v12.x` (tested on `v12.9.1`)

### Optional Toolchains:
- **Android SDK** (optional): `apksigner`, `apkanalyzer`, `zipalign`.
  *Note: DeployLens contains built-in pure TypeScript binary parsers for AXML, ELF 16KB headers, and APK/AAB signing blocks. It works out of the box even without Android SDK installed.*
- **macOS / Xcode CLI** (optional): `codesign`, `security`.
  *Note: If running on Windows or Linux, iOS codesign checks will be transparently and truthfully reported as `Not checked` (never falsely marked as passed).*

---

## 2. Installation & Project Setup

### Step 1: Open Terminal in the Project Directory
```powershell
cd E:\mywork\DeployLens
```

### Step 2: Ensure pnpm is Available
If `pnpm` is not in your system PATH, add your global npm bin directory:
```powershell
$env:PATH = "C:\Users\Ganesh\AppData\Roaming\npm;" + $env:PATH
```
Verify pnpm:
```powershell
pnpm -v
# Output: 12.9.1
```

### Step 3: Install Monorepo Dependencies
```powershell
pnpm install
```

### Step 4: Build All Monorepo Packages and Apps
```powershell
pnpm build
```
This builds all contracts, rules, core engine, android/ios adapters, store guidance, UI components, the CLI, and the Electron desktop app.

---

## 3. Running as Localhost (Web Browser Preview)

You can launch DeployLens on a local web server to inspect and interact with the UI directly in your browser (Google Chrome, Microsoft Edge, Firefox, Brave, Safari, etc.):

### Step 1: Start the Localhost Dev Server
```powershell
pnpm desktop
```
*Alternative command:*
```powershell
pnpm --filter @deploylens/desktop run dev
```

### Step 2: Open in Your Web Browser
Vite will start the local HTTP server. Open:
```
http://localhost:5173
```

### What You Will See on Localhost:
- The top bar will display: **`🌐 Localhost Web Preview • 100% Local Engine • No Data Persisted`**.
- You can drag-and-drop or click **"Choose File from Disk"** to select any `.apk`, `.aab`, or `.ipa` file using standard browser file selection.
- Fill out the optional **"About your app"** fields (App Purpose, Intended Users, Features) to test store listing template generation.
- Note: When running in a standard web browser sandbox on localhost, web security restricts raw child process execution. For full hardware-level child process and filesystem verification, run DeployLens via **Electron** or the **CLI** as described below.

To stop the localhost server, press `Ctrl + C` in the terminal.

---

## 4. Running the Native Electron Desktop Application

To launch DeployLens as a full native desktop application with full access to native file dialogs, child process execution, and local platform tools:

### Option A: Build and Run Electron
```powershell
# 1. Build renderer and electron main scripts
pnpm desktop:build

# 2. Launch Electron
pnpm --filter @deploylens/desktop start
```

### Option B: Run via Electron Command
```powershell
npx electron apps/desktop
```

### Native Desktop Features:
- Native OS File Picker (`.apk`, `.aab`, `.ipa` filters).
- Native Drag & Drop from Windows Explorer / macOS Finder.
- Hardware capability detection (`apksigner`, `apkanalyzer`, `zipalign`, `readelf`, `codesign`).
- Native asynchronous IPC communication with zero renderer blocking.
- Strict security: `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`.

---

## 5. Running via Command-Line Interface (CLI)

The DeployLens CLI (`@deploylens/cli`) uses the exact same core engine as the desktop application.

### Check Local Toolchain Health (Doctor)
Run the diagnostic check to see what platform tools are installed on your system:

```powershell
# Human-readable format
pnpm cli doctor
```

Output example:
```
========================================================
  DeployLens Doctor - Local Environment Tool Capability Check
========================================================

Operating System: win32 (x64)
Node.js Runtime : v22.18.0

Tool Capabilities:
------------------
• APKANALYZER: ✓ AVAILABLE
  Location: C:\Users\Ganesh\AppData\Local\Android\Sdk\cmdline-tools\latest\bin\apkanalyzer.bat
• BUNDLETOOL: ✕ NOT FOUND (Uses built-in fallback parser)
• APKSIGNER: ✓ AVAILABLE
  Location: C:\Users\Ganesh\AppData\Local\Android\Sdk\build-tools\37.0.0\apksigner.bat
• ZIPALIGN: ✓ AVAILABLE
  Location: C:\Users\Ganesh\AppData\Local\Android\Sdk\build-tools\37.0.0\zipalign.exe
• READELF: ✕ NOT FOUND (Uses built-in TypeScript ELF analyzer)
• CODESIGN: ✕ NOT FOUND (Requires macOS)
• SECURITY: ✕ NOT FOUND (Requires macOS)
```

To get structured JSON output (ideal for automation or CI pipelines):
```powershell
pnpm cli doctor --format json
```

---

### Inspect an App Build (Scan)

```powershell
# Scan an Android APK
pnpm cli scan fixtures/android/valid-app.apk

# Scan an Android App Bundle (AAB)
pnpm cli scan fixtures/android/test-app.aab

# Scan an iOS IPA
pnpm cli scan fixtures/ios/valid-app.ipa
```

### Inspect with Optional App Details for Store Guidance
Supply optional metadata to generate customized Google Play / App Store listing templates:
```powershell
pnpm cli scan fixtures/android/valid-app.apk `
  --purpose "Personal expense tracker and budget planner" `
  --users "Freelancers and small business owners" `
  --features "Receipt photo scanning, monthly PDF export, multi-currency" `
  --lang "en-US"
```

### Output Pure JSON (for CI/CD and Automation)
In JSON mode, progress indicators are suppressed from `stdout`, ensuring pure, valid JSON output:
```powershell
pnpm cli scan fixtures/android/valid-app.apk --format json > result.json
```

---

## 6. CLI Options, Flags & Exit Codes Reference

### Command Syntax:
```bash
deploylens scan <artifact-path> [options]
```

### Available Options:
| Option | Description | Default | Example |
| :--- | :--- | :--- | :--- |
| `--format <format>` | Output format: `"human"` or `"json"`. | `human` | `--format json` |
| `--purpose <text>` | In-memory app purpose for listing suggestions. | None | `--purpose "Habit tracker"` |
| `--users <text>` | Target audience for listing suggestions. | None | `--users "Fitness enthusiasts"` |
| `--features <text>` | Core features list (comma-separated). | None | `--features "Pedometer, calorie counter"` |
| `--lang <code>` | Preferred listing language code. | `en-US` | `--lang "en-GB"` |
| `-h, --help` | Show help and argument usage. | | `pnpm cli --help` |
| `-V, --version` | Output version number. | | `pnpm cli -V` |

### CLI Exit Codes:
DeployLens uses distinct, standardized exit codes to distinguish scan outcomes:
- **`0`**: **Clean scan (`PASSED AVAILABLE CHECKS`)** or successful doctor execution.
- **`1`**: **Invalid input error** (file not found, non-ZIP file, corrupt archive header).
- **`2`**: **Confirmed submission blockers (`ACTION REQUIRED`)**.
- **`3`**: **Unresolved policy risks or tool coverage gaps (`REVIEW REQUIRED`)**.
- **`4`**: **Critical scan error (`INCOMPLETE`)**.

---

## 7. Running Test Fixtures & Sample Builds

DeployLens includes pre-built binary test fixtures located in `fixtures/`:

```
fixtures/
├── android/
│   ├── valid-app.apk        # Clean APK targeting Android 15 (API 35), 64-bit ELF, 16KB aligned
│   ├── test-app.aab         # Clean AAB bundle with JAR upload key signature
│   └── debuggable-app.apk   # Non-compliant APK with debuggable=true, testOnly=true, 32-bit only
├── ios/
│   ├── valid-app.ipa        # Clean IPA with PrivacyInfo.xcprivacy, entitlements, arm64 Mach-O
│   └── missing-purpose.ipa  # IPA with placeholder NSCameraUsageDescription ("test") and ATS disabled
└── corrupt/
    ├── corrupt.apk          # Corrupt, truncated non-zip archive
    └── traversal.apk        # Malicious ZIP containing Zip Slip traversal entry (../../etc/passwd)
```

### Try Testing Different Artifact Scenarios:

#### 1. Test Clean Android App Bundle:
```powershell
pnpm cli scan fixtures/android/test-app.aab
# Result: PASSED AVAILABLE CHECKS (Exit code 0)
```

#### 2. Test Blockers on Debuggable APK:
```powershell
pnpm cli scan fixtures/android/debuggable-app.apk
# Result: ACTION REQUIRED (Exit code 2 - Flags debuggable, testOnly, and 32-bit only)
```

#### 3. Test iOS IPA with Missing Purpose Strings:
```powershell
pnpm cli scan fixtures/ios/missing-purpose.ipa
# Result: ACTION REQUIRED (Exit code 2 - Flags placeholder NSCameraUsageDescription)
```

#### 4. Test Path Traversal Protection:
```powershell
pnpm cli scan fixtures/corrupt/traversal.apk
# Result: Throws "Security violation: Archive entry contains path traversal"
```

#### Regenerate Fixtures Anytime:
```powershell
node --experimental-strip-types fixtures/generate-fixtures.ts
```

---

## 8. Running the Automated Test Suite

DeployLens uses **Vitest** for fast unit and integration tests.

### Run All Tests:
```powershell
pnpm test
```

### Run Tests in Watch Mode:
```powershell
npx vitest
```

### Run Tests with Coverage:
```powershell
pnpm test:coverage
```

### What the Test Suite Verifies:
1. **Fixture Parsing**: Real APK, AAB, and IPA parsing and metadata extraction.
2. **Corrupt & Traversal Handling**: Rejection of non-zip files and Zip Slip traversal attacks.
3. **Android Rules**: targetSdkVersion (API 34/35), absent maxSdkVersion reported as "Not declared", debuggable and testOnly explicit vs resolved defaults.
4. **Signing Logic**: Separation of AAB upload signatures from APK v2/v3 signing schemes.
5. **Native 16 KB Alignment**: Verification of ELF segment alignment for Android 15.
6. **Cross-Platform IPA Handling**: Missing macOS tools produce `Not checked` (never "Passed").
7. **Artifact Immutability**: Verification that input binaries remain completely untouched.
8. **Offline Guarantee**: Verification that zero HTTP/HTTPS network connections are made during scans.

---

## 9. Desktop UI Screen Walkthrough

### Screen 1: Select Build
- **Branding**: Title & subtitle (*"Inspect your app. Prepare your release."*).
- **Drag & Drop Area**: Drop `.apk`, `.aab`, or `.ipa` files directly, or click **"Choose File from Disk"**.
- **Real-time File Overview**: File name, archive size, detected platform, and local toolchain readiness tags (`apksigner`, `apkanalyzer`, `zipalign`, `codesign`).
- **Optional App Information**: Expandable section to enter App Purpose, Target Audience, and Core Features.

### Screen 2: Live Validation
- Displays live stage progress (e.g. *"5 of 9 stages completed"*).
- Elapsed timer with live updates.
- Circular spinner on currently active stage.
- Color-coded badges upon stage completion (Pass, Fail, Review Required).
- **"Cancel Scan"** button terminates active processes and cleans temporary extraction folders immediately.

### Screen 3: Final Assessment
- **Readiness Status**:
  - `PASSED AVAILABLE CHECKS`: No blockers or review findings within performed scope.
  - `ACTION REQUIRED`: Applicable blockers identified that require resolution before store release.
  - `REVIEW REQUIRED`: Unresolved policy risks or host tool coverage gaps.
  - `INCOMPLETE`: Critical stages failed.
- **Metric Cards**: Blockers, Needs Review, Passed Checks, Checks Not Performed.
- **Categorized Findings**: Detailed cards with Evidence, Affected File/Key, Remediation, and Official Documentation Links.
- **Unverified Areas**: Clearly highlights areas that require manual testing (runtime crashes, payments, account deletion, layouts, login).
- **Copy Summary**: Formats and copies a summary to your clipboard on explicit click.
- **Official Disclaimer**: Highlighted yellow caution banner with mandatory wording.

### Screen 4: Store Preparation
- **Deterministic Listing Templates**: Generated title, short description / subtitle, and full description based on your app metadata without inventing claims or features.
- **Interactive Character Counters**:
  - Google Play Title: max 30 chars.
  - Google Play Short Description: max 80 chars.
  - Apple App Store Subtitle: max 30 chars.
  - Full Description: max 4000 chars.
  - Apple Keywords: max 100 chars comma-separated.
- **Release Preparation Checklist**: Graphic asset resolutions (512x512 icon, 1024x500 feature graphic), Google Play Data Safety, Apple Privacy Details, Reviewer access credentials, and device testing checklists.

---

## 10. Troubleshooting & FAQ

### Q: `pnpm` command is not recognized in PowerShell.
**Fix**: Run:
```powershell
$env:PATH = "C:\Users\Ganesh\AppData\Roaming\npm;" + $env:PATH
```
To persist this permanently for your user account:
```powershell
[Environment]::SetEnvironmentVariable("Path", [Environment]::GetEnvironmentVariable("Path", "User") + ";C:\Users\Ganesh\AppData\Roaming\npm", "User")
```

### Q: How do I open DeployLens if port 5173 is already in use?
**Fix**: Specify a custom port when starting Vite:
```powershell
npx vite apps/desktop/src --port 3000
```
Then open `http://localhost:3000`.

### Q: Why does iOS code signing say "Not checked" on Windows?
**Reason**: Cryptographic iOS code signing verification relies on Apple's `codesign` tool, which is only available on macOS. DeployLens reports `Not checked` instead of falsely claiming "Passed". You can still inspect the bundle structure, `Info.plist`, `PrivacyInfo.xcprivacy`, entitlements, and `embedded.mobileprovision` cross-platform on Windows and Linux!

### Q: Where are temporary extraction files stored?
**Answer**: Ephemeral files are extracted into an isolated subfolder inside your OS temporary directory (`os.tmpdir()/deploylens-<scanId>`). They are deleted as soon as inspection finishes, fails, or is cancelled.

---

*DeployLens is a fully local, open-source mobile release readiness tool.*
