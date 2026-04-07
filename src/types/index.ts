export type RoleType = 
  | 'VILLAGER' 
  | 'WEREWOLF' 
  | 'SEER' 
  | 'HUNTER' 
  | 'WITCH' 
  | 'CUPID' 
  | 'BODYGUARD'
  | 'MAYOR'
  | 'IDIOT'
  | 'ELDER';

export const ROLE_WEIGHTS: Record<RoleType, number> = {
  VILLAGER: 1,
  WEREWOLF: -6,
  SEER: 5,
  WITCH: 4,
  BODYGUARD: 3,
  HUNTER: 3,
  IDIOT: 2,
  ELDER: 2,
  MAYOR: 2,
  CUPID: -2,
};

export type PlayerStatus = 'Alive' | 'Idioted' | 'Exposed';

export interface Player {
  id: string;
  name: string;
  role: RoleType;
  isAlive: boolean;
  isModerator?: boolean;
  status?: PlayerStatus;
  isMayor?: boolean;
  /** Role publicly revealed after death (per reveal policy). Undefined = not yet revealed. */
  revealedRole?: RoleType;
  /** ID of the lover partner (Cupid mechanic). */
  loverPartnerId?: string;
  /** Custom faction. Usually undefined, but can be LOVERS if lovers are mixed-alignment */
  faction?: 'LOVERS';
}

export type GamePhase = 'LOBBY' | 'NIGHT' | 'DAY' | 'VOTING' | 'ELECTION' | 'REVENGE' | 'GAMEOVER';

export type TieBreakRule = 'NO_EXECUTION' | 'DOUBLE_EXECUTION';

export interface RevealPolicy {
  /** Always reveal role when a player is lynched by vote. */
  revealOnExecution: boolean;
  /** Reveal role in the morning summary after a night death. */
  revealOnNightDeath: boolean;
}

export interface GameStatus {
  phase: GamePhase;
  dayCount: number;
  winner: 'VILLAGERS' | 'WEREWOLVES' | 'LOVERS' | 'NONE' | null;
  witchState: {
    hasHeal: boolean;
    hasPoison: boolean;
  };
  lastProtectedId: string | null;
  pendingHunterId: string | null;
  tieBreakRule: TieBreakRule;
  villageCursed: boolean;
  /** True once the Elder has absorbed their first wolf attack. Resets on new game. */
  elderShieldCracked: boolean;
  /** Identity reveal rules. */
  revealPolicy: RevealPolicy;
}

export type ActionType = 
  | 'WEREWOLF_KILL' 
  | 'SEER_INSPECT' 
  | 'WITCH_SAVE' 
  | 'WITCH_KILL' 
  | 'BODYGUARD_PROTECT'
  | 'CUPID_LINK';

export interface NightAction {
  id: string;
  actorId: string;
  targetId: string;
  type: ActionType;
  resolved: boolean;
}

export type LogEventType = 
  | 'EXECUTION'
  | 'NIGHT_DEATH'
  | 'ABILITY'
  | 'SPECIAL'
  | 'INFO';

export interface GameLog {
  id: string;
  timestamp: number;
  dayCount: number;
  phase: GamePhase;
  type: LogEventType;
  message: string;
  involvedPlayerIds: string[];
}
