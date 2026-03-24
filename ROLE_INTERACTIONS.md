# Vespera Role Interactions

This document defines the rules, night-order, and interactions for each role in the Vespera Moderator App. 
It must be strictly followed when adding new features or resolving bugs related to roles.

## General Design Principles
* **Changeable Actions**: Every action taken by the moderator on behalf of a role must be drafted first. Selecting a target highlights it, but the moderator must actively confirm to apply it (e.g. "Confirm Shoot" or "Resolve Night").
* **Target Cancellation**: If a target is currently selected, clicking it again will deselect it. The moderator can also change targets before submitting.

## Night Waking Order
During the `NIGHT` phase, roles MUST always awaken in this specific sequence to prevent resolution conflicts:
1. **Bodyguard**
2. **Seer**
3. **Werewolves**
4. **Witch**

## Role Details

### 1. Bodyguard
* **Action**: Protects one player from being eliminated by the Werewolves.
* **Limitation**: The Bodyguard **cannot** protect the exact same player two nights in a row.
* **UI State**: The previously protected target is marked as `Blocked` and their selection button is disabled.

### 2. Seer
* **Action**: Inspects one player to discover their true alignment.
* **Result**: The UI will ONLY reveal if the inspected player is a `WEREWOLF` or `HUMAN`. It must **never** reveal the exact explicit role (e.g. it won't say "Bodyguard" or "Witch", only "HUMAN").
* **Village Curse**: If the Elder was executed by village vote, the Seer's power is lost for the rest of the game.

### 3. Werewolves
* **Action**: Collectively vote to eliminate one player.
* **Resolution**: The target is marked for death, but they **do not** die immediately. The Witch will see this target during her turn.

### 4. Witch
* **Action**: Has two single-use potions:
  * **Healing Potion**: Can save the Werewolves' victim from dying.
  * **Poison Potion**: Can eliminate an additional player.
* **Constraints**: 
  * The Witch is told who the Werewolves attacked.
  * Both potions can theoretically be used in the same night (subject to custom variant rules, but generally supported by the engine).
  * Once a potion is consumed, the "Potion Used" state is persisted and the button becomes permanently disabled for future nights.
* **Village Curse**: If the Elder was executed by village vote, the Witch's powers are lost for the rest of the game.

### 5. Hunter
* **Action**: If the Hunter is eliminated (either during the day vote or night phase), they immediately take a "Last Stand" (Hunter Revenge Phase).
* **Resolution**: The moderator selects a target for the Hunter to shoot as their dying breath.
* **Constraints**: The Hunter Revenge is **optional**. The moderator can choose to "Skip Target" if the Hunter decides to spare the village. This action is drafted and requires clicking "Confirm Shoot".

### 6. Mayor
* **Daytime Voting**: The Mayor's vote counts **double** (weight = 2).
* **UI**: The Mayor's voting card in the `VotingPanel` shows a `×2` badge and the effective vote count is calculated accordingly.
* **Night Phase**: No special night action.

### 7. Idiot
* **Daytime Voting**: When the village votes to execute the Idiot **for the first time**:
  * The Idiot **survives** — their `isAlive` stays `true`.
  * Their `status` is set to `Exposed`.
  * Their vote weight is permanently set to `0` for the rest of the game.
* **Subsequent votes**: If the Idiot is voted out again (status is already `Exposed`), they are eliminated normally.
* **UI**: The Idiot's card shows an "Exposed · 0 votes" badge. The VotingPanel locks their counter at 0.

### 8. Elder
* **Special Rule**: If the Elder is eliminated by a **Village vote** (daytime execution), a **Village Curse** is triggered:
  * The `villageCursed` flag is set to `true` in `GameStatus`.
  * The Seer, Bodyguard, and Witch **lose all their powers** for the rest of the game.
  * A `SPECIAL` log entry is created and a "CURSED" badge appears in the header.
* **Night Phase Death**: If the Elder is killed by Werewolves at night, no curse is triggered.

## Daytime Voting Rules

### Vote Weighting
| Role/Status | Vote Weight |
|-------------|-------------|
| Default | 1 |
| Mayor | 2 |
| Idiot (Exposed) | 0 |

### Tie-Breaking
The moderator can set a tie-break rule in the `VotingPanel`:
* **No Execution** (default): In the event of a tie, no player is executed and the day ends normally.
* **Double Execution**: Both tied players are executed simultaneously.
