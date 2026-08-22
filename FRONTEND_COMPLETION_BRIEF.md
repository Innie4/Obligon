# Obligon Frontend Completion Brief

## Purpose

This document governs the frontend completion pass for the existing Obligon application. The objective is to ensure that every intended interactive element leads to a real and understandable outcome, and that every supported user journey can be completed from entry to exit. The work covers the existing frontend only. It must preserve current backend routes, API contracts, database schema, server logic, page composition, established visual language, and application dependencies.

The pass is not a redesign. It is a controlled audit and completion effort that makes existing controls, forms, menus, tables, cards, tabs, dialogs, and navigation dependable, consistent, responsive, accessible, and clear.

## Scope and boundaries

| Area | Requirement |
|---|---|
| Frontend boundary | Modify client-side code only. Do not add, remove, or alter backend routes, API contracts, database schema, server logic, or dependencies. |
| Page composition | Preserve page-specific layouts and information hierarchy. Behavioural fixes are in scope. A material layout or product-flow redesign requires explicit approval. |
| Existing patterns | Use the project’s existing routing, state-management, data, styling, icon, and component patterns. |
| Shared components | Shared components may be refined where doing so makes existing interactions consistent, complete, accessible, or responsive across the application. |
| Realistic data | Where a missing backend capability blocks persistence, a local frontend fallback may demonstrate the flow only when it is isolated, non-deceptive, and recorded as non-persistent in the final report. |
| Existing AI-themed UI | Do not add, modify, or remove AI-themed user-interface elements during this pass. Record pre-existing examples as report-only observations. |

> An element is considered interactive when it is presented as actionable through semantic control markup, a handler, a link, a menu role, a keyboard target, a visible affordance, or established product intent. Purely decorative visual elements are excluded.

## Completion standard

An interaction is complete only when it has an understandable entry point, a successful outcome, a safe exit, and suitable feedback for its state. A control that only opens a modal, logs to the console, changes no visible state, or closes without confirming a result is incomplete.

| State | When it is required | Expected behaviour |
|---|---|---|
| Default | Every interactive element | The purpose and outcome are clear. |
| Hover, active, focus, disabled | As relevant to the control | The control responds visibly, retains an accessible focus indicator, and prevents duplicate actions when unavailable. |
| Validation | Forms and sensitive actions | Required information is identified before submission, with clear inline guidance. |
| Loading | Async or simulated async actions | The action provides visible progress, prevents accidental duplicates, and retains context. |
| Success | Completed actions | The user receives confirmation through an updated interface, inline state, toast, redirect, or a purposeful completion view. |
| Error | Failed or unavailable actions | The user receives an understandable explanation and a safe retry, correction, or exit path. |
| Empty | Lists, tables, dashboards, and search results that may have no data | The state explains what is absent and gives an appropriate next action. |
| Exit | Dialogs, sheets, multi-step flows, and subpages | The user can cancel, close, return, or use browser navigation without being trapped. |
| Permission or service gap | An action cannot be completed in the current frontend-only scope | The interface describes the limitation honestly and the final report records the unresolved dependency. |

## Required execution sequence

### Phase 0: Establish the baseline

Create an authoritative route and dashboard inventory before changing behaviour. Identify dashboard families, routes, shared shells, shared modals, primary actions, authenticated or role-specific views, and any relevant feature flags. Record the viewport and browser checks that will be used for validation.

### Phase 1: Design-system audit

Review the shared component layer before completing page-specific flows. Assess buttons, inputs, selects, checkboxes, radios, dialogs, drawers, toasts, tooltips, tabs, tables, cards, badges, empty states, loading states, pagination, breadcrumbs, navigation, and avatars.

Extend existing components only where a currently used flow needs a missing state or variant. Preserve existing token use, naming conventions, spacing, radius, typography, colour, motion, and file organization. Avoid one-off controls when an existing component can be extended.

### Phase 2: Dashboard inventory

Work through one dashboard or section at a time. Do not start a later dashboard’s implementation until the active dashboard has completed its audit-and-complete cycle. For every page, classify every intended interaction and maintain the following inventory.

| Dashboard and route | Element | Initial status | Required action | Final status | Evidence or note |
|---|---|---|---|---|---|
| _Record during implementation_ |  | Fully working, static, partial, missing, blocked, or not intended to be interactive |  |  |  |

The accepted statuses are defined below.

