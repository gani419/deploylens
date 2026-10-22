# Application ownership and shared packages

## Applications

| Location | Owns |
| --- | --- |
| `apps/web/src` | React DOM screens, CSS, browser file selection, XHR/fetch, clipboard, HTML/MIME downloads and native-browser sharing |
| `apps/server/src` | HTTP upload/streaming service, isolated Node scan worker, temporary cleanup and opt-in local ADB/Apple device adapters |
| `apps/desktop/src` | Electron renderer and desktop interactions |
| `apps/desktop/electron` | Main process, sandboxed preload, IPC, filesystem selection and local Node engine access |
| `apps/cli` | Command-line entry and output formatting |
| `apps/mobile` | React Native Community CLI Android/iOS clients, native UI, document selection, streamed inspection transport and platform adapters |

## Portable client packages

| Package | Current consumer and responsibility |
| --- | --- |
| `@deploylens/contracts` | All products: inspection metadata, findings, stages and public service/wire-event types |
| `@deploylens/config` | Web, mobile, desktop and server: product identity, upload defaults, formats, colors and typography roles/sizes |
| `@deploylens/utils` | Web, mobile and desktop: app identity, result labels, formatting, links and portable archive validation |
| `@deploylens/reporting` | Web and future native collaboration: build comparison, sharing-message defaults and Markdown research descriptions |
| `@deploylens/store` | Web and mobile: independent inspection stores plus per-report review markers, listing drafts and sharing draft |
| `@deploylens/api-client` | Web and mobile: incremental NDJSON decoder, event-envelope validation, upload route and generic transport/observer contract |

Mobile reuses these packages without importing web source files. Pure client packages compile with `lib: ["ES2022"]` and `types: []`. Their dependencies and source imports are checked by `pnpm check:boundaries`.

`@deploylens/ui-web` contains the former `@deploylens/ui` DOM components and is consumed by Electron. It is intentionally separate from native UI. The existing `core`, `android`, `ios`, `rules` and `store-guidance` packages continue to own inspection/validation. The Node engine and tool adapters do not enter the native client dependency graph.

## State and file ownership

`createInspectionStore()` creates isolated current/baseline state. It tracks phase, progress, errors, summaries, stages and the active server scan ID. React binds to it using `useSyncExternalStore`; the package itself has no React dependency. The browser hook retains the original `File` and request cancellation handle outside the store and guards late callbacks with a request generation.

`createReportSessionStore(scanId)` owns reviewed items, saved listing drafts and the sharing draft for one report. Selecting a new report creates another store. There is no storage/database side effect. Temporary textarea editing and focus remain local to the UI; only saved content enters the shared store.

A native adapter can use its own file URI/handle with the generic `InspectionTransport<Upload>` interface. The protocol decoder accepts text chunks and does not assume DOM streams, browser `File`, Node `Buffer`, or a particular native networking library. Transports own request cancellation and terminal-event handling; stores own state transitions. Metadata helpers accept portable `{ name, size }` descriptors.

## Themes

Edit shared colors in `packages/config/src/theme.ts` and typography in `packages/config/src/typography.ts`. Build the config package, then the web app. Its generator writes `apps/web/src/styles/theme-colors.css`. The generated file is committed for source browsing and regenerated on each web build. Browser font declarations/fallbacks, CSS layouts and native styles remain platform-specific.

## Server and commands

Public HTTP paths, upload limits, NDJSON events, worker isolation, cleanup and local-device restrictions are preserved. The service defaults to serving `apps/web/dist`, regardless of process working directory. Web's package no longer owns a Node engine dependency. The container copies both the web static build and server application with their workspace dependencies.

```sh
pnpm install --frozen-lockfile
pnpm build
pnpm typecheck
pnpm check:boundaries
pnpm test
pnpm test:e2e
pnpm web
```

`pnpm server` is an explicit alias for service startup. `pnpm --filter @deploylens/web start` forwards to the server for compatibility. The browser dev server still proxies `/api` to local port 3000. Phase 1 introduced no hosted deployment, database, mobile shell or installer artifact. The static web client is now deployed separately on Firebase Hosting; the inspection service still requires a Node host.

## Phase 1 verification

Verified after extraction:

- Full shared-package, CLI, web and Electron builds passed.
- All available workspace type/syntax checks and client dependency-boundary checks passed.
- 111 unit/server tests passed, including shared state, split/interrupted stream decoding and existing signing/archive regressions.
- 16 browser/Electron checks passed, including sharing, draft retention, current/baseline comparison, cancellation and interrupted HTTP responses.
- Offline installation with a frozen workspace lockfile passed without dependency downloads.

Container image execution and additional physical-device checks remain release work. Phases 2 and 3 subsequently added the React Native shell and streamed native inspection flow; their current evidence is maintained in `MOBILE_IMPLEMENTATION_PLAN.md`.
