'use client';

import { useStream } from '@/logic/antigravity/stream';
import { gameStore } from '@/logic/game-store';
import { Player } from '@/types';
import {
  Skull,
  Heart,
  Shield,
  ShieldOff,
  Eye,
  Zap,
  Target,
  User,
  Moon,
  Sun,
  Users,
  RotateCcw,
  Scale,
  Crown,
  Flame,
  AlertTriangle,
  Trophy,
  Plus,
  ChevronDown,
} from 'lucide-react';

import { NightEngineWizard } from '@/features/night-engine/wizard';
import { VotingPanel } from '@/features/voting/VotingPanel';
import { GameLogPanel } from '@/features/logs/GameLogPanel';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function VesperaDashboard() {
  const players = useStream(gameStore.playerList);
  const status = useStream(gameStore.gameStatus);
  const [showLogs, setShowLogs] = useState(false);
  const router = useRouter();

  const [hunterTarget, setHunterTarget] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [showMorningSummary, setShowMorningSummary] = useState(false);
  const [lastDayCount, setLastDayCount] = useState(status.dayCount);
  const logs = useStream(gameStore.gameLogs);
  const revealQueue = useStream(gameStore.revealQueue);

  useEffect(() => {
    setMounted(true);
    if (status.phase === 'LOBBY') {
      router.push('/setup');
    }
  }, [status.phase, router]);

  useEffect(() => {
    if ((status.phase === 'DAY' || status.phase === 'REVENGE') && status.dayCount > lastDayCount) {
      setShowMorningSummary(true);
      setLastDayCount(status.dayCount);
    }
  }, [status.phase, status.dayCount, lastDayCount]);

  if (!mounted) return null;

  const aliveCount = players.filter(p => p.isAlive).length;
  const deadCount = players.length - aliveCount;

  const handleHunterRevenge = () => {
    if (hunterTarget) {
      gameStore.executeHunterRevenge(hunterTarget);
      setHunterTarget(null);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground p-4 sm:p-6 font-sans selection:bg-primary selection:text-primary-foreground">

      {/* Header */}
      <header className="max-w-5xl mx-auto mb-8 sm:mb-12 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-6 border-b border-border pb-6">
        <div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tighter uppercase italic text-primary">
            VESPERA
          </h1>
          <p className="text-muted-foreground font-medium text-xs sm:sm">
            Werewolf Moderator Engine v1.0
          </p>
        </div>

        <div className="flex gap-8 text-right">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Phase</p>
            <p className="text-xl font-black flex items-center gap-2">
              {status.phase === 'LOBBY' && <Users className="w-5 h-5" />}
              {status.phase === 'NIGHT' && <Moon className="w-5 h-5 text-indigo-400" />}
              {(status.phase === 'DAY' || status.phase === 'VOTING') && <Sun className="w-5 h-5 text-yellow-400" />}
              {status.phase === 'REVENGE' && <Shield className="w-5 h-5 text-orange-400" />}
              {status.phase === 'VOTING' && 'VOTING'}
              {status.phase === 'ELECTION' && 'ELECTION'}
              {status.phase !== 'VOTING' && status.phase !== 'ELECTION' && status.phase}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Alive / Dead</p>
            <p className="text-xl font-black tracking-tighter">
              <span className="text-primary">{aliveCount}</span>
              <span className="text-muted-foreground mx-1">/</span>
              <span className="text-destructive">{deadCount}</span>
            </p>
          </div>
          {status.villageCursed && (
            <div>
              <p className="text-[10px] uppercase tracking-widest text-amber-500 font-bold">Village</p>
              <p className="text-sm font-black text-amber-500 flex items-center gap-1">
                <Flame className="w-4 h-4" />CURSED
              </p>
            </div>
          )}
        </div>
      </header>

      {/* Main Grid */}
      <main className="max-w-5xl mx-auto space-y-8 sm:space-y-12">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
          {players.map((player) => (
            <PlayerCard key={player.id} player={player} />
          ))}
        </div>

        {/* Night Engine */}
        {status.phase === 'NIGHT' && (
          <div className="animate-in fade-in slide-in-from-top-12 duration-1000">
            <NightEngineWizard />
          </div>
        )}

        {/* Controls */}
        <div className="pt-8 border-t border-border flex flex-col sm:flex-row gap-4 justify-between">
          <div className="flex gap-3 flex-wrap flex-1">
            <button
              onClick={() => gameStore.setPhase('NIGHT')}
              className="bg-primary text-primary-foreground px-4 sm:px-6 py-3 rounded-lg text-sm font-bold uppercase tracking-tight hover:opacity-90 transition-opacity flex flex-1 justify-center items-center gap-2"
            >
              <Moon className="w-4 h-4" /> Start Night
            </button>
            <button
              onClick={() => gameStore.setPhase('VOTING')}
              className="bg-yellow-500/10 border border-yellow-500/50 text-yellow-400 px-4 sm:px-6 py-3 rounded-lg text-sm font-bold uppercase tracking-tight hover:bg-yellow-500/20 transition-colors flex flex-1 justify-center items-center gap-2"
            >
              <Scale className="w-4 h-4" /> Start Voting
            </button>
            <button
              onClick={() => gameStore.setPhase('ELECTION')}
              className="bg-primary/10 border border-primary/50 text-primary px-4 sm:px-6 py-3 rounded-lg text-sm font-bold uppercase tracking-tight hover:bg-primary/20 transition-colors flex flex-1 justify-center items-center gap-2"
            >
              <Crown className="w-4 h-4" /> Mayor Election
            </button>
          </div>

          <button
            onClick={() => {
              if (window.confirm('Return to settings? This will restart the current match but keep the players.')) {
                gameStore.resetGame();
                router.push('/setup');
              }
            }}
            className="border border-destructive/30 text-destructive px-6 py-3 rounded-lg font-bold uppercase tracking-tight hover:bg-destructive/10 transition-colors flex items-center gap-2"
          >
            <RotateCcw className="w-4 h-4" /> New Game
          </button>
        </div>

        {/* Game Log */}
        <GameLogPanel />
      </main>

      {/* VOTING & ELECTION PANEL OVERLAY */}
      {(status.phase === 'VOTING' || status.phase === 'ELECTION') && <VotingPanel />}

      {/* HUNTER REVENGE OVERLAY */}
      {status.phase === 'REVENGE' && status.pendingHunterId && (
        <div className="fixed inset-0 bg-background/95 backdrop-blur-sm z-50 flex items-center justify-center p-6 overflow-y-auto">
          <div className="bg-card w-full max-w-4xl border-2 border-orange-500/50 rounded-2xl p-8 shadow-2xl relative animate-in zoom-in-95 duration-300">
            <h2 className="text-3xl font-black mb-4 flex items-center justify-center gap-3 text-orange-400 uppercase italic">
              <Target className="w-10 h-10" /> Hunter's Last Stand
            </h2>
            <p className="text-muted-foreground text-center mb-10 font-bold uppercase tracking-widest text-sm">Target a player for revenge</p>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 mb-10">
              {players.filter(p => p.isAlive).map(p => (
                <button
                  key={p.id}
                  onClick={() => setHunterTarget(p.id)}
                  className={`p-6 border-2 rounded-2xl text-center transition-all ${
                    hunterTarget === p.id ? 'border-orange-500 bg-orange-500/10' : 'border-border hover:border-orange-500/50'
                  }`}
                >
                  <span className="font-black text-lg block">{p.name}</span>
                </button>
              ))}
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => {
                  gameStore.setPhase('DAY');
                  setHunterTarget(null);
                }}
                className="flex-1 py-4 border-2 border-border rounded-xl font-bold uppercase tracking-widest text-sm hover:bg-muted transition-colors"
              >
                Pass / Skip
              </button>
              <button
                disabled={!hunterTarget}
                onClick={handleHunterRevenge}
                className="flex-[2] py-4 bg-orange-600 text-white rounded-xl font-black uppercase tracking-widest text-lg hover:scale-[1.02] active:scale-95 disabled:opacity-30 disabled:pointer-events-none transition-all shadow-xl shadow-orange-900/40"
              >
                Execute Shot
              </button>
            </div>
          </div>
        </div>
      )}

      {/* GAME OVER OVERLAY */}
      {status.phase === 'GAMEOVER' && (
        <div className="fixed inset-0 bg-background/95 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="w-full max-w-2xl text-center bg-card border-2 border-primary/20 rounded-3xl p-8 sm:p-12 shadow-[0_0_100px_rgba(var(--primary),0.1)] animate-in zoom-in-95 duration-700">
            <div className="relative mb-8 flex justify-center">
               <Trophy className={`w-28 h-28 drop-shadow-[0_0_20px_rgba(234,179,8,0.5)] ${status.winner === 'WEREWOLVES' ? 'text-indigo-500' : 'text-yellow-400'}`} />
               <div className="absolute inset-0 animate-ping opacity-20 bg-primary/40 rounded-full blur-2xl scale-150" />
            </div>

            <h2 className={`text-5xl sm:text-7xl font-black mb-4 uppercase tracking-tighter italic ${status.winner === 'WEREWOLVES' ? 'text-indigo-400' : 'text-yellow-400'}`}>
              {status.winner === 'WEREWOLVES' ? 'Werewolves Win!' : 'Villagers Win!'}
            </h2>

            <p className="text-muted-foreground font-medium mb-10 max-w-md mx-auto">
              {status.winner === 'WEREWOLVES'
                ? "The village has been overrun by the pack. Darkness prevails."
                : "The pack has been hunted down. Peace returns to Vespera."}
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-10">
              <button
                onClick={() => {
                   gameStore.resetGame();
                   router.push('/setup');
                }}
                className="w-full sm:w-auto bg-primary text-primary-foreground px-10 py-4 rounded-xl text-lg font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-xl shadow-primary/25 flex items-center justify-center gap-2"
              >
                <Plus className="w-5 h-5" /> New Game
              </button>

              <button
                onClick={() => setShowLogs(!showLogs)}
                className={`w-full sm:w-auto px-10 py-4 rounded-xl text-lg font-black uppercase tracking-widest transition-all border-2 flex items-center justify-center gap-2 ${
                  showLogs
                    ? 'bg-muted border-border text-muted-foreground'
                    : 'bg-card border-primary/20 text-primary hover:bg-primary/5 hover:border-primary/50'
                }`}
              >
                <ChevronDown className={`w-5 h-5 transition-transform duration-500 ${showLogs ? 'rotate-180' : ''}`} />
                {showLogs ? 'Hide History' : 'View History'}
              </button>
            </div>

            {showLogs && (
              <div className="mt-6 border-2 border-border/40 rounded-2xl overflow-hidden bg-muted/20 animate-in slide-in-from-top-4 duration-500 max-h-[40vh] overflow-y-auto">
                <GameLogPanel />
              </div>
            )}
          </div>
        </div>
      )}
      {/* MORNING SUMMARY OVERLAY */}
      {showMorningSummary && (
        <div className="fixed inset-0 bg-background/95 backdrop-blur-md z-[110] flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-card border-2 border-indigo-500/20 rounded-3xl p-8 sm:p-12 shadow-2xl animate-in zoom-in-95 duration-500 text-center">
            <h2 className="text-4xl sm:text-5xl font-black mb-2 uppercase tracking-tighter italic text-indigo-400 flex justify-center items-center gap-3">
              <Sun className="w-10 h-10" /> Morning Summary
            </h2>
            <p className="text-muted-foreground font-medium mb-10">The sun rises on Day {status.dayCount}. Here is what happened last night:</p>
            
            <div className="space-y-4 mb-10 text-left">
              {logs.filter(l => l.dayCount === status.dayCount - 1 && l.type === 'NIGHT_DEATH').length === 0 ? (
                <div className="text-center p-6 border border-dashed border-border rounded-xl">
                  <Heart className="w-8 h-8 mx-auto mb-2 text-green-500 opacity-80" />
                  <p className="font-bold text-lg">Nobody died last night!</p>
                  <p className="text-muted-foreground text-sm">The village awakens safely.</p>
                </div>
              ) : (
                logs.filter(l => l.dayCount === status.dayCount - 1 && l.type === 'NIGHT_DEATH').map(log => {
                  const targetIds = log.involvedPlayerIds || [];
                  const targetPlayers = players.filter(p => targetIds.includes(p.id));
                  return (
                    <div key={log.id} className="p-4 border border-indigo-500/30 bg-indigo-500/5 rounded-xl flex items-start gap-4">
                      <Skull className="w-6 h-6 text-indigo-400 shrink-0 mt-1" />
                      <div>
                        <p className="font-bold text-lg mb-1">{log.message}</p>
                        {targetPlayers.map(p => (
                           <div key={p.id} className="flex items-center gap-2 text-sm text-indigo-300 font-bold bg-indigo-500/10 px-3 py-1.5 rounded w-fit mt-2">
                             {p.revealedRole === 'WEREWOLF' && <Zap className="w-4 h-4" />}
                             {p.revealedRole === 'SEER' && <Eye className="w-4 h-4" />}
                             {p.revealedRole === 'WITCH' && <Heart className="w-4 h-4" />}
                             {p.revealedRole === 'BODYGUARD' && <Shield className="w-4 h-4" />}
                             {p.revealedRole === 'HUNTER' && <Target className="w-4 h-4" />}
                             {p.revealedRole === 'MAYOR' && <Crown className="w-4 h-4" />}
                             {p.revealedRole === 'IDIOT' && <AlertTriangle className="w-4 h-4" />}
                             {p.revealedRole === 'ELDER' && <Flame className="w-4 h-4" />}
                             {(!p.revealedRole || p.revealedRole === 'VILLAGER') && <User className="w-4 h-4" />}
                             <span className="uppercase">{p.revealedRole ? p.revealedRole : 'Unknown Role'}</span>
                           </div>
                        ))}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <button
              onClick={() => setShowMorningSummary(false)}
              className="bg-indigo-500 text-white px-10 py-4 rounded-xl text-lg font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-xl shadow-indigo-500/25 w-full sm:w-auto"
            >
              Continue to Village
            </button>
          </div>
        </div>
      )}

      {/* DEATH REVEAL OVERLAY (Daytime / Revenge kills) */}
      {revealQueue.length > 0 && (
        <div className="fixed inset-0 bg-background/95 backdrop-blur-md z-[120] flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-card border-2 border-red-500/20 rounded-3xl p-8 shadow-2xl animate-in zoom-in-95 duration-500 text-center">
            <h2 className="text-3xl font-black mb-1 uppercase tracking-tighter italic text-red-500 flex justify-center items-center gap-3">
              <Skull className="w-8 h-8" /> Identity Revealed
            </h2>
            <p className="text-muted-foreground font-medium mb-8">The village witnesses the true nature of the deceased.</p>
            
            <div className="space-y-4 mb-8 text-left">
              {revealQueue.map(p => (
                <div key={p.id} className="p-5 border border-red-500/30 bg-red-500/5 rounded-xl flex items-center justify-between">
                  <span className="font-black text-xl">{p.name}</span>
                  <div className="flex items-center gap-2 px-3 py-2 bg-red-500/10 text-red-400 rounded-lg font-bold text-sm">
                    {p.revealedRole === 'WEREWOLF' && <Zap className="w-4 h-4" />}
                    {p.revealedRole === 'SEER' && <Eye className="w-4 h-4" />}
                    {p.revealedRole === 'WITCH' && <Heart className="w-4 h-4" />}
                    {p.revealedRole === 'BODYGUARD' && <Shield className="w-4 h-4" />}
                    {p.revealedRole === 'HUNTER' && <Target className="w-4 h-4" />}
                    {p.revealedRole === 'MAYOR' && <Crown className="w-4 h-4" />}
                    {p.revealedRole === 'IDIOT' && <AlertTriangle className="w-4 h-4" />}
                    {p.revealedRole === 'ELDER' && <Flame className="w-4 h-4" />}
                    {(!p.revealedRole || p.revealedRole === 'VILLAGER') && <User className="w-4 h-4" />}
                    <span className="uppercase">{p.revealedRole ? p.revealedRole : 'Unknown Role'}</span>
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={() => gameStore.clearRevealQueue()}
              className="bg-red-500 text-white px-10 py-4 rounded-xl text-lg font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-xl shadow-red-500/25 w-full sm:w-auto"
            >
              Continue
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function PlayerCard({ player }: { player: Player }) {
  const status = useStream(gameStore.gameStatus);
  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'WEREWOLF': return <Zap className="w-4 h-4 text-red-500" />;
      case 'SEER': return <Eye className="w-4 h-4 text-purple-400" />;
      case 'WITCH': return <Heart className="w-4 h-4 text-green-400" />;
      case 'BODYGUARD': return <Shield className="w-4 h-4 text-blue-400" />;
      case 'HUNTER': return <Target className="w-4 h-4 text-orange-400" />;
      case 'MAYOR': return <Crown className="w-4 h-4 text-yellow-400" />;
      case 'IDIOT': return <AlertTriangle className="w-4 h-4 text-pink-400" />;
      case 'ELDER': return <Flame className="w-4 h-4 text-amber-400" />;
      default: return <User className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const isExposed = player.status === 'Exposed';
  const displayRole = player.isAlive ? player.role : (player.revealedRole || player.role);
  const isRevealed = !player.isAlive && player.revealedRole !== undefined;

  return (
    <div
      className={`relative group p-4 rounded-xl border-2 transition-all duration-300 ${
        !player.isAlive
          ? 'bg-muted/30 border-transparent opacity-60 grayscale'
          : isExposed
          ? 'bg-pink-500/5 border-pink-500/30 hover:border-pink-500/60'
          : 'bg-card border-border hover:border-primary'
      }`}
    >
      {/* KILL/REVIVE TRIGGER */}
      <button
        onClick={() => player.isAlive ? gameStore.eliminatePlayer(player.id) : gameStore.revivePlayer(player.id)}
        className={`absolute top-2 right-2 p-1.5 rounded-full transition-colors z-10 ${
          player.isAlive
            ? 'bg-destructive/10 text-destructive hover:bg-destructive hover:text-white'
            : 'bg-primary/20 text-primary hover:bg-primary hover:text-black'
        }`}
        title={player.isAlive ? 'Kill Player' : 'Revive Player'}
      >
        {player.isAlive ? <Skull className="w-4 h-4" /> : <Heart className="w-4 h-4" />}
      </button>

      {/* MAYOR TRIGGER */}
      {player.isAlive && (
        <button
          onClick={() => gameStore.toggleMayor(player.id)}
          className={`absolute top-2 right-10 p-1.5 rounded-full transition-colors z-10 ${
            player.isMayor
              ? 'bg-yellow-400 text-black hover:bg-yellow-500'
              : 'bg-muted text-muted-foreground hover:bg-yellow-400/20 hover:text-yellow-400'
          }`}
          title={player.isMayor ? 'Unassign Mayor' : 'Assign Mayor'}
        >
          <Crown className="w-4 h-4" />
        </button>
      )}

      <h3 className="text-base sm:text-lg font-black leading-tight mb-1 pr-16 truncate">{player.name}</h3>

      <div className="flex items-center gap-1.5 mt-2">
        {getRoleIcon(displayRole)}
        <span className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
          {isExposed && player.isAlive ? 'Idiot (Exposed)' : displayRole} 
          {isRevealed && ' (Revealed)'}
        </span>
      </div>

      {/* Status badges */}
      <div className="flex gap-1.5 mt-2 flex-wrap">
        {isExposed && player.isAlive && (
           <span className="text-[9px] font-black uppercase tracking-widest text-pink-400 bg-pink-500/10 px-1.5 py-0.5 rounded">
             Exposed · 0 votes
           </span>
        )}
        {player.isMayor && player.isAlive && (
           <span className="text-[10px] font-black uppercase tracking-widest text-yellow-400 bg-yellow-400/10 px-1.5 py-0.5 rounded flex items-center gap-1">
             <Crown className="w-3 h-3" /> Mayor (×2)
           </span>
        )}
        {player.role === 'ELDER' && player.isAlive && (
          <span className={`text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded flex items-center gap-1 ${
            status.elderShieldCracked
              ? 'text-amber-400 bg-amber-500/10'
              : 'text-blue-400 bg-blue-500/10'
          }`}>
            {status.elderShieldCracked
              ? <><ShieldOff className="w-2.5 h-2.5" /> Shield Cracked</>
              : <><Shield className="w-2.5 h-2.5" /> Shield Intact</>}
          </span>
        )}
      </div>

      {!player.isAlive && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="rotate-12 border-4 border-destructive text-destructive px-2 py-1 font-black text-2xl uppercase tracking-tighter opacity-40">
            ELIMINATED
          </div>
        </div>
      )}
    </div>
  );
}