| Status | Meaning |
|---|---|
| Fully working | The happy path, applicable states, and exit path already behave correctly. |
| Static | The element looks actionable but does not produce a meaningful outcome. |
| Partial | The interaction starts but does not validate, submit, complete, report a result, or let the user exit safely. |
| Missing | The product implies a flow or entry point that is absent. |
| Frontend fallback | The flow is demonstrable with isolated local state but is not persistent because the necessary service does not exist. |
| Blocked by backend | A truthful completion requires a missing endpoint, server validation, authorization capability, or persisted data source. |
| Not intended to be interactive | The item is decorative and has no semantic or product expectation of action. |

### Phase 3: Complete each flow

For every static, partial, or missing interaction in the active dashboard, implement the entire supported flow. Use existing components and project patterns. Handle action initiation, validation, loading, success, error, empty state, retry or recovery where appropriate, cancellation, close behaviour, and navigation back to a safe context.

Keep persistent and non-persistent behaviour separate. Local state may be used to make a frontend-only interaction tangible, but the interface must not imply that a record was durably saved, sent, charged, or otherwise confirmed by a service when that has not occurred.

### Phase 4: Interaction quality

Make completed flows feel purposeful without introducing new visual language. Use established spacing, colour, and motion tokens. Multi-step flows need clear progress and a way to move backward or cancel. Success should feel conclusive rather than silently dismissing the user. Empty states should explain the next available action. Long actions should show an appropriate loader, skeleton, progress indicator, or established optimistic update pattern.

### Phase 5: Accessibility and responsive verification

For each changed flow, verify keyboard reachability, visible focus, semantic labels, accessible form errors, dialog focus management, readable feedback, and appropriate control labels. Verify mobile, tablet, and desktop layouts at the application’s established breakpoints. Check horizontal overflow, touch targets, long labels, tables, dialogs, mobile navigation, and return paths.

### Phase 6: No-AI audit and handover

Before closing a dashboard, search all touched files for newly introduced AI-themed tags, labels, icons, avatars, prompts, or copy. Confirm that none has been introduced. Pre-existing items are left unchanged and listed in the report.

## Acceptance criteria

A dashboard is complete when every intended interactive element on every in-scope page has a meaningful result; each supported user journey has an entry, complete outcome, appropriate loading, success, error, empty, and exit states; the implementation uses existing design-system patterns; controls remain accessible by keyboard; layouts work at mobile, tablet, and desktop widths; related interactions behave consistently across dashboards; and no new AI-themed UI has been added.

The final implementation report must include the completed inventory for each dashboard, responsive and accessibility checks, unresolved frontend-only limitations, any local-only fallback behaviour, and pre-existing AI-themed UI found but deliberately left unchanged.

## Severity and evidence

Use the following priority model during implementation and final reporting.

| Severity | Definition | Example |
|---|---|---|
| Critical | A primary journey is blocked, misleading, or can cause an irreversible incorrect outcome. | A destructive confirmation performs no action or an account-setting flow traps the user. |
| High | A prominent, expected user action is non-functional or dead-ends. | A primary CTA, table action, or navigation control does nothing. |
| Medium | The flow works partially but lacks meaningful feedback, validation, recovery, or responsive support. | A form closes without confirming submission. |
| Low | The interaction works but has a minor consistency, copy, focus, or visual-state defect. | A secondary action lacks a disabled state. |

For a completed primary or destructive flow, keep evidence in the form of route coverage, validation notes, and visual verification. For unresolved work, record the affected route, reproduction steps, severity, missing dependency, user-facing fallback, and recommended next action.

## Implementation constraints for this repository

Obligon uses a Next.js frontend within `apps/web`. This pass must remain within the existing client-facing application code and must not introduce new dependencies. Existing shared dashboard shells and modal patterns should be strengthened before page-specific controls are completed.

## Report template

### Dashboard inventory

| Route | Element | Initial status | Final status | Change made | Verification |
|---|---|---|---|---|---|
|  |  |  |  |  |  |

### Frontend-only limitations

| Route | Flow | Limitation | User-facing behaviour | Required backend dependency | Severity |
|---|---|---|---|---|---|
|  |  |  |  |  |  |

### Verification summary

| Area | Result | Notes |
|---|---|---|
| Mobile |  |  |
| Tablet |  |  |
| Desktop |  |  |
| Keyboard and focus |  |  |
| Form validation and error recovery |  |  |
| No-AI audit |  |  |

## Definition of done

The implementation is done only when the active dashboard has passed the documented inventory, flow-completion, responsive, accessibility, and no-AI checks, and the final report records both completed work and intentional frontend-only exceptions. No control should remain visually actionable while failing to navigate, change state, submit, close, reveal information, or otherwise produce the result users reasonably expect.
