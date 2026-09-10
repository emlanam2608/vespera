'use client';

import { createStream, Stream } from '@/logic/antigravity/stream';
import { defaultStatus, DayOutcomeDraft, GameEvent, GameStatus, NightAction, NightDraft, PersistedSessionV2, Player, PlayerCorrection, ResolutionEffect, ResolutionPreview, SessionSnapshot, SetupDraft, UndoCheckpoint, Winner } from '@/types';
import { previewDayOutcome, previewHunterResponse, previewNightResolution, suggestWinner } from '@/logic/rules';

const STORAGE_KEY = 'vespera-session-v2';
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const id = () => Math.random().toString(36).slice(2, 10);

export class GameStore {
  public playerList: Stream<Player[]>;
  public gameStatus: Stream<GameStatus>;
  public nightActions: Stream<NightAction[]>;
  public gameEvents: Stream<GameEvent[]>;
  public undoCheckpoint: Stream<UndoCheckpoint | null>;
  public ready: Stream<boolean>;

  constructor() {
    const restored = this.restore();
    this.playerList = createStream(restored.players);
    this.gameStatus = createStream(restored.status);
    this.nightActions = createStream(restored.nightActions);
    this.gameEvents = createStream(restored.events);
    this.undoCheckpoint = createStream(restored.undoCheckpoint);
    this.ready = createStream(true);
  }

