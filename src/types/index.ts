export type RoleType = 'VILLAGER' | 'WEREWOLF' | 'SEER' | 'HUNTER' | 'WITCH' | 'CUPID' | 'BODYGUARD' | 'MAYOR' | 'IDIOT' | 'ELDER';
export type Winner = 'VILLAGERS' | 'WEREWOLVES' | 'LOVERS';
export type SessionStage = 'SETUP' | 'RUNNING' | 'FINISHED';
export type GamePhase = 'DAY' | 'NIGHT' | 'HUNTER_RESPONSE';
export type PlayerStatus = 'ALIVE' | 'EXPOSED';
export type NightStep = 'CUPID' | 'BODYGUARD' | 'SEER' | 'WEREWOLVES' | 'WITCH' | 'REVIEW';

export interface Player { id: string; name: string; role: RoleType; isAlive: boolean; status: PlayerStatus; isMayor: boolean; loverPartnerId?: string; faction?: 'LOVERS'; }
export interface RoleMeta { label: string; faction: 'VILLAGE' | 'WEREWOLF' | 'NEUTRAL'; color: string; balanceWeight: number; unique: boolean; wakeOrder?: number; cursed: boolean; }
export const ROLE_CATALOG: Record<RoleType, RoleMeta> = {
  VILLAGER: { label: 'Villager', faction: 'VILLAGE', color: 'slate', balanceWeight: 1, unique: false, cursed: false },
  WEREWOLF: { label: 'Werewolf', faction: 'WEREWOLF', color: 'red', balanceWeight: -6, unique: false, wakeOrder: 4, cursed: false },
  BODYGUARD: { label: 'Bodyguard', faction: 'VILLAGE', color: 'blue', balanceWeight: 3, unique: true, wakeOrder: 2, cursed: true },
  SEER: { label: 'Seer', faction: 'VILLAGE', color: 'violet', balanceWeight: 5, unique: true, wakeOrder: 3, cursed: true },
  WITCH: { label: 'Witch', faction: 'VILLAGE', color: 'emerald', balanceWeight: 4, unique: true, wakeOrder: 5, cursed: true },
  HUNTER: { label: 'Hunter', faction: 'VILLAGE', color: 'orange', balanceWeight: 3, unique: true, cursed: true },
  CUPID: { label: 'Cupid', faction: 'NEUTRAL', color: 'pink', balanceWeight: -2, unique: true, wakeOrder: 1, cursed: false },
  MAYOR: { label: 'Mayor', faction: 'VILLAGE', color: 'amber', balanceWeight: 2, unique: true, cursed: false },
  IDIOT: { label: 'Idiot', faction: 'VILLAGE', color: 'fuchsia', balanceWeight: 2, unique: true, cursed: false },
  ELDER: { label: 'Elder', faction: 'VILLAGE', color: 'yellow', balanceWeight: 2, unique: true, cursed: false },
};

export interface GameStatus { stage: SessionStage; phase: GamePhase; dayNumber: number; confirmedWinner: Winner | null; suggestedWinner: Winner | null; witchResources: { healAvailable: boolean; poisonAvailable: boolean }; lastProtectedPlayerId: string | null; pendingHunterId: string | null; villageCursed: boolean; elderShield: 'INTACT' | 'CRACKED'; }
export interface SetupDraft { players: Player[]; }
export interface DayOutcomeDraft { type: 'ELIMINATION' | 'NO_ELIMINATION' | 'MAYOR_ELECTION'; playerId?: string; }
export interface NightDraft { cupidTargetIds: string[]; bodyguardTargetId: string | null; seerTargetId: string | null; werewolfTargetId: string | null; witchSaveTargetId: string | null; witchPoisonTargetId: string | null; }
export type ResolutionEffectType = 'ELIMINATE' | 'EXPOSE_IDIOT' | 'ASSIGN_MAYOR' | 'LINK_LOVERS' | 'CRACK_ELDER_SHIELD' | 'ACTIVATE_CURSE' | 'CONSUME_POTION' | 'SET_LAST_PROTECTED' | 'TRIGGER_HUNTER' | 'ADVANCE_DAY';
export interface ResolutionEffect { type: ResolutionEffectType; playerId?: string; relatedPlayerId?: string; resource?: 'HEAL' | 'POISON'; explanation: string; }
export interface ModeratorAnnouncement { text: string; playerIds: string[]; }
export interface ResolutionPreview { effects: ResolutionEffect[]; announcements: ModeratorAnnouncement[]; warnings: string[]; fingerprint: string; }
export type GameEventType = 'SETUP' | 'DAY' | 'NIGHT' | 'HUNTER' | 'CORRECTION' | 'SYSTEM' | 'FINISH';
export interface GameEvent { id: string; createdAt: number; dayNumber: number; phase: GamePhase; type: GameEventType; summary: string; playerIds: string[]; effects: ResolutionEffect[]; }
export interface NightAction { type: keyof Omit<NightDraft, 'cupidTargetIds'> | 'cupidTargetIds'; targetIds: string[]; }
export interface SessionSnapshot { players: Player[]; status: GameStatus; nightActions: NightAction[]; events: GameEvent[]; }
export interface UndoCheckpoint { label: string; snapshot: SessionSnapshot; }
export interface PersistedSessionV2 extends SessionSnapshot { version: 2; savedAt: number; undoCheckpoint: UndoCheckpoint | null; }
export interface PlayerCorrection { type: 'ELIMINATE' | 'REVIVE' | 'TOGGLE_MAYOR'; playerId: string; }
export const emptyNightDraft = (): NightDraft => ({ cupidTargetIds: [], bodyguardTargetId: null, seerTargetId: null, werewolfTargetId: null, witchSaveTargetId: null, witchPoisonTargetId: null });
export const defaultStatus = (): GameStatus => ({ stage: 'SETUP', phase: 'DAY', dayNumber: 1, confirmedWinner: null, suggestedWinner: null, witchResources: { healAvailable: true, poisonAvailable: true }, lastProtectedPlayerId: null, pendingHunterId: null, villageCursed: false, elderShield: 'INTACT' });
