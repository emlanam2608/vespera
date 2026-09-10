import type { DayOutcomeDraft, GameStatus, NightDraft, Player, ResolutionEffect, ResolutionPreview, Winner } from '@/types';

const byId = (players: Player[], id?: string | null) => players.find((player) => player.id === id);
const uniqueEffects = (effects: ResolutionEffect[]) => effects.filter((effect, index) => effect.type !== 'ELIMINATE' || effects.findIndex((candidate) => candidate.type === 'ELIMINATE' && candidate.playerId === effect.playerId) === index);

function createPreview(players: Player[], status: GameStatus, draft: unknown, effects: ResolutionEffect[], warnings: string[] = []): ResolutionPreview {
  const normalized = uniqueEffects(effects);
  return {
    effects: normalized,
    warnings,
    announcements: normalized.filter((effect) => effect.type === 'ELIMINATE').map((effect) => ({ text: effect.explanation, playerIds: effect.playerId ? [effect.playerId] : [] })),
    fingerprint: JSON.stringify({ players, status, draft, effects: normalized, warnings }),
  };
}

function eliminate(players: Player[], playerId: string, reason: string): ResolutionEffect[] {
  const target = byId(players, playerId);
  if (!target?.isAlive) return [];
  const effects: ResolutionEffect[] = [{ type: 'ELIMINATE', playerId, explanation: `${target.name} is eliminated ${reason}.` }];
  const lover = byId(players, target.loverPartnerId);
  if (lover?.isAlive) effects.push({ type: 'ELIMINATE', playerId: lover.id, relatedPlayerId: target.id, explanation: `${lover.name} dies of a broken heart.` });
  return effects;
}

export function previewDayOutcome(players: Player[], status: GameStatus, draft: DayOutcomeDraft): ResolutionPreview {
  if (draft.type === 'NO_ELIMINATION') return createPreview(players, status, draft, [], []);
  const target = byId(players, draft.playerId);
  if (!target?.isAlive) return createPreview(players, status, draft, [], ['Choose a living player before continuing.']);
  if (draft.type === 'MAYOR_ELECTION') return createPreview(players, status, draft, [{ type: 'ASSIGN_MAYOR', playerId: target.id, explanation: `${target.name} becomes Mayor.` }]);
  if (target.role === 'IDIOT' && target.status !== 'EXPOSED') return createPreview(players, status, draft, [{ type: 'EXPOSE_IDIOT', playerId: target.id, explanation: `${target.name} survives as the exposed Idiot and loses their vote.` }]);

  const effects = eliminate(players, target.id, 'by the village');
  const elderWasExecuted = effects.some((effect) => effect.type === 'ELIMINATE' && byId(players, effect.playerId)?.role === 'ELDER');
  if (elderWasExecuted) effects.push({ type: 'ACTIVATE_CURSE', explanation: 'The Elder was executed. Village powers are now cursed.' });
  const hunter = effects.find((effect) => effect.type === 'ELIMINATE' && byId(players, effect.playerId)?.role === 'HUNTER');
  if (hunter && !status.villageCursed && !elderWasExecuted) effects.push({ type: 'TRIGGER_HUNTER', playerId: hunter.playerId, explanation: 'Hunter Last Stand must be resolved.' });
  return createPreview(players, status, draft, effects);
}

