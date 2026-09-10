# Vespera

Vespera is a private, local-first Werewolf moderator assistant for games played around a physical table. It guides setup, records table decisions, previews rule consequences, and applies changes only after the host confirms them.

It does not collect ballots, run multiplayer rooms, expose a public player screen, or decide when a game is over.

## Run locally

Requires Node.js 20 or newer.

```bash
npm ci
npm run dev
```

Open `http://localhost:3000`. No account or backend is required.

## Quality checks

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

## Product flow

1. Add and order players.
2. choose a role composition, then manually assign or privately shuffle it.
3. Confirm setup to create the committed session.
4. Record daytime outcomes or open the guided night sequence.
5. Review every consequence before confirming it.
6. Resolve a Hunter response separately when required.
7. Dismiss or confirm advisory winner suggestions.

The running-game roster shows public state only. Secret roles are revealed inside an individual private player panel.

## Architecture

- `src/logic/antigravity/stream.ts` is the only generic state primitive.
- `src/logic/game-store.ts` owns every committed state mutation. Components receive read-only streams.
- `src/logic/rules.ts` contains mutation-free preview and winner functions.
- Setup, day, night, and Hunter selections remain local React drafts until confirmation.
- Structured `GameEvent` records are generated during commits; display strings never reconstruct game state.
- The root route is a Server Component with one small client application boundary.

The canonical role behavior is documented in [ROLE_INTERACTIONS.md](./ROLE_INTERACTIONS.md).

## Storage and recovery

The complete committed session is stored in `localStorage` under the versioned `vespera-session-v2` envelope. The adapter safely validates V2 data and can migrate the original `vespera-players`, `vespera-status`, `vespera-actions`, and `vespera-logs` records.

Unconfirmed drafts are intentionally not persisted. The latest confirmed mutation stores a complete pre-commit checkpoint and can be undone once; there is no redo.

## Testing

Vitest covers pure rule interactions, stale-preview rejection, confirmation and undo behavior, safe persistence parsing, legacy migration, and dangling-reference cleanup. Browser verification should cover the full mobile host workflow whenever interaction or layout code changes.
