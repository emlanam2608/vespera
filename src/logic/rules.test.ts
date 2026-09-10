import { describe, expect, it } from 'vitest';
import { defaultStatus, Player } from '@/types';
import { previewDayOutcome, previewNightResolution, suggestWinner } from '@/logic/rules';

const player = (id: string, role: Player['role']): Player => ({ id, name: id, role, isAlive: true, status: 'ALIVE', isMayor: false });

describe('moderator rule previews', () => {
  it('does not mutate state while previewing an Idiot execution', () => {
    const idiot = player('idiot', 'IDIOT');
    const preview = previewDayOutcome([idiot], defaultStatus(), { type: 'ELIMINATION', playerId: idiot.id });
    expect(preview.effects[0]?.type).toBe('EXPOSE_IDIOT');
    expect(idiot.status).toBe('ALIVE');
  });

  it('cracks an Elder shield on the first uncovered wolf attack', () => {
    const elder = player('elder', 'ELDER');
    const preview = previewNightResolution([elder], defaultStatus(), { cupidTargetIds: [], bodyguardTargetId: null, seerTargetId: null, werewolfTargetId: elder.id, witchSaveTargetId: null, witchPoisonTargetId: null });
    expect(preview.effects.some(effect => effect.type === 'CRACK_ELDER_SHIELD')).toBe(true);
  });

  it('only suggests a winner', () => {
    const players = [player('wolf', 'WEREWOLF'), { ...player('villager', 'VILLAGER'), isAlive: false }];
    expect(suggestWinner(players)).toBe('WEREWOLVES');
  });
});
