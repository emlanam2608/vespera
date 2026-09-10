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

export type Winner = 'VILLAGERS' | 'WEREWOLVES' | 'LOVERS';
export type SessionStage = 'SETUP' | 'RUNNING' | 'FINISHED';
export type GamePhase = 'DAY' | 'NIGHT' | 'HUNTER_RESPONSE';
export type PlayerStatus = 'ALIVE' | 'EXPOSED';
export type NightStep = 'CUPID' | 'BODYGUARD' | 'SEER' | 'WEREWOLVES' | 'WITCH' | 'REVIEW';

export interface Player {
  id: string;
  name: string;
  role: RoleType;
  isAlive: boolean;
  status: PlayerStatus;
  isMayor: boolean;
  loverPartnerId?: string;
  faction?: 'LOVERS';
}

export interface RoleMeta {
  label: string;
  description: string;
  faction: 'VILLAGE' | 'WEREWOLF' | 'NEUTRAL';
  tone: 'slate' | 'red' | 'violet' | 'orange' | 'emerald' | 'pink' | 'blue' | 'amber';
  balanceWeight: number;
  unique: boolean;
  wakeOrder?: number;
  cursed: boolean;
}

export const ROLE_CATALOG: Record<RoleType, RoleMeta> = {
  VILLAGER: { label: 'Villager', description: 'Find the pack through discussion and voting.', faction: 'VILLAGE', tone: 'slate', balanceWeight: 1, unique: false, cursed: false },
  WEREWOLF: { label: 'Werewolf', description: 'Choose one victim with the pack each night.', faction: 'WEREWOLF', tone: 'red', balanceWeight: -6, unique: false, wakeOrder: 4, cursed: false },
  BODYGUARD: { label: 'Bodyguard', description: 'Protect one player, but not twice in a row.', faction: 'VILLAGE', tone: 'blue', balanceWeight: 3, unique: true, wakeOrder: 2, cursed: true },
  SEER: { label: 'Seer', description: 'Learn whether one player is human or werewolf.', faction: 'VILLAGE', tone: 'violet', balanceWeight: 5, unique: true, wakeOrder: 3, cursed: true },
  WITCH: { label: 'Witch', description: 'Hold one healing and one poison potion.', faction: 'VILLAGE', tone: 'emerald', balanceWeight: 4, unique: true, wakeOrder: 5, cursed: true },
  HUNTER: { label: 'Hunter', description: 'May take one final shot after being eliminated.', faction: 'VILLAGE', tone: 'orange', balanceWeight: 3, unique: true, cursed: true },
  CUPID: { label: 'Cupid', description: 'Link two Lovers on the first night.', faction: 'NEUTRAL', tone: 'pink', balanceWeight: -2, unique: true, wakeOrder: 1, cursed: false },
  MAYOR: { label: 'Mayor', description: 'Carries a double vote after being elected.', faction: 'VILLAGE', tone: 'amber', balanceWeight: 2, unique: true, cursed: false },
  IDIOT: { label: 'Idiot', description: 'Survives the first execution but loses their vote.', faction: 'VILLAGE', tone: 'pink', balanceWeight: 2, unique: true, cursed: false },
  ELDER: { label: 'Elder', description: 'Survives the first unprotected wolf attack.', faction: 'VILLAGE', tone: 'amber', balanceWeight: 2, unique: true, cursed: false },
};

export interface GameStatus {
  stage: SessionStage;
  phase: GamePhase;
  dayNumber: number;
  confirmedWinner: Winner | null;
  suggestedWinner: Winner | null;
  witchResources: { healAvailable: boolean; poisonAvailable: boolean };
  lastProtectedPlayerId: string | null;
  pendingHunterId: string | null;
  villageCursed: boolean;
  elderShield: 'INTACT' | 'CRACKED';
}

export interface SetupDraft { players: Player[]; }
export interface DayOutcomeDraft { type: 'ELIMINATION' | 'NO_ELIMINATION' | 'MAYOR_ELECTION'; playerId?: string; }
export interface NightDraft { cupidTargetIds: string[]; bodyguardTargetId: string | null; seerTargetId: string | null; werewolfTargetId: string | null; witchSaveTargetId: string | null; witchPoisonTargetId: string | null; }
export type ResolutionEffectType = 'ELIMINATE' | 'REVIVE' | 'EXPOSE_IDIOT' | 'ASSIGN_MAYOR' | 'CLEAR_MAYOR' | 'LINK_LOVERS' | 'CRACK_ELDER_SHIELD' | 'ACTIVATE_CURSE' | 'CONSUME_POTION' | 'SET_LAST_PROTECTED' | 'TRIGGER_HUNTER' | 'ADVANCE_DAY';
export interface ResolutionEffect { type: ResolutionEffectType; playerId?: string; relatedPlayerId?: string; resource?: 'HEAL' | 'POISON'; explanation: string; }
export interface ModeratorAnnouncement { text: string; playerIds: string[]; }
export interface ResolutionPreview { effects: ResolutionEffect[]; announcements: ModeratorAnnouncement[]; warnings: string[]; fingerprint: string; }
export type GameEventType = 'SETUP' | 'DAY' | 'NIGHT' | 'HUNTER' | 'CORRECTION' | 'SYSTEM' | 'FINISH';
export interface GameEvent { id: string; createdAt: number; dayNumber: number; phase: GamePhase; type: GameEventType; summary: string; playerIds: string[]; effects: ResolutionEffect[]; }
export type NightActionType = 'CUPID_LINK' | 'BODYGUARD_PROTECT' | 'SEER_INSPECT' | 'WEREWOLF_KILL' | 'WITCH_SAVE' | 'WITCH_POISON';
export interface NightAction { type: NightActionType; targetIds: string[]; }
export interface SessionSnapshot { players: Player[]; status: GameStatus; nightActions: NightAction[]; events: GameEvent[]; }
export interface UndoCheckpoint { label: string; snapshot: SessionSnapshot; }
export interface PersistedSessionV2 extends SessionSnapshot { version: 2; savedAt: number; undoCheckpoint: UndoCheckpoint | null; }
export interface PlayerCorrection { type: 'ELIMINATE' | 'REVIVE' | 'TOGGLE_MAYOR'; playerId: string; }

export const emptyNightDraft = (): NightDraft => ({ cupidTargetIds: [], bodyguardTargetId: null, seerTargetId: null, werewolfTargetId: null, witchSaveTargetId: null, witchPoisonTargetId: null });
export const defaultStatus = (): GameStatus => ({ stage: 'SETUP', phase: 'DAY', dayNumber: 1, confirmedWinner: null, suggestedWinner: null, witchResources: { healAvailable: true, poisonAvailable: true }, lastProtectedPlayerId: null, pendingHunterId: null, villageCursed: false, elderShield: 'INTACT' });
export const createPlayer = (name: string, id: string): Player => ({ id, name, role: 'VILLAGER', isAlive: true, status: 'ALIVE', isMayor: false });
