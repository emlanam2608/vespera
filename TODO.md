# Vespera host-assistant implementation tracker

## Completed product slice

- [x] Replace the play-platform flow with a single host-operated setup and game shell.
- [x] Keep committed domain state in Streams and expose read-only streams to components.
- [x] Route mutations through named `GameStore` commands with local interaction drafts.
- [x] Add pure day, night, Hunter, Seer-alignment, and winner preview logic.
- [x] Revalidate previews on confirm and reject stale confirmation attempts.
- [x] Store structured events and a full one-step undo checkpoint.
- [x] Add validated V2 local persistence and compatible legacy migration.
- [x] Build player, role-composition, and private assignment setup steps.
- [x] Build the concealed-role moderator cockpit and private player records.
- [x] Replace vote collection with direct day-outcome recording.
- [x] Build the full-height guided night assistant, ghost panes, draft review, and atomic resolution.
- [x] Add Hunter response, dismissible winner advice, explicit finish, history, reset, and undo flows.
- [x] Apply a responsive calm-dark visual system, accessible dialogs, focus treatment, and reduced-motion-safe animation.
- [x] Document architecture, storage, game flow, and canonical role rules.

## Verification checklist

- [x] `npm run lint`
- [x] `npm run typecheck`
- [x] `npm test` (28 tests)
- [x] `npm run build`
- [x] Automated setup, cockpit, private-role, and night ghost-pane interaction walkthrough
- [ ] Live browser visual walkthrough (blocked by the current host’s saved Browser Use permission)
- [x] `git diff --check`
- [ ] Commit and push the verified refactor

## Maintenance guidance

1. Add or change rule behavior in `src/logic/rules.ts` first and cover the interaction with a pure unit test.
2. Represent every committed consequence as a typed `ResolutionEffect`; never infer domain state from event summaries.
3. Add a named `GameStore` command for each new mutation and take the undo checkpoint immediately before committing.
4. Keep selections and multi-step navigation local to the feature component until its final confirmation.
5. Extend persistence validation and migration whenever persisted types change; increment the envelope version for incompatible changes.
6. Keep secret information out of default roster surfaces and preserve the eliminated-role night cadence with ghost panes.
7. Verify keyboard focus, 44px targets, mobile safe-area controls, and reduced motion whenever UI behavior changes.
