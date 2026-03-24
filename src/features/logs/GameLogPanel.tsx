'use client';

import { useStream } from '@/logic/antigravity/stream';
import { gameStore } from '@/logic/game-store';
import { GameLog } from '@/types';
import { ScrollText, Skull, Moon, Zap, Info, Star } from 'lucide-react';

const LOG_CONFIG: Record<GameLog['type'], { icon: React.ReactNode; color: string; bg: string }> = {
  EXECUTION: {
    icon: <Skull className="w-3.5 h-3.5" />,
    color: 'text-red-400',
    bg: 'bg-red-500/10 border-red-500/20',
  },
  NIGHT_DEATH: {
    icon: <Moon className="w-3.5 h-3.5" />,
    color: 'text-indigo-400',
    bg: 'bg-indigo-500/10 border-indigo-500/20',
  },
  ABILITY: {
    icon: <Zap className="w-3.5 h-3.5" />,
    color: 'text-amber-400',
    bg: 'bg-amber-500/10 border-amber-500/20',
  },
  SPECIAL: {
    icon: <Star className="w-3.5 h-3.5" />,
    color: 'text-purple-400',
    bg: 'bg-purple-500/10 border-purple-500/20',
  },
  INFO: {
    icon: <Info className="w-3.5 h-3.5" />,
    color: 'text-muted-foreground',
    bg: 'bg-muted/30 border-border',
  },
};

function formatTime(timestamp: number): string {
  const d = new Date(timestamp);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function LogEntry({ log }: { log: GameLog }) {
  const config = LOG_CONFIG[log.type];
  return (
    <div className={`flex items-start gap-3 px-4 py-3 rounded-lg border text-sm ${config.bg}`}>
      <div className={`mt-0.5 shrink-0 ${config.color}`}>{config.icon}</div>
      <div className="flex-1 min-w-0">
        <p className="leading-snug text-foreground/90">{log.message}</p>
        <p className="text-[10px] text-muted-foreground mt-1 font-mono">
          Day {log.dayCount} · {log.phase} · {formatTime(log.timestamp)}
        </p>
      </div>
    </div>
  );
}

export function GameLogPanel() {
  const logs = useStream(gameStore.gameLogs);

  if (logs.length === 0) return null;

  const reversed = [...logs].reverse();

  return (
    <div className="mt-8 border border-border rounded-2xl overflow-hidden">
      <div className="px-5 py-4 border-b border-border flex items-center gap-2.5 bg-muted/20">
        <ScrollText className="w-4 h-4 text-muted-foreground" />
        <h2 className="text-sm font-black uppercase tracking-widest text-muted-foreground">
          Game Log
        </h2>
        <span className="ml-auto text-[10px] bg-muted rounded-full px-2 py-0.5 font-bold text-muted-foreground">
          {logs.length} events
        </span>
      </div>
      <div className="p-4 space-y-2 max-h-72 overflow-y-auto scrollbar-thin">
        {reversed.map(log => (
          <LogEntry key={log.id} log={log} />
        ))}
      </div>
    </div>
  );
}
