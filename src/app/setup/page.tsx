'use client';

import { LobbySetup } from '@/features/lobby/setup';
import { useStream } from '@/logic/antigravity/stream';
import { gameStore } from '@/logic/game-store';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function SetupPage() {
  const status = useStream(gameStore.gameStatus);
  const router = useRouter();

  // Redirect back to game if not in lobby
  useEffect(() => {
    if (status.phase !== 'LOBBY') {
      router.push('/');
    }
  }, [status.phase, router]);

  if (status.phase !== 'LOBBY') {
    return null;
  }

  return (
    <div className="min-h-screen bg-background text-foreground p-6 font-sans selection:bg-primary selection:text-primary-foreground">
      <header className="max-w-5xl mx-auto mb-12 flex justify-between items-end border-b border-border pb-6">
        <div>
          <h1 className="text-4xl font-black tracking-tighter uppercase italic text-primary">
            VESPERA
          </h1>
          <p className="text-muted-foreground font-medium text-sm">
            Werewolf Moderator Engine v1.0
          </p>
        </div>
      </header>
      
      <main className="max-w-5xl mx-auto">
        <LobbySetup />
      </main>
    </div>
  );
}