export function previewNightResolution(players: Player[], status: GameStatus, draft: NightDraft): ResolutionPreview {
  const effects: ResolutionEffect[] = [];
  const warnings: string[] = [];
  const cupidTargets = [...new Set(draft.cupidTargetIds)];
  if (draft.cupidTargetIds.length !== cupidTargets.length || cupidTargets.length === 1 || cupidTargets.length > 2) warnings.push('Cupid needs two different targets or no targets.');
  if (status.dayNumber > 1 && cupidTargets.length) warnings.push('Cupid can only link Lovers on the first night.');

  let workingPlayers = players;
  if (cupidTargets.length === 2 && status.dayNumber === 1) {
    const [firstId, secondId] = cupidTargets;
    if (!byId(players, firstId)?.isAlive || !byId(players, secondId)?.isAlive) warnings.push('Cupid must choose living players.');
    else {
      effects.push({ type: 'LINK_LOVERS', playerId: firstId, relatedPlayerId: secondId, explanation: `${byId(players, firstId)?.name} and ${byId(players, secondId)?.name} become Lovers.` });
      workingPlayers = players.map((player) => player.id === firstId ? { ...player, loverPartnerId: secondId } : player.id === secondId ? { ...player, loverPartnerId: firstId } : player);
    }
  }

  const livingRole = (role: Player['role']) => players.some((player) => player.role === role && player.isAlive);
  if (draft.bodyguardTargetId === status.lastProtectedPlayerId) warnings.push('The Bodyguard cannot protect the same player twice in a row.');
  if (draft.bodyguardTargetId && !byId(players, draft.bodyguardTargetId)?.isAlive) warnings.push('The Bodyguard must protect a living player.');
  if (draft.bodyguardTargetId && (!livingRole('BODYGUARD') || status.villageCursed)) warnings.push('The Bodyguard cannot act in the current game state.');
  if (draft.bodyguardTargetId && livingRole('BODYGUARD') && !status.villageCursed && byId(players, draft.bodyguardTargetId)?.isAlive && draft.bodyguardTargetId !== status.lastProtectedPlayerId) effects.push({ type: 'SET_LAST_PROTECTED', playerId: draft.bodyguardTargetId, explanation: `${byId(players, draft.bodyguardTargetId)?.name} is protected tonight.` });
  if (draft.seerTargetId && !byId(players, draft.seerTargetId)?.isAlive) warnings.push('The Seer must inspect a living player.');
  if (draft.seerTargetId && (!livingRole('SEER') || status.villageCursed)) warnings.push('The Seer cannot act in the current game state.');
  if (draft.witchSaveTargetId && draft.witchSaveTargetId !== draft.werewolfTargetId) warnings.push('The Witch can only heal the wolves’ target.');
  if (draft.witchSaveTargetId && !status.witchResources.healAvailable) warnings.push('The healing potion has already been used.');
  if (draft.witchPoisonTargetId && !status.witchResources.poisonAvailable) warnings.push('The poison potion has already been used.');
  if ((draft.witchSaveTargetId || draft.witchPoisonTargetId) && (!livingRole('WITCH') || status.villageCursed)) warnings.push('The Witch cannot act in the current game state.');
  const witchCanAct = livingRole('WITCH') && !status.villageCursed;
  if (draft.witchSaveTargetId && witchCanAct && status.witchResources.healAvailable && draft.witchSaveTargetId === draft.werewolfTargetId) effects.push({ type: 'CONSUME_POTION', resource: 'HEAL', explanation: 'The healing potion is consumed.' });
  if (draft.witchPoisonTargetId && witchCanAct && status.witchResources.poisonAvailable && byId(players, draft.witchPoisonTargetId)?.isAlive) effects.push({ type: 'CONSUME_POTION', resource: 'POISON', explanation: 'The poison potion is consumed.' });

  const protectedTarget = livingRole('BODYGUARD') && !status.villageCursed ? draft.bodyguardTargetId : null;
  const savedTarget = witchCanAct && status.witchResources.healAvailable ? draft.witchSaveTargetId : null;
  if (draft.werewolfTargetId && draft.werewolfTargetId !== protectedTarget) {
    const target = byId(workingPlayers, draft.werewolfTargetId);
    if (!target?.isAlive) warnings.push('The wolves must choose a living target.');
    else if (target.role === 'ELDER' && status.elderShield === 'INTACT') effects.push({ type: 'CRACK_ELDER_SHIELD', playerId: target.id, explanation: `${target.name} survives; the Elder shield absorbs the attack and cracks.` });
    else if (target.id !== savedTarget) effects.push(...eliminate(workingPlayers, target.id, 'during the night'));
  }

  if (draft.witchPoisonTargetId && witchCanAct && status.witchResources.poisonAvailable) {
    const target = byId(workingPlayers, draft.witchPoisonTargetId);
    if (!target?.isAlive) warnings.push('The Witch must poison a living player.');
    else {
      effects.push(...eliminate(workingPlayers, target.id, 'by poison'));
      if (target.role === 'ELDER') effects.push({ type: 'ACTIVATE_CURSE', explanation: 'The Elder was poisoned. Village powers are now cursed.' });
    }
  }

  const curseActivates = status.villageCursed || effects.some((effect) => effect.type === 'ACTIVATE_CURSE');
  const hunter = effects.find((effect) => effect.type === 'ELIMINATE' && byId(workingPlayers, effect.playerId)?.role === 'HUNTER');
  if (hunter && !curseActivates) effects.push({ type: 'TRIGGER_HUNTER', playerId: hunter.playerId, explanation: 'Hunter Last Stand must be resolved.' });
  effects.push({ type: 'ADVANCE_DAY', explanation: 'Advance to the next day.' });
  return createPreview(players, status, draft, effects, warnings);
}

export function previewHunterResponse(players: Player[], status: GameStatus, targetId: string | null): ResolutionPreview {
  if (status.villageCursed) return createPreview(players, status, { targetId }, [], ['The village curse suppresses the Hunter’s Last Stand.']);
  const effects = targetId ? eliminate(players, targetId, 'by the Hunter') : [];
  const warnings = targetId && !byId(players, targetId)?.isAlive ? ['Choose a living player.'] : [];
  return createPreview(players, status, { targetId }, effects, warnings);
}

export function inspectAlignment(players: Player[], targetId: string | null): 'WEREWOLF' | 'HUMAN' | null {
  const target = byId(players, targetId);
  return target ? target.role === 'WEREWOLF' ? 'WEREWOLF' : 'HUMAN' : null;
}

export function suggestWinner(players: Player[]): Winner | null {
  const alive = players.filter((player) => player.isAlive);
  if (!alive.length) return null;
  if (alive.length <= 3 && alive.every((player) => player.faction === 'LOVERS')) return 'LOVERS';
  const wolves = alive.filter((player) => player.role === 'WEREWOLF');
  if (!wolves.length && players.some((player) => player.role === 'WEREWOLF')) return 'VILLAGERS';
  const wolfPower = wolves.reduce((sum, player) => sum + (player.isMayor ? 2 : 1), 0);
  const villagePower = alive.filter((player) => player.role !== 'WEREWOLF').reduce((sum, player) => sum + (player.status === 'EXPOSED' ? 0 : player.isMayor ? 2 : 1), 0);
  return wolfPower >= villagePower ? 'WEREWOLVES' : null;
}
