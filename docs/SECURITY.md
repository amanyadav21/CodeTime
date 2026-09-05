# CodePulse — Security & Privacy

Version: 0.2
Scope: V1

CodePulse is local-first by construction. This document records what that means concretely.

---

## 1. Network Behaviour

V1 **does not perform any network request** for any V1 capability. There is no telemetry, no crash reporting, no remote config fetch.

If a future version introduces network calls, they will be:

- Opt-in (a single `codepulse.allowNetwork` setting).
- Documented in this file under a new section.
- Limited to the minimum necessary (e.g., cloud sync opt-in).

## 2. Source Code

CodePulse **never reads the contents of the user's files**. Activity is detected from editor *events* (`onDidChangeTextDocument`, `onDidChangeTextEditorSelection`, etc.), which carry metadata (URI, ranges) but never buffer text into the extension's own state for V1.

The extension does not transmit:

- File contents.
- Source code fragments.
- Keystrokes.
- Selection text.

## 3. Data Collected

Stored locally in `globalState`:

- Aggregate active coding durations.
- Counts of sessions.
- Day strings (`YYYY-MM-DD`) used for daily aggregation.
- User settings (thresholds, goal, combo ladder).
- A current open session, if any.

Stored **nowhere else**.

## 4. Telemetry

- None in V1.
- `codepulse.telemetry.enabled` is reserved but unused. Any future telemetry must be explicit, opt-in, and disclosed here.

## 5. Permissions

The extension's `package.json` declares only the minimum capabilities required:

- `vscode.window` (status bar, webview view).
- `vscode.workspace` (file/editor events).
- No host permissions, no FS:read beyond what VS Code provides to all extensions.

We commit to not expanding permissions without updating this document and the README.

## 6. Storage

- Persisted data lives in the user's VS Code profile (per editor installation).
- No data is written outside the extension's `globalState`.
- No cookies, no localStorage outside the extension webview (which uses VS Code's storage path).

## 7. Threat Model (V1)

| Threat | Mitigation |
| --- | --- |
| Other extension reads CodePulse data | VS Code isolates extension storage per extension. |
| User profile sync leaks data | We do not store identifying info; aggregates only. |
| Malicious webview message | Bridge validates all inbound messages; engine ignores unknown types. |
| Crash dump leaks data | We don't capture crashes. |
| Source code exfiltration via telemetry | Telemetry absent. |
| Supply chain | Minimal dependencies; lockfile committed; CI checks integrity. |
| Compromised Next.js asset | `webview/out` is hashed and bundled at build time; no runtime fetches. |

## 8. Incident Response (Future)

If a future release introduces network behaviour and a vulnerability is found:

1. Disable network calls via kill switch in settings.
2. Publish an advisory in `CHANGELOG.md` and GitHub Security Advisories.
3. Update this document.

## 9. Responsible Disclosure

Report security problems via GitHub private vulnerability reporting (when enabled) or by opening a private issue with maintainers.
