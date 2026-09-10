// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SetupWizard } from '@/features/setup/SetupWizard';
import { GameCockpit } from '@/features/game/GameCockpit';
import { NightAssistant } from '@/features/game/NightAssistant';
import { gameStore } from '@/logic/game-store';

describe('host workflows', () => {
  beforeEach(() => gameStore.resetSession(false));
  afterEach(cleanup);

  it('keeps setup local until the final confirmation', async () => {
    const user = userEvent.setup();
    render(<SetupWizard savedPlayers={[]}/>);
    for (const name of ['Wolf', 'Ada', 'Bea']) {
      await user.type(screen.getByLabelText('Player name'), name);
      await user.click(screen.getByRole('button', { name: 'Add' }));
    }
    expect(gameStore.playerList.value).toEqual([]);
    await user.click(screen.getByRole('button', { name: /Continue/ }));
    await user.click(screen.getByRole('button', { name: 'Add Werewolf' }));
    await user.click(screen.getByRole('button', { name: /Continue/ }));
    expect(screen.getAllByText('Role concealed')).toHaveLength(3);
    expect(gameStore.playerList.value).toEqual([]);
    await user.click(screen.getByRole('button', { name: /Begin game/ }));
    expect(gameStore.gameStatus.value.stage).toBe('RUNNING');
    expect(gameStore.playerList.value).toHaveLength(3);
  });

  it('conceals roles in the cockpit and reveals one only in the private dialog', async () => {
    const user = userEvent.setup();
    const players = [gameStore.createSetupPlayer('Wolf'), gameStore.createSetupPlayer('Ada'), gameStore.createSetupPlayer('Bea')];
    players[0].role = 'WEREWOLF';
    gameStore.confirmSetup({ players });
    render(<GameCockpit/>);
    expect(screen.queryByText('Werewolf')).toBeNull();
    await user.click(screen.getByRole('button', { name: /Wolf, alive/ }));
    expect(screen.getByRole('dialog').textContent).toContain('Secret role');
    expect(screen.getByRole('dialog').textContent).toContain('Werewolf');
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Close dialog' }));
  });

  it('preserves night timing with a ghost pane for an eliminated role', () => {
    const players = [gameStore.createSetupPlayer('Wolf'), gameStore.createSetupPlayer('Guard'), gameStore.createSetupPlayer('Ada')];
    players[0].role = 'WEREWOLF';
    players[1].role = 'BODYGUARD';
    gameStore.confirmSetup({ players });
    gameStore.confirmPlayerCorrection({ type: 'ELIMINATE', playerId: players[1].id });
    gameStore.startNight();
    render(<NightAssistant players={gameStore.playerList.value} status={gameStore.gameStatus.value}/>);
    expect(screen.getByText('Bodyguard is eliminated')).not.toBeNull();
    expect(screen.queryByText('Tap to choose')).toBeNull();
  });
});
