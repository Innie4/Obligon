# Independent popup foundation review

What this change does: It moves owner-controlled loading, pending, error and result feedback into shared floating cards. It keeps short success/info toasts and makes error/warning toasts persist until dismissed or displaced by the queue limit.

This is a bounded correctness/accessibility source review, **not a fifth visual iteration**. Scope: shared `StatusPopup`, `Toast`, `States`, `Dialogs`, `ErrorBoundary` and `tests/status-popup.test.cjs`; provider/session/dialog-focus sources were read only to trace callers. No backend/auth/money code was changed or tested by this reviewer.

## Findings resolved during this review

The following reproductions describe the original snapshot. All three are now corrected; the final source hashes and passing rechecks are in the JSON receipt.

1. **POP-01 / P2 — Retry hid an unresolved error** (`apps/web/components/shared/StatusPopup.tsx`, `PopupCard` Retry handler).
   - **What this is:** A retry button should ask the owning request or error boundary to recover. The owner determines whether feedback remains, changes to progress or unmounts.
   - **Problem:** The initially reviewed handler called `onDismiss()` before `onRetry()`. In the existing hook harness, a non-dismissible error with a callback that cannot change owner state invokes its callback once, then has **0 cards instead of1**, in both provider and providerless mode. An identical rerender keeps it hidden. I did not independently prove the narrower immediate ErrorBoundary rethrow case with real React commits.
   - **Fix:** Invoke the retry callback without dismissing. Keep explicit dismissal separate; owner state/unmount already settles the card. Add regression tests for unresolved retry in both modes and successful owner-state transition.
   - **If skipped:** An unresolved failure can leave a blank fallback and no remaining recovery control, even with `dismissible=false`.

2. **POP-02 / P2 — Old errors survived account/company switches** (`apps/web/components/shared/Toast.tsx`; root `shared/Providers.tsx`).
   - **What this is:** ToastProvider lives outside AuthProvider in the persistent root layout. User/org changes update its children rather than unmounting it.
   - **Problem:** Only success/info gets a timer. Before the correction, a retained error survived an AccountA→AccountB child/context change with **0 active timers**, and no session/org reset existed. Old financial or account feedback can therefore remain on the next context. This is a UI context bug, not evidence of a server authorization bypass.
   - **Fix:** Add a UI-only notification scope tied to stable user ID, role, organization type and organization ID. On actual scope change clear toast queue/timers, and reject old captured toast callbacks so delayed old requests cannot repopulate the next scope. Preserve ordinary same-scope refresh and owner-controlled StatusPopup progress.
   - **If skipped:** The next account/company sees feedback belonging to the previous context until manual dismissal or eviction.

3. **POP-03 / P2 — An unrelated error replaced the dialog portal** (`apps/web/components/shared/StatusPopup.tsx`, provider host map).
   - **What this is:** React uses a portal's key to preserve its DOM subtree across renders.
   - **Problem:** The initially reviewed `status-popup-${hostIndex}` used an index from priority-sorted groups. A sole dialog pending host has key `status-popup-0`; adding a body error changes the unchanged dialog host to `status-popup-1`. Reconciliation therefore replaces that subtree. A focused control in it cannot retain the same DOM identity; actual browser focus/announcement effects were not exercised here.
   - **Fix:** Use a stable per-host portal identity, such as a small provider-local WeakMap with a counter. Test stability when another host's higher-priority feedback appears and disappears.
   - **If skipped:** Background feedback can interrupt keyboard work or reannounce unchanged dialog feedback.

## Correction recheck

- **POP-01 resolved:** Retry now invokes only the owning callback. The focused suite checks no-op and throwing retries; the additional reviewer case confirms providerless `dismissible=false` still has1card after a no-op retry. Owner unmount/state changes remain responsible for settlement.
- **POP-02 resolved:** `SessionToastScope` wraps the page subtree below AuthProvider and keys scope to user ID, role, organization type and organization ID. The scoped context binds fresh generation callbacks on the first new-scope render. Layout activation clears prior toast queue/timers; stale callbacks are rejected after account/logout/role/org transitions, including return to an earlier identity. Same-scope refresh preserves feedback. StatusPopupProvider remains mounted, so unrelated owner progress is not reset.
- **POP-03 resolved:** A provider-local WeakMap gives each host a stable key. The structural reviewer case confirms the same dialog container/key through independent body-error insertion/removal and confirms the dialog portal is removed on owner unmount. This is a structural identity check, not a browser focus test.

Fresh reviewer execution of `node tests/status-popup.test.cjs` passed **11/11 tests**, with0failures/skips. The two additional reviewer cases above passed. `node --test` reports one passing file in this environment; direct execution exposed the11individual case results, avoiding a false count. No full build or TypeScript check was repeated by this reviewer; root owns integration checks.

## Checked and limited

Owner registration/update/unmount cleanup is present. Notice identity excludes changing callback/action identities when deciding whether dismissal survives, while current callback/action values are refreshed. Equal notices dedupe only for the same host and action identities; independent retry functions remain separate. Visible queues are bounded per host; errors/warnings precede progress. Dialog-hosted cards are placed within the existing dialog DOM, whose focus query is computed on each Tab. Cards do not autofocus or pretend to be modal. Document lookup runs in an effect, so the providerless SSR render does not synchronously access document.

The initial baseline was root-reported14 foundation tests plus TypeScript passing. The original read-only reproduction harness exited0 because it completed; its emitted actual/required properties demonstrated the three initial failures. After source corrections, the fresh11-case execution and two additional structural cases above verify their closure. No application tests or implementation were edited. The JSON receipt binds source hashes and the exact observed results.

**Verdict: source review passes after fixes1–3.** No outstanding foundation finding remains in this bounded scope. Root owns browser, consumer integration, critical-input contract checks and release. No extra aesthetic round, dependency or backend/auth/money change was requested.

**Not checked:** browser/hydration/screen-reader behavior; real React ErrorBoundary rethrow recovery; full build/typecheck by this reviewer; consumer completeness handled by the other agents.
