# Desktop Launcher Only Design

**Date:** 2026-04-25

**Goal:** Keep a single Windows desktop `.exe` entrypoint for the current development machine by retaining the launcher workflow and removing the standalone desktop packaging workflow.

## Current State

The repository currently exposes two desktop-related paths:

- `desktop-webui-launcher/` builds a lightweight Windows launcher executable that starts the local repository's `web/` and `desktop-webui/` flow.
- `desktop-webui/` contains the Electron app runtime and also includes `electron-builder` packaging configuration for creating distributable Windows builds.

This creates two meanings for "desktop exe":

- a local development-machine launcher
- a distributable packaged application

That is more surface area than the user wants. The desired outcome is narrower: a stable `.exe` on this machine that opens the current repository's LLM Wiki.

## Chosen Direction

Adopt a single desktop entry strategy:

- Keep `desktop-webui/` as the Electron runtime that the launcher builds and starts.
- Keep `desktop-webui-launcher/` as the only supported `.exe` entrypoint.
- Remove the packaged-distribution path from `desktop-webui/` and the root scripts that expose it.

This keeps the runtime code that the launcher depends on, while deleting the separate "formal packaged app" responsibility that is no longer wanted.

## Why This Direction

This direction matches the user's stated goal exactly:

- the user does not need a distributable installer
- the user does need a double-clickable `.exe` on the current development machine

Keeping `desktop-webui/` but removing packaging is the shortest correct path. Deleting `desktop-webui/` itself would break the launcher, because the launcher starts the Electron app from that directory.

## Rejected Alternatives

### 1. Keep both launcher and packaging

Rejected because it preserves the exact ambiguity the user wants removed.

### 2. Hide packaging scripts but keep packaging internals

Rejected because it leaves dead maintenance surface in place. Future readers would still see `electron-builder` config and assume packaged release remains a supported path.

### 3. Delete `desktop-webui/` and keep only the launcher

Rejected because the launcher is not the application runtime. It is only a bootstrap executable.

## Scope

### In Scope

- Remove root-level packaging entrypoints that advertise packaged desktop release.
- Remove `electron-builder` packaging script, dependency, and build packaging config from `desktop-webui/package.json`.
- Update documentation that currently implies the packaged desktop route is supported.
- Keep launcher build/start scripts intact.
- Keep Electron runtime code intact.

### Out of Scope

- Replacing the launcher architecture
- Refactoring `desktop-webui/` runtime behavior
- Removing `wiki-clone/`
- Changing `gui/` WinForms legacy code
- Producing a distributable installer

## Intended File-Level Changes

### Root

- `package.json`
  - Remove the `desktop:webui:package` script.
  - Keep launcher-related scripts.

### Electron Runtime

- `desktop-webui/package.json`
  - Remove the `package` script.
  - Remove the `electron-builder` devDependency.
  - Remove the `build` packaging configuration block that only exists for distributable packaging.
  - Keep `build` and `start` scripts needed by the launcher.

### Documentation

- `README.md`
  - Remove or adjust any wording that suggests packaged desktop distribution is a supported path, if present.
- `docs/project-log.md`
  - Record that desktop support now means launcher-only on the current machine, not packaged Windows distribution.

### Tests

- Review tests that assert packaged desktop behavior and either remove or update them so the supported contract is launcher-only.

## Behavioral Contract After Change

After this change:

- The supported desktop `.exe` is the launcher executable built from `desktop-webui-launcher/`.
- Running the launcher still builds the required local assets and opens the Electron desktop app.
- There is no supported repository command for generating a packaged desktop installer/executable.
- `desktop-webui/` remains an implementation dependency of the launcher, not a separate distribution product.

## Risks and Mitigations

### Risk: Removing packaging fields accidentally breaks launcher builds

Mitigation:

- Only remove packaging-specific fields.
- Keep `desktop-webui` runtime scripts and dependencies required by `npm run build` and Electron startup.

### Risk: Tests or docs still refer to packaging

Mitigation:

- Search for `desktop:webui:package`, `electron-builder`, and packaged desktop wording.
- Update only the references tied to the removed feature.

### Risk: Future contributors reintroduce ambiguity

Mitigation:

- Make the launcher-only contract explicit in docs and project log.

## Verification Strategy

Verification for the implementation phase should prove:

1. root scripts no longer expose packaged desktop release
2. `desktop-webui/package.json` no longer contains packaging-only config
3. launcher build still succeeds
4. launcher-start flow still opens the local Electron app
5. tests and docs align with the launcher-only contract

## Success Criteria

The change is complete when:

- there is exactly one supported desktop exe route in the repository narrative
- that route is the launcher
- the launcher still works against the local repository
- no packaged desktop workflow remains exposed through repository scripts or package configuration
