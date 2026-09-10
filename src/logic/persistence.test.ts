import { describe, expect, it } from 'vitest';
import { initialSession, migrateLegacy, parseV2 } from '@/logic/persistence';
import { createPlayer } from '@/types';

const storage = (values: Record<string, string>): Pick<Storage, 'getItem'> => ({ getItem: (key) => values[key] ?? null });

describe('V2 persistence', () => {
  it('parses a valid session and removes dangling references', () => {
    const session = initialSession();
    session.players = [{ ...createPlayer('Ada', 'a'), loverPartnerId: 'missing' }];
    session.status.lastProtectedPlayerId = 'missing';
    const parsed = parseV2(JSON.stringify(session));
    expect(parsed?.players[0].loverPartnerId).toBeUndefined();
    expect(parsed?.status.lastProtectedPlayerId).toBeNull();
  });

  it('rejects invalid JSON and invalid envelopes safely', () => {
    expect(parseV2('{oops')).toBeNull();
    expect(parseV2(JSON.stringify({ version: 1 }))).toBeNull();
  });

  it('migrates legacy state, actions, and logs without deriving effects from text', () => {
    const migrated = migrateLegacy(storage({
      'vespera-players': JSON.stringify([{ id: 'w', name: 'Wolf', role: 'WEREWOLF', isAlive: true, status: 'Alive' }, { id: 'v', name: 'Vee', role: 'VILLAGER', isAlive: true, status: 'Alive', isMayor: true }]),
      'vespera-status': JSON.stringify({ phase: 'NIGHT', dayCount: 3, lastProtectedId: 'v', witchState: { hasHeal: false, hasPoison: true } }),
      'vespera-actions': JSON.stringify([{ type: 'WEREWOLF_KILL', targetId: 'v' }, { type: 'WITCH_KILL', targetId: 'missing' }]),
      'vespera-logs': JSON.stringify([{ id: '1', timestamp: 4, dayCount: 2, phase: 'DAY', message: 'Old display text', involvedPlayerIds: ['v', 'missing'] }]),
    }));
    expect(migrated?.status).toMatchObject({ stage: 'RUNNING', phase: 'NIGHT', dayNumber: 3, lastProtectedPlayerId: 'v', witchResources: { healAvailable: false, poisonAvailable: true } });
    expect(migrated?.nightActions).toEqual([{ type: 'WEREWOLF_KILL', targetIds: ['v'] }]);
    expect(migrated?.events[0]).toMatchObject({ type: 'SYSTEM', playerIds: ['v'], effects: [] });
  });

  it('returns null when legacy data cannot form a roster', () => {
    expect(migrateLegacy(storage({ 'vespera-players': 'not json' }))).toBeNull();
    expect(migrateLegacy(storage({ 'vespera-players': '[]' }))).toBeNull();
  });
});
