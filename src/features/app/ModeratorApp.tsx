'use client';

import { useEffect } from 'react';
import { Moon } from 'lucide-react';
import { useStream } from '@/logic/antigravity/stream';
import { gameStore } from '@/logic/game-store';
import { SetupWizard } from '@/features/setup/SetupWizard';
import { GameCockpit } from '@/features/game/GameCockpit';

export function ModeratorApp() {
  const ready = useStream(gameStore.ready);
  const players = useStream(gameStore.playerList);
  const status = useStream(gameStore.gameStatus);

  useEffect(() => { gameStore.hydrate(); }, []);

  if (!ready) return <main className="loading-shell" aria-live="polite"><div className="loading-mark"><Moon size={30} fill="currentColor"/></div><p className="eyebrow">Private host console</p><h1>Restoring Vespera</h1><div className="loading-line"/><span>Loading the last confirmed table…</span></main>;
  return status.stage === 'SETUP' ? <SetupWizard savedPlayers={players}/> : <GameCockpit/>;
}
