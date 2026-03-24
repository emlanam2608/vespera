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

export type PlayerStatus = 'Alive' | 'Idioted' | 'Exposed';

export interface Player {
  id: string;
  name: string;
  role: RoleType;
  isAlive: boolean;
  isModerator?: boolean;
  status?: PlayerStatus;
  isMayor?: boolean;
}

export type GamePhase = 'LOBBY' | 'NIGHT' | 'DAY' | 'VOTING' | 'ELECTION' | 'REVENGE' | 'GAMEOVER';

export type TieBreakRule = 'NO_EXECUTION' | 'DOUBLE_EXECUTION';

export interface GameStatus {
  phase: GamePhase;
  dayCount: number;
  winner: 'VILLAGERS' | 'WEREWOLVES' | 'NONE' | null;
  witchState: {
    hasHeal: boolean;
    hasPoison: boolean;
  };
  lastProtectedId: string | null;
  pendingHunterId: string | null;
  tieBreakRule: TieBreakRule;
  villageCursed: boolean;
}

export type ActionType = 
  | 'WEREWOLF_KILL' 
  | 'SEER_INSPECT' 
  | 'WITCH_SAVE' 
  | 'WITCH_KILL' 
  | 'BODYGUARD_PROTECT';

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
