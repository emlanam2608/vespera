'use client';

import { createStream, type ReadonlyStream } from '@/logic/antigravity/stream';
import { initialSession, migrateLegacy, parseV2, STORAGE_KEY } from '@/logic/persistence';
import { previewDayOutcome, previewHunterResponse, previewNightResolution, suggestWinner } from '@/logic/rules';
import { createPlayer, defaultStatus, type DayOutcomeDraft, type GameEvent, type GameStatus, type NightAction, type NightDraft, type PersistedSessionV2, type Player, type PlayerCorrection, type ResolutionEffect, type ResolutionPreview, type SessionSnapshot, type SetupDraft, type UndoCheckpoint, type Winner } from '@/types';

const clone = <T,>(value: T): T => structuredClone(value);
const id = () => typeof crypto !== 'undefined' && crypto.randomUUID
  ? crypto.randomUUID()
  : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

function applyEffects(playersInput: Player[], statusInput: GameStatus, effects: ResolutionEffect[]) {
  let players = clone(playersInput);
  const status = clone(statusInput);
  for (const effect of effects) {
    if (effect.type === 'ELIMINATE' && effect.playerId) players = players.map((player) => player.id === effect.playerId ? { ...player, isAlive: false } : player);
    if (effect.type === 'REVIVE' && effect.playerId) players = players.map((player) => player.id === effect.playerId ? { ...player, isAlive: true, status: 'ALIVE' } : player);
    if (effect.type === 'EXPOSE_IDIOT' && effect.playerId) players = players.map((player) => player.id === effect.playerId ? { ...player, status: 'EXPOSED' } : player);
    if (effect.type === 'ASSIGN_MAYOR' && effect.playerId) players = players.map((player) => ({ ...player, isMayor: player.id === effect.playerId }));
    if (effect.type === 'CLEAR_MAYOR') players = players.map((player) => ({ ...player, isMayor: false }));
    if (effect.type === 'LINK_LOVERS' && effect.playerId && effect.relatedPlayerId) {
      const first = players.find((player) => player.id === effect.playerId);
      const second = players.find((player) => player.id === effect.relatedPlayerId);
      const mixed = (first?.role === 'WEREWOLF') !== (second?.role === 'WEREWOLF');
      players = players.map((player) => player.id === effect.playerId ? { ...player, loverPartnerId: effect.relatedPlayerId, faction: mixed ? 'LOVERS' : player.faction } : player.id === effect.relatedPlayerId ? { ...player, loverPartnerId: effect.playerId, faction: mixed ? 'LOVERS' : player.faction } : player);
    }
    if (effect.type === 'CRACK_ELDER_SHIELD') status.elderShield = 'CRACKED';
    if (effect.type === 'ACTIVATE_CURSE') status.villageCursed = true;
    if (effect.type === 'CONSUME_POTION') status.witchResources = { healAvailable: effect.resource === 'HEAL' ? false : status.witchResources.healAvailable, poisonAvailable: effect.resource === 'POISON' ? false : status.witchResources.poisonAvailable };
    if (effect.type === 'SET_LAST_PROTECTED') status.lastProtectedPlayerId = effect.playerId ?? null;
    if (effect.type === 'TRIGGER_HUNTER') { status.phase = 'HUNTER_RESPONSE'; status.pendingHunterId = effect.playerId ?? null; }
    if (effect.type === 'ADVANCE_DAY') { status.dayNumber += 1; if (status.phase !== 'HUNTER_RESPONSE') status.phase = 'DAY'; }
  }
  status.suggestedWinner = status.phase === 'HUNTER_RESPONSE' ? null : suggestWinner(players);
  return { players, status };
}

export class GameStore {
  private readonly playerStream = createStream<Player[]>([]);
  private readonly statusStream = createStream<GameStatus>(defaultStatus());
  private readonly actionStream = createStream<NightAction[]>([]);
  private readonly eventStream = createStream<GameEvent[]>([]);
  private readonly undoStream = createStream<UndoCheckpoint | null>(null);
  private readonly readyStream = createStream(false);
  public readonly playerList: ReadonlyStream<Player[]> = this.playerStream;
  public readonly gameStatus: ReadonlyStream<GameStatus> = this.statusStream;
  public readonly nightActions: ReadonlyStream<NightAction[]> = this.actionStream;
  public readonly gameEvents: ReadonlyStream<GameEvent[]> = this.eventStream;
  public readonly undoCheckpoint: ReadonlyStream<UndoCheckpoint | null> = this.undoStream;
  public readonly ready: ReadonlyStream<boolean> = this.readyStream;
  private hydrated = false;

