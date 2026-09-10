import { describe, expect, it } from 'vitest';
import { defaultStatus, emptyNightDraft, type GameStatus, type Player } from '@/types';
import { inspectAlignment, previewDayOutcome, previewHunterResponse, previewNightResolution, suggestWinner } from '@/logic/rules';

const player = (id: string, role: Player['role'], overrides: Partial<Player> = {}): Player => ({ id, name: id, role, isAlive: true, status: 'ALIVE', isMayor: false, ...overrides });
const status = (overrides: Partial<GameStatus> = {}) => ({ ...defaultStatus(), stage: 'RUNNING' as const, ...overrides });
const night = (overrides: Partial<ReturnType<typeof emptyNightDraft>> = {}) => ({ ...emptyNightDraft(), ...overrides });
const types = (preview: ReturnType<typeof previewNightResolution>) => preview.effects.map((effect) => effect.type);

describe('day outcome previews', () => {
  it('previews a normal elimination without mutating the player', () => {
    const villager = player('Ada', 'VILLAGER');
    const preview = previewDayOutcome([villager], status(), { type: 'ELIMINATION', playerId: villager.id });
    expect(types(preview)).toContain('ELIMINATE');
    expect(villager.isAlive).toBe(true);
  });

  it('records no elimination with no mechanical effect', () => {
    expect(previewDayOutcome([player('A', 'VILLAGER')], status(), { type: 'NO_ELIMINATION' }).effects).toEqual([]);
  });

  it('assigns and replaces the Mayor through one effect', () => {
    const preview = previewDayOutcome([player('A', 'MAYOR', { isMayor: true }), player('B', 'VILLAGER')], status(), { type: 'MAYOR_ELECTION', playerId: 'B' });
    expect(preview.effects).toMatchObject([{ type: 'ASSIGN_MAYOR', playerId: 'B' }]);
  });

  it('exposes the Idiot once, then eliminates them', () => {
    const first = previewDayOutcome([player('Idiot', 'IDIOT')], status(), { type: 'ELIMINATION', playerId: 'Idiot' });
    const second = previewDayOutcome([player('Idiot', 'IDIOT', { status: 'EXPOSED' })], status(), { type: 'ELIMINATION', playerId: 'Idiot' });
    expect(types(first)).toEqual(['EXPOSE_IDIOT']);
    expect(types(second)).toContain('ELIMINATE');
  });

  it('activates the curse and suppresses a chained Hunter when an Elder lover is executed', () => {
    const hunter = player('Hunter', 'HUNTER', { loverPartnerId: 'Elder' });
    const elder = player('Elder', 'ELDER', { loverPartnerId: 'Hunter' });
    const preview = previewDayOutcome([hunter, elder], status(), { type: 'ELIMINATION', playerId: hunter.id });
    expect(types(preview)).toContain('ACTIVATE_CURSE');
    expect(types(preview)).not.toContain('TRIGGER_HUNTER');
  });
});

describe('night resolution previews', () => {
  const cast = [player('Wolf', 'WEREWOLF'), player('Guard', 'BODYGUARD'), player('Seer', 'SEER'), player('Witch', 'WITCH'), player('Elder', 'ELDER'), player('Hunter', 'HUNTER'), player('Villager', 'VILLAGER')];

  it('rejects repeat protection', () => {
    const preview = previewNightResolution(cast, status({ lastProtectedPlayerId: 'Villager' }), night({ bodyguardTargetId: 'Villager' }));
    expect(preview.warnings).toContain('The Bodyguard cannot protect the same player twice in a row.');
  });

  it('cracks the Elder shield on the first uncovered attack, even when the Witch heals', () => {
    const preview = previewNightResolution(cast, status(), night({ werewolfTargetId: 'Elder', witchSaveTargetId: 'Elder' }));
    expect(types(preview)).toContain('CRACK_ELDER_SHIELD');
    expect(types(preview)).not.toContain('ELIMINATE');
  });

  it('lets protection preserve the intact Elder shield', () => {
    const preview = previewNightResolution(cast, status(), night({ bodyguardTargetId: 'Elder', werewolfTargetId: 'Elder' }));
    expect(types(preview)).not.toContain('CRACK_ELDER_SHIELD');
  });

  it('lets a heal save the Elder from a second attack', () => {
    const preview = previewNightResolution(cast, status({ elderShield: 'CRACKED' }), night({ werewolfTargetId: 'Elder', witchSaveTargetId: 'Elder' }));
    expect(preview.effects.some((effect) => effect.type === 'ELIMINATE' && effect.playerId === 'Elder')).toBe(false);
  });

  it('consumes both potions and activates the curse when the Witch poisons the Elder', () => {
    const preview = previewNightResolution(cast, status(), night({ werewolfTargetId: 'Villager', witchSaveTargetId: 'Villager', witchPoisonTargetId: 'Elder' }));
    expect(preview.effects.filter((effect) => effect.type === 'CONSUME_POTION')).toHaveLength(2);
    expect(types(preview)).toContain('ACTIVATE_CURSE');
  });

  it('links Cupid targets before expanding a same-night Lover death', () => {
    const preview = previewNightResolution(cast, status(), night({ cupidTargetIds: ['Hunter', 'Villager'], werewolfTargetId: 'Villager' }));
    expect(preview.effects.filter((effect) => effect.type === 'ELIMINATE').map((effect) => effect.playerId)).toEqual(expect.arrayContaining(['Villager', 'Hunter']));
    expect(types(preview)).toContain('TRIGGER_HUNTER');
  });

  it('suppresses cursed village powers', () => {
    const preview = previewNightResolution(cast, status({ villageCursed: true }), night({ bodyguardTargetId: 'Villager', witchPoisonTargetId: 'Wolf' }));
    expect(preview.warnings).toEqual(expect.arrayContaining(['The Bodyguard cannot act in the current game state.', 'The Witch cannot act in the current game state.']));
    expect(types(preview)).not.toContain('CONSUME_POTION');
  });
});

describe('Hunter, Seer, and winner advice', () => {
  it('reveals only alignment for the Seer', () => {
    const cast = [player('Wolf', 'WEREWOLF'), player('Witch', 'WITCH')];
    expect(inspectAlignment(cast, 'Wolf')).toBe('WEREWOLF');
    expect(inspectAlignment(cast, 'Witch')).toBe('HUMAN');
  });

  it('previews a Hunter shot, pass, and curse suppression', () => {
    const target = player('Target', 'VILLAGER');
    expect(types(previewHunterResponse([target], status(), target.id))).toContain('ELIMINATE');
    expect(previewHunterResponse([target], status(), null).effects).toEqual([]);
    expect(previewHunterResponse([target], status({ villageCursed: true }), target.id).effects).toEqual([]);
  });

  it.each([
    [[player('Wolf', 'WEREWOLF', { isAlive: false }), player('Human', 'VILLAGER')], 'VILLAGERS'],
    [[player('Wolf', 'WEREWOLF'), player('Human', 'VILLAGER', { isAlive: false })], 'WEREWOLVES'],
    [[player('A', 'WEREWOLF', { faction: 'LOVERS' }), player('B', 'VILLAGER', { faction: 'LOVERS' })], 'LOVERS'],
  ] as const)('suggests %s without mutating game state', (players, winner) => {
    const before = structuredClone(players);
    expect(suggestWinner([...players])).toBe(winner);
    expect(players).toEqual(before);
  });
});
