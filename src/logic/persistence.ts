import { defaultStatus, type GameEvent, type GamePhase, type GameStatus, type NightAction, type NightActionType, type PersistedSessionV2, type Player, type RoleType, type SessionSnapshot, type UndoCheckpoint, type Winner } from '@/types';

export const STORAGE_KEY = 'vespera-session-v2';
const ROLE_TYPES = new Set<RoleType>(['VILLAGER', 'WEREWOLF', 'SEER', 'HUNTER', 'WITCH', 'CUPID', 'BODYGUARD', 'MAYOR', 'IDIOT', 'ELDER']);

export const initialSession = (): PersistedSessionV2 => ({ version: 2, savedAt: Date.now(), players: [], status: defaultStatus(), nightActions: [], events: [], undoCheckpoint: null });
const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

function validPlayer(value: unknown): value is Player {
  return record(value) && typeof value.id === 'string' && typeof value.name === 'string' && ROLE_TYPES.has(value.role as RoleType) && typeof value.isAlive === 'boolean' && (value.status === 'ALIVE' || value.status === 'EXPOSED') && typeof value.isMayor === 'boolean';
}

function validStatus(value: unknown): value is GameStatus {
  return record(value)
    && (value.stage === 'SETUP' || value.stage === 'RUNNING' || value.stage === 'FINISHED')
    && (value.phase === 'DAY' || value.phase === 'NIGHT' || value.phase === 'HUNTER_RESPONSE')
    && typeof value.dayNumber === 'number'
    && value.dayNumber >= 1
    && record(value.witchResources)
    && typeof value.witchResources.healAvailable === 'boolean'
    && typeof value.witchResources.poisonAvailable === 'boolean'
    && typeof value.villageCursed === 'boolean'
    && (value.elderShield === 'INTACT' || value.elderShield === 'CRACKED')
    && (value.confirmedWinner === null || value.confirmedWinner === 'VILLAGERS' || value.confirmedWinner === 'WEREWOLVES' || value.confirmedWinner === 'LOVERS')
    && (value.suggestedWinner === null || value.suggestedWinner === 'VILLAGERS' || value.suggestedWinner === 'WEREWOLVES' || value.suggestedWinner === 'LOVERS');
}

function sanitizePlayers(players: Player[]): Player[] {
  const ids = new Set(players.map((player) => player.id));
  return players.map((player) => ({ ...player, loverPartnerId: player.loverPartnerId && ids.has(player.loverPartnerId) && player.loverPartnerId !== player.id ? player.loverPartnerId : undefined, faction: player.faction === 'LOVERS' ? 'LOVERS' : undefined }));
}

const legacyActionTypes: Partial<Record<string, NightActionType>> = {
  CUPID_LINK: 'CUPID_LINK', BODYGUARD_PROTECT: 'BODYGUARD_PROTECT', SEER_INSPECT: 'SEER_INSPECT', WEREWOLF_KILL: 'WEREWOLF_KILL', WITCH_SAVE: 'WITCH_SAVE', WITCH_KILL: 'WITCH_POISON', WITCH_POISON: 'WITCH_POISON',
};

function migrateActions(raw: string | null, ids: Set<string>): NightAction[] {
  const source: unknown = JSON.parse(raw || '[]');
  if (!Array.isArray(source)) return [];
  return source.filter(record).flatMap((action) => {
    const type = legacyActionTypes[typeof action.type === 'string' ? action.type : ''];
    const targets = Array.isArray(action.targetIds) ? action.targetIds : typeof action.targetId === 'string' ? [action.targetId] : [];
    const targetIds = targets.filter((target): target is string => typeof target === 'string' && ids.has(target));
    return type && targetIds.length ? [{ type, targetIds }] : [];
  });
}

function migrateEvents(raw: string | null, ids: Set<string>): GameEvent[] {
  const source: unknown = JSON.parse(raw || '[]');
  if (!Array.isArray(source)) return [];
  return source.filter(record).map((event, index) => ({
    id: typeof event.id === 'string' ? `legacy-${event.id}` : `legacy-event-${index}`,
    createdAt: typeof event.timestamp === 'number' ? event.timestamp : Date.now() + index,
    dayNumber: typeof event.dayCount === 'number' ? Math.max(1, event.dayCount) : 1,
    phase: event.phase === 'NIGHT' ? 'NIGHT' as const : event.phase === 'REVENGE' ? 'HUNTER_RESPONSE' as const : 'DAY' as const,
    type: 'SYSTEM' as const,
    summary: typeof event.message === 'string' ? `Legacy record: ${event.message}` : 'Legacy session record.',
    playerIds: (Array.isArray(event.involvedPlayerIds) ? event.involvedPlayerIds : []).filter((id): id is string => typeof id === 'string' && ids.has(id)),
    effects: [],
  }));
}