  private initial(): PersistedSessionV2 { return { version: 2, savedAt: Date.now(), players: [], status: defaultStatus(), nightActions: [], events: [], undoCheckpoint: null }; }
  private restore(): PersistedSessionV2 {
    if (typeof window === 'undefined') return this.initial();
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) { const parsed = JSON.parse(raw) as PersistedSessionV2; if (parsed.version === 2 && Array.isArray(parsed.players) && parsed.status) return parsed; }
      const players = JSON.parse(localStorage.getItem('vespera-players') || '[]') as Array<Partial<Player>>;
      if (Array.isArray(players) && players.length) return { ...this.initial(), players: players.map((player, index) => ({ id: player.id || `legacy-${index}`, name: player.name || `Player ${index + 1}`, role: (player.role || 'VILLAGER') as Player['role'], isAlive: player.isAlive !== false, status: (player.status as string) === 'Exposed' ? 'EXPOSED' : 'ALIVE', isMayor: Boolean(player.isMayor), loverPartnerId: player.loverPartnerId, faction: player.faction })), status: { ...defaultStatus(), stage: 'SETUP' } };
    } catch { /* Invalid saved state safely starts fresh. */ }
    return this.initial();
  }
  private snapshot(): SessionSnapshot { return { players: clone(this.playerList.value), status: clone(this.gameStatus.value), nightActions: clone(this.nightActions.value), events: clone(this.gameEvents.value) }; }
  private persist() { if (typeof window !== 'undefined') localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 2, savedAt: Date.now(), ...this.snapshot(), undoCheckpoint: this.undoCheckpoint.value })); }
  private checkpoint(label: string) { this.undoCheckpoint.set({ label, snapshot: this.snapshot() }); }
  private event(type: GameEvent['type'], summary: string, effects: ResolutionEffect[]) { this.gameEvents.set([...this.gameEvents.value, { id: id(), createdAt: Date.now(), dayNumber: this.gameStatus.value.dayNumber, phase: this.gameStatus.value.phase, type, summary, playerIds: effects.flatMap(effect => effect.playerId ? [effect.playerId] : []), effects }]); }
  private apply(effects: ResolutionEffect[]) {
    let players = clone(this.playerList.value); const status = clone(this.gameStatus.value);
    for (const effect of effects) {
      if (effect.type === 'ELIMINATE' && effect.playerId) players = players.map(player => player.id === effect.playerId ? { ...player, isAlive: false } : player);
      if (effect.type === 'EXPOSE_IDIOT' && effect.playerId) players = players.map(player => player.id === effect.playerId ? { ...player, status: 'EXPOSED' } : player);
      if (effect.type === 'ASSIGN_MAYOR' && effect.playerId) players = players.map(player => ({ ...player, isMayor: player.id === effect.playerId }));
      if (effect.type === 'LINK_LOVERS' && effect.playerId && effect.relatedPlayerId) { players = players.map(player => player.id === effect.playerId ? { ...player, loverPartnerId: effect.relatedPlayerId } : player.id === effect.relatedPlayerId ? { ...player, loverPartnerId: effect.playerId } : player); const a = players.find(player => player.id === effect.playerId); const b = players.find(player => player.id === effect.relatedPlayerId); if ((a?.role === 'WEREWOLF') !== (b?.role === 'WEREWOLF')) players = players.map(player => player.id === effect.playerId || player.id === effect.relatedPlayerId ? { ...player, faction: 'LOVERS' } : player); }
      if (effect.type === 'CRACK_ELDER_SHIELD') status.elderShield = 'CRACKED';
      if (effect.type === 'ACTIVATE_CURSE') status.villageCursed = true;
      if (effect.type === 'CONSUME_POTION') status.witchResources = { ...status.witchResources, healAvailable: effect.resource === 'HEAL' ? false : status.witchResources.healAvailable, poisonAvailable: effect.resource === 'POISON' ? false : status.witchResources.poisonAvailable };
      if (effect.type === 'SET_LAST_PROTECTED') status.lastProtectedPlayerId = effect.playerId || null;
      if (effect.type === 'TRIGGER_HUNTER') { status.phase = 'HUNTER_RESPONSE'; status.pendingHunterId = effect.playerId || null; }
      if (effect.type === 'ADVANCE_DAY') { status.dayNumber += 1; if (status.phase !== 'HUNTER_RESPONSE') status.phase = 'DAY'; }
    }
    status.suggestedWinner = suggestWinner(players);
    this.playerList.set(players); this.gameStatus.set(status);
  }
  private commit(label: string, type: GameEvent['type'], summary: string, effects: ResolutionEffect[]) { this.checkpoint(label); this.apply(effects); this.event(type, summary, effects); this.persist(); }
  private previewMatches(preview: ResolutionPreview, current: ResolutionPreview) { return preview.fingerprint === current.fingerprint; }

  public addSetupPlayer(name: string) { const normalized = name.trim(); if (!normalized || this.playerList.value.some(player => player.name.toLocaleLowerCase() === normalized.toLocaleLowerCase())) return false; this.playerList.set([...this.playerList.value, { id: id(), name: normalized, role: 'VILLAGER', isAlive: true, status: 'ALIVE', isMayor: false }]); this.persist(); return true; }
  public removeSetupPlayer(playerId: string) { this.playerList.set(this.playerList.value.filter(player => player.id !== playerId)); this.persist(); }
  public setSetupRole(playerId: string, role: Player['role']) { const existing = this.playerList.value.filter(player => player.id !== playerId && player.role === role).length; if (existing && role !== 'VILLAGER' && role !== 'WEREWOLF') return false; this.playerList.set(this.playerList.value.map(player => player.id === playerId ? { ...player, role } : player)); this.persist(); return true; }
  public randomizeSetupRoles(roles: Player['role'][]) { const shuffled = [...roles]; for (let index = shuffled.length - 1; index > 0; index -= 1) { const target = Math.floor(Math.random() * (index + 1)); [shuffled[index], shuffled[target]] = [shuffled[target], shuffled[index]]; } this.playerList.set(this.playerList.value.map((player, index) => ({ ...player, role: shuffled[index] || 'VILLAGER' }))); this.persist(); }
  public confirmSetup(draft: SetupDraft) { if (draft.players.length < 3) return false; this.checkpoint('Confirm setup'); this.playerList.set(clone(draft.players)); this.gameStatus.set({ ...defaultStatus(), stage: 'RUNNING' }); this.nightActions.set([]); this.event('SETUP', 'Session setup confirmed.', []); this.persist(); return true; }
  public startNight() { this.gameStatus.set({ ...this.gameStatus.value, phase: 'NIGHT', suggestedWinner: null }); this.persist(); }
  public cancelNightDraft() { this.gameStatus.set({ ...this.gameStatus.value, phase: 'DAY' }); this.persist(); }
  public previewDayOutcome(draft: DayOutcomeDraft) { return previewDayOutcome(this.playerList.value, this.gameStatus.value, draft); }
  public confirmDayOutcome(draft: DayOutcomeDraft, resolution: ResolutionPreview) { const current = this.previewDayOutcome(draft); if (!this.previewMatches(resolution, current) || current.warnings.length) return false; this.commit('Confirm day outcome', 'DAY', draft.type === 'NO_ELIMINATION' ? 'No daytime outcome recorded.' : 'Day outcome confirmed.', current.effects); return true; }
  public previewNightResolution(draft: NightDraft) { return previewNightResolution(this.playerList.value, this.gameStatus.value, draft); }
  public confirmNightResolution(draft: NightDraft, resolution: ResolutionPreview) { const current = this.previewNightResolution(draft); if (!this.previewMatches(resolution, current) || current.warnings.length) return false; const actions: NightAction[] = Object.entries(draft).filter(([, value]) => Array.isArray(value) ? value.length : Boolean(value)).map(([type, value]) => ({ type: type as NightAction['type'], targetIds: Array.isArray(value) ? value : [value as string] })); this.commit('Resolve night', 'NIGHT', 'Night resolution confirmed.', current.effects); this.nightActions.set(actions); this.persist(); return true; }
  public previewHunterResponse(targetId: string | null) { return previewHunterResponse(this.playerList.value, targetId); }
  public confirmHunterResponse(targetId: string | null, resolution: ResolutionPreview) { const current = this.previewHunterResponse(targetId); if (!this.previewMatches(resolution, current)) return false; this.commit('Resolve Hunter', 'HUNTER', targetId ? 'Hunter response confirmed.' : 'Hunter passed.', current.effects); this.gameStatus.set({ ...this.gameStatus.value, phase: 'DAY', pendingHunterId: null, suggestedWinner: suggestWinner(this.playerList.value) }); this.persist(); return true; }
  public confirmPlayerCorrection(correction: PlayerCorrection) { const target = this.playerList.value.find(player => player.id === correction.playerId); if (!target) return false; const effects: ResolutionEffect[] = correction.type === 'ELIMINATE' ? [{ type: 'ELIMINATE', playerId: target.id, explanation: `${target.name} was removed by moderator correction.` }] : correction.type === 'TOGGLE_MAYOR' ? [{ type: 'ASSIGN_MAYOR', playerId: target.isMayor ? undefined : target.id, explanation: 'Mayor corrected.' }] : []; this.commit('Moderator correction', 'CORRECTION', 'Moderator correction confirmed.', effects); if (correction.type === 'REVIVE') this.playerList.set(this.playerList.value.map(player => player.id === target.id ? { ...player, isAlive: true, status: 'ALIVE' } : player)); this.persist(); return true; }
  public finishGame(winner: Winner) { this.commit('Finish game', 'FINISH', `${winner} confirmed as winner.`, []); this.gameStatus.set({ ...this.gameStatus.value, stage: 'FINISHED', confirmedWinner: winner, suggestedWinner: null }); this.persist(); }
  public dismissWinnerSuggestion() { this.gameStatus.set({ ...this.gameStatus.value, suggestedWinner: null }); this.persist(); }
  public undoLastCommit() { const checkpoint = this.undoCheckpoint.value; if (!checkpoint) return false; this.playerList.set(clone(checkpoint.snapshot.players)); this.gameStatus.set(clone(checkpoint.snapshot.status)); this.nightActions.set(clone(checkpoint.snapshot.nightActions)); this.gameEvents.set([...clone(checkpoint.snapshot.events), { id: id(), createdAt: Date.now(), dayNumber: checkpoint.snapshot.status.dayNumber, phase: checkpoint.snapshot.status.phase, type: 'SYSTEM', summary: `Undid: ${checkpoint.label}`, playerIds: [], effects: [] }]); this.undoCheckpoint.set(null); this.persist(); return true; }
  public resetSession(keepPlayers = true) { const players: Player[] = keepPlayers ? this.playerList.value.map(player => ({ ...player, role: 'VILLAGER' as const, isAlive: true, status: 'ALIVE' as const, isMayor: false, loverPartnerId: undefined, faction: undefined })) : []; this.playerList.set(players); this.gameStatus.set(defaultStatus()); this.nightActions.set([]); this.gameEvents.set([]); this.undoCheckpoint.set(null); this.persist(); }
}

export const gameStore = new GameStore();