  public hydrate() {
    if (this.hydrated || typeof window === 'undefined') return;
    this.hydrated = true;
    const restored = parseV2(localStorage.getItem(STORAGE_KEY)) ?? migrateLegacy(localStorage) ?? initialSession();
    this.restore(restored);
    this.readyStream.set(true);
    this.persist();
  }

  private snapshot(): SessionSnapshot { return { players: clone(this.playerList.value), status: clone(this.gameStatus.value), nightActions: clone(this.nightActions.value), events: clone(this.gameEvents.value) }; }
  private restore(session: PersistedSessionV2 | SessionSnapshot) { this.playerStream.set(clone(session.players)); this.statusStream.set(clone(session.status)); this.actionStream.set(clone(session.nightActions)); this.eventStream.set(clone(session.events)); this.undoStream.set('undoCheckpoint' in session ? clone(session.undoCheckpoint) : null); }
  private persist() {
    if (typeof window === 'undefined' || !this.hydrated) return;
    const snapshot = this.snapshot();
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 2, savedAt: Date.now(), ...snapshot, undoCheckpoint: this.undoCheckpoint.value } satisfies PersistedSessionV2));
    localStorage.setItem('vespera-players', JSON.stringify(snapshot.players));
    localStorage.setItem('vespera-status', JSON.stringify(snapshot.status));
    localStorage.setItem('vespera-actions', JSON.stringify(snapshot.nightActions));
    localStorage.setItem('vespera-logs', JSON.stringify(snapshot.events));
  }
  private commit(label: string, type: GameEvent['type'], summary: string, effects: ResolutionEffect[], nightActions = this.nightActions.value) {
    const checkpoint = { label, snapshot: this.snapshot() };
    const next = applyEffects(this.playerList.value, this.gameStatus.value, effects);
    const event: GameEvent = { id: id(), createdAt: Date.now(), dayNumber: this.gameStatus.value.dayNumber, phase: this.gameStatus.value.phase, type, summary, playerIds: [...new Set(effects.flatMap((effect) => effect.playerId ? [effect.playerId] : []))], effects };
    this.playerStream.set(next.players); this.statusStream.set(next.status); this.actionStream.set(clone(nightActions)); this.eventStream.set([...this.gameEvents.value, event]); this.undoStream.set(checkpoint); this.persist();
  }
  private matching(preview: ResolutionPreview, current: ResolutionPreview) { return preview.fingerprint === current.fingerprint; }

  public createSetupPlayer(name: string) { return createPlayer(name.trim(), id()); }
  public confirmSetup(draft: SetupDraft) {
    const names = draft.players.map((player) => player.name.trim().toLocaleLowerCase());
    const uniqueRoles = draft.players.filter((player) => player.role !== 'VILLAGER' && player.role !== 'WEREWOLF').map((player) => player.role);
    if (draft.players.length < 3 || names.some((name) => !name) || new Set(names).size !== names.length || new Set(uniqueRoles).size !== uniqueRoles.length || !draft.players.some((player) => player.role === 'WEREWOLF')) return false;
    const cleanPlayers = draft.players.map((player) => ({ ...player, name: player.name.trim(), isAlive: true, status: 'ALIVE' as const, isMayor: false, loverPartnerId: undefined, faction: undefined }));
    const checkpoint = { label: 'Confirm setup', snapshot: this.snapshot() };
    const status = { ...defaultStatus(), stage: 'RUNNING' as const };
    const event: GameEvent = { id: id(), createdAt: Date.now(), dayNumber: 1, phase: 'DAY', type: 'SETUP', summary: `Session started with ${cleanPlayers.length} players.`, playerIds: cleanPlayers.map((player) => player.id), effects: [] };
    this.playerStream.set(cleanPlayers); this.statusStream.set(status); this.actionStream.set([]); this.eventStream.set([event]); this.undoStream.set(checkpoint); this.persist(); return true;
  }
  public startNight() { if (this.gameStatus.value.stage !== 'RUNNING' || this.gameStatus.value.phase !== 'DAY') return; this.statusStream.set({ ...this.gameStatus.value, phase: 'NIGHT', suggestedWinner: null }); this.persist(); }
  public cancelNightDraft() { if (this.gameStatus.value.phase !== 'NIGHT') return; this.statusStream.set({ ...this.gameStatus.value, phase: 'DAY' }); this.persist(); }
  public previewDayOutcome(draft: DayOutcomeDraft) { return previewDayOutcome(this.playerList.value, this.gameStatus.value, draft); }
  public confirmDayOutcome(draft: DayOutcomeDraft, preview: ResolutionPreview) { const current = this.previewDayOutcome(draft); if (!this.matching(preview, current) || current.warnings.length) return false; this.commit('Confirm day outcome', 'DAY', draft.type === 'NO_ELIMINATION' ? 'No player was eliminated.' : draft.type === 'MAYOR_ELECTION' ? 'Mayor election recorded.' : 'Village elimination recorded.', current.effects); return true; }
  public previewNightResolution(draft: NightDraft) { return previewNightResolution(this.playerList.value, this.gameStatus.value, draft); }
  public confirmNightResolution(draft: NightDraft, preview: ResolutionPreview) {
    const current = this.previewNightResolution(draft); if (!this.matching(preview, current) || current.warnings.length) return false;
    const actions: NightAction[] = [draft.cupidTargetIds.length ? { type: 'CUPID_LINK', targetIds: draft.cupidTargetIds } : null, draft.bodyguardTargetId ? { type: 'BODYGUARD_PROTECT', targetIds: [draft.bodyguardTargetId] } : null, draft.seerTargetId ? { type: 'SEER_INSPECT', targetIds: [draft.seerTargetId] } : null, draft.werewolfTargetId ? { type: 'WEREWOLF_KILL', targetIds: [draft.werewolfTargetId] } : null, draft.witchSaveTargetId ? { type: 'WITCH_SAVE', targetIds: [draft.witchSaveTargetId] } : null, draft.witchPoisonTargetId ? { type: 'WITCH_POISON', targetIds: [draft.witchPoisonTargetId] } : null].filter((action): action is NightAction => action !== null);
    this.commit('Resolve night', 'NIGHT', 'Night resolution confirmed.', current.effects, actions); return true;
  }
  public previewHunterResponse(targetId: string | null) { return previewHunterResponse(this.playerList.value, this.gameStatus.value, targetId); }
  public suggestWinner() { return suggestWinner(this.playerList.value); }
  public confirmHunterResponse(targetId: string | null, preview: ResolutionPreview) { const current = this.previewHunterResponse(targetId); if (!this.matching(preview, current) || current.warnings.length) return false; this.commit('Resolve Hunter', 'HUNTER', targetId ? 'Hunter took a final shot.' : 'Hunter chose not to shoot.', current.effects); this.statusStream.set({ ...this.gameStatus.value, phase: 'DAY', pendingHunterId: null, suggestedWinner: suggestWinner(this.playerList.value) }); this.persist(); return true; }
  public confirmPlayerCorrection(correction: PlayerCorrection) {
    const target = this.playerList.value.find((player) => player.id === correction.playerId); if (!target) return false;
    const effects: ResolutionEffect[] = correction.type === 'ELIMINATE' ? [{ type: 'ELIMINATE', playerId: target.id, explanation: `${target.name} is marked eliminated by moderator correction.` }] : correction.type === 'REVIVE' ? [{ type: 'REVIVE', playerId: target.id, explanation: `${target.name} is restored by moderator correction.` }] : target.isMayor ? [{ type: 'CLEAR_MAYOR', explanation: `${target.name} is no longer Mayor.` }] : [{ type: 'ASSIGN_MAYOR', playerId: target.id, explanation: `${target.name} is now Mayor.` }];
    this.commit('Moderator correction', 'CORRECTION', effects[0].explanation, effects); return true;
  }
  public dismissWinnerSuggestion() { this.statusStream.set({ ...this.gameStatus.value, suggestedWinner: null }); this.persist(); }
  public finishGame(winner: Winner) { const checkpoint = { label: 'Finish game', snapshot: this.snapshot() }; const status = { ...this.gameStatus.value, stage: 'FINISHED' as const, confirmedWinner: winner, suggestedWinner: null }; const event: GameEvent = { id: id(), createdAt: Date.now(), dayNumber: status.dayNumber, phase: status.phase, type: 'FINISH', summary: `${winner} confirmed as winner.`, playerIds: [], effects: [] }; this.statusStream.set(status); this.eventStream.set([...this.gameEvents.value, event]); this.undoStream.set(checkpoint); this.persist(); }
  public undoLastCommit() { const checkpoint = this.undoCheckpoint.value; if (!checkpoint) return false; const events = [...clone(checkpoint.snapshot.events), { id: id(), createdAt: Date.now(), dayNumber: checkpoint.snapshot.status.dayNumber, phase: checkpoint.snapshot.status.phase, type: 'SYSTEM' as const, summary: `Undid: ${checkpoint.label}`, playerIds: [], effects: [] }]; this.restore({ ...checkpoint.snapshot, events }); this.undoStream.set(null); this.persist(); return true; }
  public resetSession(keepPlayers = true) { const players = keepPlayers ? this.playerList.value.map((player) => createPlayer(player.name, player.id)) : []; this.playerStream.set(players); this.statusStream.set(defaultStatus()); this.actionStream.set([]); this.eventStream.set([]); this.undoStream.set(null); this.persist(); }
}

export const gameStore = new GameStore();