function sanitizeSnapshot(value: unknown): SessionSnapshot | null {
  if (!record(value) || !Array.isArray(value.players) || !value.players.every(validPlayer) || !validStatus(value.status) || !Array.isArray(value.nightActions) || !Array.isArray(value.events)) return null;
  const players = sanitizePlayers(value.players);
  const ids = new Set(players.map((player) => player.id));
  const nightActions = migrateActions(JSON.stringify(value.nightActions), ids);
  const events = (value.events as unknown[]).filter(record).flatMap((event) => typeof event.id === 'string' && typeof event.summary === 'string' && Array.isArray(event.effects) ? [{ ...event, playerIds: (Array.isArray(event.playerIds) ? event.playerIds : []).filter((target): target is string => typeof target === 'string' && ids.has(target)) } as GameEvent] : []);
  const status = structuredClone(value.status);
  if (status.lastProtectedPlayerId && !ids.has(status.lastProtectedPlayerId)) status.lastProtectedPlayerId = null;
  if (status.pendingHunterId && !ids.has(status.pendingHunterId)) status.pendingHunterId = null;
  return { players, status, nightActions, events };
}

export function parseV2(raw: string | null): PersistedSessionV2 | null {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (!record(value) || value.version !== 2 || !Array.isArray(value.players) || !value.players.every(validPlayer) || !validStatus(value.status) || !Array.isArray(value.nightActions) || !Array.isArray(value.events)) return null;
    const fallback = initialSession();
    const snapshot = sanitizeSnapshot(value);
    if (!snapshot) return null;
    let undoCheckpoint: UndoCheckpoint | null = null;
    if (record(value.undoCheckpoint) && typeof value.undoCheckpoint.label === 'string') {
      const undoSnapshot = sanitizeSnapshot(value.undoCheckpoint.snapshot);
      if (undoSnapshot) undoCheckpoint = { label: value.undoCheckpoint.label, snapshot: undoSnapshot };
    }
    return { ...fallback, ...snapshot, version: 2, savedAt: typeof value.savedAt === 'number' ? value.savedAt : Date.now(), undoCheckpoint };
  } catch { return null; }
}

export function migrateLegacy(storage: Pick<Storage, 'getItem'>): PersistedSessionV2 | null {
  try {
    const source: unknown = JSON.parse(storage.getItem('vespera-players') || '[]');
    if (!Array.isArray(source) || !source.length) return null;
    const players: Player[] = source.filter(record).map((value, index) => ({ id: typeof value.id === 'string' ? value.id : `legacy-${index}`, name: typeof value.name === 'string' ? value.name : `Player ${index + 1}`, role: ROLE_TYPES.has(value.role as RoleType) ? value.role as RoleType : 'VILLAGER', isAlive: value.isAlive !== false, status: value.status === 'Exposed' ? 'EXPOSED' : 'ALIVE', isMayor: value.isMayor === true, loverPartnerId: typeof value.loverPartnerId === 'string' ? value.loverPartnerId : undefined, faction: value.faction === 'LOVERS' ? 'LOVERS' : undefined }));
    const legacyStatus: unknown = JSON.parse(storage.getItem('vespera-status') || '{}');
    const session = initialSession();
    session.players = sanitizePlayers(players);
    const ids = new Set(session.players.map((player) => player.id));
    session.nightActions = migrateActions(storage.getItem('vespera-actions'), ids);
    session.events = migrateEvents(storage.getItem('vespera-logs'), ids);
    if (record(legacyStatus)) {
      session.status.dayNumber = typeof legacyStatus.dayCount === 'number' ? Math.max(1, legacyStatus.dayCount) : 1;
      session.status.villageCursed = legacyStatus.villageCursed === true;
      session.status.elderShield = legacyStatus.elderShieldCracked === true ? 'CRACKED' : 'INTACT';
      session.status.lastProtectedPlayerId = typeof legacyStatus.lastProtectedId === 'string' && ids.has(legacyStatus.lastProtectedId) ? legacyStatus.lastProtectedId : null;
      session.status.pendingHunterId = typeof legacyStatus.pendingHunterId === 'string' && ids.has(legacyStatus.pendingHunterId) ? legacyStatus.pendingHunterId : null;
      if (record(legacyStatus.witchState)) session.status.witchResources = { healAvailable: legacyStatus.witchState.hasHeal !== false, poisonAvailable: legacyStatus.witchState.hasPoison !== false };
      const phase = typeof legacyStatus.phase === 'string' ? legacyStatus.phase : 'LOBBY';
      session.status.stage = phase === 'LOBBY' ? 'SETUP' : phase === 'GAMEOVER' ? 'FINISHED' : 'RUNNING';
      session.status.phase = (phase === 'NIGHT' ? 'NIGHT' : phase === 'REVENGE' ? 'HUNTER_RESPONSE' : 'DAY') satisfies GamePhase;
      const winner = legacyStatus.winner;
      session.status.confirmedWinner = session.status.stage === 'FINISHED' && (winner === 'VILLAGERS' || winner === 'WEREWOLVES' || winner === 'LOVERS') ? winner as Winner : null;
    }
    return session;
  } catch { return null; }
}
