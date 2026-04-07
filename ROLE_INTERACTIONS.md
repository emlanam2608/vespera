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
* **Village Curse**: If `villageCursed = true`, the Hunter's Last Stand is **suppressed**. They die silently — the `REVENGE` phase is **not** triggered.

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
* **Shield (Resilience)**: The Elder requires **two** successful Werewolf attacks to die at night.
  * **First wolf hit** (no Bodyguard cover): Sets `elderShieldCracked = true`. The Elder **survives**. A log entry announces the shield absorbed the blow.
  * **Second wolf hit**: The shield is already cracked — the Elder is eliminated. **No curse triggered.**
  * **Bodyguard protection**: Fully negates the wolf attack. The shield does **not** crack.
  * **Edge case — Witch saves after first hit**: The wolf attack cracks the shield (`elderShieldCracked = true`), but the Witch's heal keeps the Elder alive. The shield **remains cracked** for future nights.
* **Instant-death sources** (bypass the shield entirely):
  * Witch's Poison
  * Hunter's Shot (Last Stand)
  * Village Daytime Execution
* **The Curse (Global Debuff)**: Triggered **only** if the Elder is killed by:
  1. **Village Daytime Execution** (`voteExecution`)
  2. **Witch's Poison** (`resolveNight` — witch kill targeting Elder)
  * **Effect**: Sets `villageCursed = true` in `GameStatus`. All roles listed in the **Village Curse — Affected Roles** table below lose their powers for the rest of the game.
  * A `SPECIAL` log entry is created and a `🔥 CURSED` badge appears in the header.
* **UI**:
  * Player card shows a **Shield badge** (blue = intact, amber = cracked) while the Elder is alive.
  * In the WEREWOLVES step of the Night Engine, a small shield icon appears next to the Elder's target button indicating current shield state.


---

## Village Curse — Affected Roles

This is the **canonical reference** for which roles are suppressed when `villageCursed = true`.
Always check this table when implementing any new role's special ability.

| Role | Ability Lost | Suppression Behaviour |
|------|-------------|----------------------|
| Seer | Inspection | Night Engine shows Ghost Pane: "Village Curse Active" instead of player grid |
| Bodyguard | Protection | Night Engine shows Ghost Pane: "Village Curse Active" instead of player grid |
| Witch | Both potions | Night Engine shows Ghost Pane: "Village Curse Active" instead of potion buttons |
| Hunter | Last Stand (Revenge shot) | Death processed silently — `REVENGE` phase is **not** triggered |

> **Rule for new roles**: If a new power role should be affected by the curse, add it to this table AND implement the suppression check before shipping.

---

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

## Role Balance (Lobby Setup)

The Moderator App provides an **Auto-Balancing System** during the lobby phase to help create fair matches.

### Balance Score Calculation
Each role is assigned a specific `weight` that contributes to the `currentBalanceScore`:
- **Village Lean (+)**: Roles that provide information or protection to the village.
- **Wolf Lean (-)**: Roles that favor the werewolves or create chaos.

| Role | Weight | Why? |
|------|--------|------|
| Villager | +1 | Basic village unit. |
| Werewolf | -6 | Primary threat; high impact. |
| Seer | +5 | Powerful information role. |
| Witch | +4 | Potential for 2 kills/saves. |
| Bodyguard | +3 | Consistent protection. |
| Hunter | +3 | Defensive elimination. |
| Idiot | +2 | Extra vote/survivability. |
| Elder | +2 | High value target. |
| Mayor | +2 | Double voting power. |
| Cupid | -2 | Creates unpredictable third party. |

### Balance Thresholds
- **Balanced (-2 to +2)**: The game is statistically fair for both sides.
- **Village Advantage (> +2)**: The village has too much power/information.
- **Wolf Advantage (< -2)**: The werewolves have a significant edge.

### Smart Suggestions
The setup screen will suggest adding specific roles (e.g., adding a Seer if wolves have an advantage) to bring the score back toward the **Balanced Zone**.
