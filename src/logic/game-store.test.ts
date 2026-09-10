// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from 'vitest';
import { GameStore } from '@/logic/game-store';

describe('GameStore confirmation boundary', () => {
  beforeEach(() => {
    const values = new Map<string, string>();
    const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value), removeItem: (key: string) => values.delete(key), clear: () => values.clear(), key: (index: number) => [...values.keys()][index] ?? null, get length() { return values.size; } };
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage });
  });

  const runningStore = () => {
    const store = new GameStore();
    store.hydrate();
    const players = [store.createSetupPlayer('Wolf'), store.createSetupPlayer('Ada'), store.createSetupPlayer('Bea')];
    players[0].role = 'WEREWOLF';
    expect(store.confirmSetup({ players })).toBe(true);
    return store;
  };

  it('leaves every stream unchanged when previewing', () => {
    const store = runningStore();
    const before = JSON.stringify({ players: store.playerList.value, status: store.gameStatus.value, events: store.gameEvents.value, undo: store.undoCheckpoint.value });
    store.previewDayOutcome({ type: 'ELIMINATION', playerId: store.playerList.value[1].id });
    expect(JSON.stringify({ players: store.playerList.value, status: store.gameStatus.value, events: store.gameEvents.value, undo: store.undoCheckpoint.value })).toBe(before);
  });

  it('rejects a stale preview after the committed state changes', () => {
    const store = runningStore();
    const target = store.playerList.value[1];
    const preview = store.previewDayOutcome({ type: 'ELIMINATION', playerId: target.id });
    store.confirmPlayerCorrection({ type: 'TOGGLE_MAYOR', playerId: target.id });
    expect(store.confirmDayOutcome({ type: 'ELIMINATION', playerId: target.id }, preview)).toBe(false);
  });

  it('commits structured effects exactly once and fully undoes the commit', () => {
    const store = runningStore();
    const target = store.playerList.value[1];
    const beforePlayers = structuredClone(store.playerList.value);
    const preview = store.previewDayOutcome({ type: 'ELIMINATION', playerId: target.id });
    expect(store.confirmDayOutcome({ type: 'ELIMINATION', playerId: target.id }, preview)).toBe(true);
    expect(store.playerList.value.find((player) => player.id === target.id)?.isAlive).toBe(false);
    expect(store.gameEvents.value.at(-1)?.effects.filter((effect) => effect.type === 'ELIMINATE')).toHaveLength(1);
    expect(store.undoLastCommit()).toBe(true);
    expect(store.playerList.value).toEqual(beforePlayers);
    expect(store.undoCheckpoint.value).toBeNull();
    expect(store.gameEvents.value.at(-1)?.summary).toContain('Undid');
  });

  it('resets while preserving or clearing the roster as requested', () => {
    const store = runningStore();
    store.resetSession(true);
    expect(store.playerList.value).toHaveLength(3);
    expect(store.gameStatus.value.stage).toBe('SETUP');
    store.resetSession(false);
    expect(store.playerList.value).toEqual([]);
  });
});
