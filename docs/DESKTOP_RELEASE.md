# Desktop release procedure

DeployLens uses Electron and electron-builder to create Windows, macOS and Linux packages from the same web workspace and loopback inspection service.

## Continuous verification

`.github/workflows/ci.yml` runs application checks on Linux, builds and exercises the Windows desktop package, and builds the production container. Windows CI artifacts are explicitly named `unsigned` and expire after seven days; they are qualification output, not public releases.

## Release workflow

`.github/workflows/desktop-release.yml` can be run manually for an unsigned packaging dry run. Pushing a `v*` tag, or choosing `publish` during a manual run, enables the public-release path. That path refuses to continue without Windows signing credentials and macOS signing/notarization credentials. After all three platform jobs succeed, it publishes the packages and `SHA256SUMS.txt` to the existing Git tag's GitHub Release.

Configure these GitHub Actions secrets before publishing:

| Secret | Used for |
| --- | --- |
| `WINDOWS_CSC_LINK` | Base64 data, HTTPS URL or other electron-builder-supported reference to the Windows code-signing certificate |
| `WINDOWS_CSC_KEY_PASSWORD` | Password for the Windows certificate |
| `MAC_CSC_LINK` | Developer ID Application certificate reference |
| `MAC_CSC_KEY_PASSWORD` | Password for the macOS certificate |
| `APPLE_ID` | Apple account used for notarization |
| `APPLE_APP_SPECIFIC_PASSWORD` | App-specific password used for notarization |
| `APPLE_TEAM_ID` | Apple Developer team identifier |

Keep signing material in repository/environment secrets. Do not commit certificate files, passwords or Apple credentials.

## Outputs

- Windows x64: NSIS installer and ZIP.
- macOS x64 and arm64: DMG and ZIP for each architecture.
- Linux x64: AppImage and tar.gz.

The artifact name includes product version, operating system and architecture. The version currently comes from `apps/desktop/package.json`; update it before creating the release tag.

## Qualification before publishing

1. Run the manual workflow with publishing disabled and inspect every artifact.
2. Install on clean supported machines and verify launch, APK/AAB/IPA inspection, report export, privacy/documentation routes and uninstall/upgrade behavior.
3. Verify Authenticode on Windows and Gatekeeper/notarization on macOS after downloading the generated artifacts.
4. Confirm Linux AppImage/tar behavior on the supported distributions and both intended display stacks.
5. Review release notes, checksums, third-party notices and known limitations.

Automatic in-app updating is not enabled. The initial release should direct users to signed GitHub Releases for updates until a signed update feed and rollback path are implemented and qualified.
