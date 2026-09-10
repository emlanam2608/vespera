# Vespera role interactions

This document is the canonical rules reference for the host assistant. Physical-table decisions are authoritative. Vespera records outcomes and previews consequences; it never collects player ballots or ends the game automatically.

## Confirmation boundary

- Setup assignments, day outcomes, the complete night, Hunter response, moderator corrections, and the final winner are drafts until the host confirms them.
- Preview functions are pure. Confirm commands revalidate the preview against the current session and reject stale confirmations.
- Winner detection creates a dismissible suggestion only.
- Every direct death expands its Lover chain in the same preview.

## Night order

1. Cupid, first night only
2. Bodyguard
3. Seer
4. Werewolves
5. Witch
6. Consequence review and confirmation

If a represented role is eliminated, its turn remains in the sequence as a timed ghost pane without controls. Cursed Bodyguard, Seer, and Witch turns use the same suppression treatment.

## Roles

### Villager

No night action. Villagers win when no Werewolf remains alive, subject to the host’s confirmation.

### Werewolf

The pack agrees on one living target. Vespera records the collective result, not individual wolf ballots. The target is not resolved until the complete night is confirmed.

### Bodyguard

Protects one living player from the wolf attack. The previous confirmed protection target cannot be selected on the next Bodyguard turn. Protection fully prevents an Elder shield hit.

### Seer

Inspects one living player. The private draft reveals only `Werewolf` or `Human`, never the exact role.

### Witch

Has one healing and one poison potion for the session. The Witch sees the wolves’ target, may heal only that target, and may poison one living player. Both available potions may be used in the same night and are consumed only when the night is confirmed.

### Hunter

When eliminated directly or through a Lover chain, the Hunter enters a separate response after the triggering resolution. The host may draft one living target or explicitly pass, preview the result and Lover chain, then confirm.

### Cupid

Acts only on the first night and selects exactly two different living players. The relationship is part of the uncommitted night draft and is applied only with the entire night resolution. A mixed wolf-human pair becomes the Lovers faction.

### Mayor

The table elects the Mayor. Vespera records the chosen living player through a day outcome; assigning a new Mayor replaces the existing marker. The marker represents a double vote for winner-power advice, but Vespera does not tally votes.

### Idiot

The first confirmed village execution exposes the Idiot instead of killing them. They remain alive and lose their vote. A later village execution eliminates them normally.

### Elder

- The first unprotected wolf attack cracks the intact shield without killing the Elder. A simultaneous Witch heal is still consumed and the shield remains cracked.
- A second unprotected wolf attack kills the Elder unless the Witch heals them.
- Bodyguard protection prevents both death and shield damage.
- Witch poison, a Hunter shot, and village execution bypass the shield.
- The village curse activates only when the Elder is directly executed by the village or poisoned by the Witch. A wolf attack and Hunter shot do not activate it.

## Village curse

Once active, the curse permanently suppresses these abilities:

| Role | Suppressed behavior |
| --- | --- |
| Bodyguard | Protection |
| Seer | Inspection |
| Witch | Both potions |
| Hunter | Last Stand; no response phase opens |

Cupid, Werewolves, Mayor, Idiot, and Elder behavior is not suppressed.

## Winner suggestions

- Villagers: no Werewolf remains alive.
- Werewolves: their effective voting power is at least the remaining non-wolf voting power.
- Lovers: every survivor belongs to the Lovers faction and no more than three players remain.

Mayor counts as two and an exposed Idiot as zero for advisory voting power. These checks never mutate the stage or phase.
