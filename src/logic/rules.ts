import { DayOutcomeDraft, GameStatus, NightDraft, Player, ResolutionEffect, ResolutionPreview, Winner } from '@/types';

const fingerprint = (value: unknown) => JSON.stringify(value);
const preview = (effects: ResolutionEffect[], warnings: string[] = []): ResolutionPreview => ({ effects, warnings, announcements: effects.filter(effect => effect.type === 'ELIMINATE').map(effect => ({ text: effect.explanation, playerIds: effect.playerId ? [effect.playerId] : [] })), fingerprint: fingerprint({ effects, warnings }) });
const player = (players: Player[], id?: string) => players.find(candidate => candidate.id === id);

function deathEffects(players: Player[], playerId: string, reason: string): ResolutionEffect[] {
  const target = player(players, playerId);
  if (!target?.isAlive) return [];
  const effects: ResolutionEffect[] = [{ type: 'ELIMINATE', playerId, explanation: `${target.name} is eliminated ${reason}.` }];
  if (target.loverPartnerId) {
    const lover = player(players, target.loverPartnerId);
    if (lover?.isAlive) effects.push({ type: 'ELIMINATE', playerId: lover.id, relatedPlayerId: playerId, explanation: `${lover.name} dies of a broken heart.` });
  }
  return effects;
}

export function previewDayOutcome(players: Player[], status: GameStatus, draft: DayOutcomeDraft): ResolutionPreview {
  if (draft.type === 'NO_ELIMINATION') return preview([], []);
  if (!draft.playerId || !player(players, draft.playerId)?.isAlive) return preview([], ['Choose a living player before continuing.']);
  if (draft.type === 'MAYOR_ELECTION') return preview([{ type: 'ASSIGN_MAYOR', playerId: draft.playerId, explanation: `${player(players, draft.playerId)?.name} becomes Mayor.` }]);
  const target = player(players, draft.playerId)!;
  if (target.role === 'IDIOT' && target.status !== 'EXPOSED') return preview([{ type: 'EXPOSE_IDIOT', playerId: target.id, explanation: `${target.name} survives as the exposed Idiot and loses their vote.` }]);
  const effects = deathEffects(players, target.id, 'by the village');
  if (target.role === 'ELDER') effects.push({ type: 'ACTIVATE_CURSE', explanation: 'The Elder was executed: village powers are cursed.' });
  if (effects.some(effect => player(players, effect.playerId)?.role === 'HUNTER') && !status.villageCursed) effects.push({ type: 'TRIGGER_HUNTER', playerId: effects.find(effect => player(players, effect.playerId)?.role === 'HUNTER')?.playerId, explanation: 'Hunter Last Stand must be resolved.' });
  return preview(effects);
}

export function previewNightResolution(players: Player[], status: GameStatus, draft: NightDraft): ResolutionPreview {
  const effects: ResolutionEffect[] = [];
  const warnings: string[] = [];
  if (draft.cupidTargetIds.length === 1 || draft.cupidTargetIds.length > 2 || new Set(draft.cupidTargetIds).size !== draft.cupidTargetIds.length) warnings.push('Cupid needs two different targets or no targets.');
  if (draft.cupidTargetIds.length === 2) {
    const [a, b] = draft.cupidTargetIds;
    effects.push({ type: 'LINK_LOVERS', playerId: a, relatedPlayerId: b, explanation: `${player(players, a)?.name} and ${player(players, b)?.name} become Lovers.` });
  }
  if (draft.bodyguardTargetId) effects.push({ type: 'SET_LAST_PROTECTED', playerId: draft.bodyguardTargetId, explanation: `${player(players, draft.bodyguardTargetId)?.name} is protected tonight.` });
  if (draft.witchSaveTargetId) effects.push({ type: 'CONSUME_POTION', resource: 'HEAL', explanation: 'The healing potion is consumed.' });
  if (draft.witchPoisonTargetId) effects.push({ type: 'CONSUME_POTION', resource: 'POISON', explanation: 'The poison potion is consumed.' });
  if (draft.werewolfTargetId && draft.werewolfTargetId !== draft.bodyguardTargetId && draft.werewolfTargetId !== draft.witchSaveTargetId) {
    const target = player(players, draft.werewolfTargetId);
    if (target?.role === 'ELDER' && status.elderShield === 'INTACT') effects.push({ type: 'CRACK_ELDER_SHIELD', playerId: target.id, explanation: `${target.name}'s shield absorbs the wolf attack and cracks.` });
    else effects.push(...deathEffects(players, draft.werewolfTargetId, 'during the night'));
  }
  if (draft.witchPoisonTargetId) {
    const poisoned = player(players, draft.witchPoisonTargetId);
    effects.push(...deathEffects(players, draft.witchPoisonTargetId, 'by poison'));
    if (poisoned?.role === 'ELDER') effects.push({ type: 'ACTIVATE_CURSE', explanation: 'The Elder was poisoned: village powers are cursed.' });
  }
  const hunter = effects.find(effect => effect.type === 'ELIMINATE' && player(players, effect.playerId)?.role === 'HUNTER');
  if (hunter && !status.villageCursed) effects.push({ type: 'TRIGGER_HUNTER', playerId: hunter.playerId, explanation: 'Hunter Last Stand must be resolved.' });
  effects.push({ type: 'ADVANCE_DAY', explanation: 'Advance to the next day.' });
  return preview(effects, warnings);
}

export function previewHunterResponse(players: Player[], targetId: string | null): ResolutionPreview {
  return targetId ? preview(deathEffects(players, targetId, 'by the Hunter')) : preview([]);
}

export function suggestWinner(players: Player[]): Winner | null {
  const alive = players.filter(player => player.isAlive);
  if (!alive.length) return null;
  if (alive.length <= 3 && alive.every(player => player.faction === 'LOVERS')) return 'LOVERS';
  const wolves = alive.filter(player => player.role === 'WEREWOLF');
  if (!wolves.length && players.some(player => player.role === 'WEREWOLF')) return 'VILLAGERS';
  const wolfPower = wolves.reduce((total, wolf) => total + (wolf.isMayor ? 2 : 1), 0);
  const humanPower = alive.filter(player => player.role !== 'WEREWOLF').reduce((total, human) => total + (human.status === 'EXPOSED' ? 0 : human.isMayor ? 2 : 1), 0);
  return wolfPower >= humanPower ? 'WEREWOLVES' : null;
}
