'use client';

import { useState, useMemo } from 'react';
import { useStream } from '@/logic/antigravity/stream';
import { gameStore } from '@/logic/game-store';
import { Player, TieBreakRule } from '@/types';
import {
  Scale,
  Skull,
  AlertTriangle,
  CheckCircle,
  ChevronRight,
  ChevronLeft,
  Swords,
  Minus,
  BarChart2,
  XCircle,
  Crown,
  UserPlus,
} from 'lucide-react';

/** How many votes this player contributes when CASTING a vote */
function getVoterWeight(player: Player, isElection: boolean): number {
  if (isElection) return 1;
  if (player.status === 'Exposed') return 0;
  if (player.isMayor) return 2;
  return 1;
}

export function VotingPanel() {
  const players = useStream(gameStore.playerList);
  const status = useStream(gameStore.gameStatus);

  const phase = status.phase;
  const isElection = phase === 'ELECTION';

  const alivePlayers = players.filter(p => p.isAlive);
  const tieBreakRule: TieBreakRule = status.tieBreakRule;

  // Draft: voterId -> targetId | 'PASS'
  const [votes, setVotes] = useState<Record<string, string | 'PASS'>>({});
  const [voterIndex, setVoterIndex] = useState(0);
  const [showResults, setShowResults] = useState(false);

  const currentVoter = alivePlayers[voterIndex];

  // Tally effective votes per target
  const tally = useMemo(() => {
    const result: Record<string, number> = {};
    alivePlayers.forEach(p => { result[p.id] = 0; });

    Object.entries(votes).forEach(([voterId, targetId]) => {
      if (targetId === 'PASS') return;
      const voter = players.find(p => p.id === voterId);
      if (!voter) return;
      result[targetId] = (result[targetId] ?? 0) + getVoterWeight(voter, isElection);
    });

    return result;
  }, [votes, alivePlayers, players]);

  const maxVotes = Math.max(0, ...Object.values(tally));
  const targets = maxVotes > 0
    ? alivePlayers.filter(p => tally[p.id] === maxVotes)
    : [];
  const isTie = targets.length > 1;
  const totalCast = Object.keys(votes).length;

  const castVote = (targetId: string | 'PASS') => {
    setVotes(prev => ({ ...prev, [currentVoter.id]: targetId }));
    // Auto-advance to next voter
    if (voterIndex < alivePlayers.length - 1) {
      setVoterIndex(i => i + 1);
    } else {
      setShowResults(true);
    }
  };

  const goBack = () => {
    if (showResults) {
      setShowResults(false);
      return;
    }
    const prevIndex = voterIndex - 1;
    if (prevIndex < 0) return;
    const prevVoter = alivePlayers[prevIndex];
    setVotes(prev => {
      const next = { ...prev };
      delete next[prevVoter.id];
      return next;
    });
    setVoterIndex(prevIndex);
  };

  const handleConfirm = () => {
    if (maxVotes === 0) {
      gameStore.setPhase('DAY');
      return;
    }

    if (isElection) {
      // In election, pick the first one if tie, or let moderator decide later
      gameStore.assignMayor(targets[0].id);
      return;
    }

    if (isTie) {
      if (tieBreakRule === 'NO_EXECUTION') {
        gameStore.setPhase('DAY');
        return;
      }
      targets.forEach(t => gameStore.voteExecution(t.id));
    } else {
      gameStore.voteExecution(targets[0].id);
    }

    const nextPhase = gameStore.gameStatus.value.phase;
    if (nextPhase !== 'REVENGE' && nextPhase !== 'GAMEOVER') {
      gameStore.setPhase('DAY');
    }
  };

  // ── Results Screen ──────────────────────────────────────────────────────
  if (showResults) {
    return (
      <div className="fixed inset-0 bg-background/95 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
        <div className={`bg-card w-full max-w-2xl border-2 rounded-2xl p-6 sm:p-8 shadow-2xl animate-in zoom-in-95 duration-300 ${isElection ? 'border-primary/40' : 'border-yellow-500/40'}`}>

          <div className="text-center mb-6">
            <h2 className={`text-3xl font-black uppercase tracking-tighter flex items-center justify-center gap-3 ${isElection ? 'text-primary' : 'text-yellow-400'}`}>
              <BarChart2 className="w-8 h-8" /> {isElection ? 'Election Results' : 'Voting Results'}
            </h2>
            <p className="text-muted-foreground text-sm mt-1">{totalCast} of {alivePlayers.length} players voted</p>
          </div>

          <div className="space-y-2 mb-6">
            {[...alivePlayers]
              .sort((a, b) => (tally[b.id] ?? 0) - (tally[a.id] ?? 0))
              .map(p => {
                const votes_ = tally[p.id] ?? 0;
                const isLeader = votes_ === maxVotes && maxVotes > 0;
                const pct = maxVotes > 0 ? (votes_ / maxVotes) * 100 : 0;
                const isExposed = p.status === 'Exposed';

                return (
                  <div key={p.id} className={`p-3 rounded-xl border-2 transition-all ${isLeader ? (isElection ? 'border-primary bg-primary/10' : 'border-yellow-500 bg-yellow-500/10') : 'border-border bg-card'}`}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        {isLeader && (isElection ? <Crown className="w-4 h-4 text-primary" /> : <Skull className="w-4 h-4 text-yellow-500" />)}
                        <span className="font-black text-sm">{p.name}</span>
                        {isExposed && <span className="text-[10px] uppercase font-bold text-pink-400 bg-pink-500/10 px-1.5 rounded">Exposed</span>}
                        {p.isMayor && !isElection && <Crown className="w-3.5 h-3.5 text-yellow-400" />}
                      </div>
                      <span className={`text-xl font-black ${isLeader ? (isElection ? 'text-primary' : 'text-yellow-400') : 'text-muted-foreground'}`}>
                        {votes_}
                      </span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${isLeader ? (isElection ? 'bg-primary' : 'bg-yellow-500') : 'bg-muted-foreground/40'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
          </div>

          {isTie && maxVotes > 0 && (
            <div className={`mb-5 p-3 rounded-xl border text-sm font-bold text-center ${
              isElection ? 'border-primary/50 bg-primary/10 text-primary' :
              tieBreakRule === 'DOUBLE_EXECUTION'
                ? 'border-red-500/50 bg-red-500/10 text-red-400'
                : 'border-yellow-500/50 bg-yellow-500/10 text-yellow-400'
            }`}>
              {isElection ? <><Scale className="w-4 h-4 inline mr-1.5" />TIE — Moderator decides winner from {targets.map(t => t.name).join(', ')}</> :
              tieBreakRule === 'DOUBLE_EXECUTION'
                ? <><Swords className="w-4 h-4 inline mr-1.5" />TIE — {targets.map(t => t.name).join(' & ')} both face execution</>
                : <><AlertTriangle className="w-4 h-4 inline mr-1.5" />TIE — {targets.map(t => t.name).join(' & ')} · No execution</>
              }
            </div>
          )}

          {!isElection && (
            <div className="flex items-center justify-center mb-5 gap-3">
              <span className="text-xs uppercase tracking-widest text-muted-foreground font-bold">Tie Rule:</span>
              <div className="flex rounded-lg overflow-hidden border border-border text-xs font-bold uppercase tracking-wide">
                <button
                  onClick={() => gameStore.setTieBreakRule('NO_EXECUTION')}
                  className={`px-4 py-2 transition-colors ${tieBreakRule === 'NO_EXECUTION' ? 'bg-yellow-500/20 text-yellow-400' : 'hover:bg-muted text-muted-foreground'}`}
                >
                  No Execution
                </button>
                <button
                  onClick={() => gameStore.setTieBreakRule('DOUBLE_EXECUTION')}
                  className={`px-4 py-2 transition-colors border-l border-border ${tieBreakRule === 'DOUBLE_EXECUTION' ? 'bg-red-500/20 text-red-400' : 'hover:bg-muted text-muted-foreground'}`}
                >
                  <Swords className="w-3 h-3 inline -mt-0.5 mr-1" />Double Execution
                </button>
              </div>
            </div>
          )}

          <div className="flex gap-3 border-t border-border pt-5">
            <button
              onClick={goBack}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg border border-border font-bold uppercase tracking-wider text-xs hover:bg-muted transition-colors"
            >
              <ChevronLeft className="w-4 h-4" /> Back
            </button>
            <button
              onClick={() => { gameStore.setPhase('DAY'); }}
              className="px-5 py-2.5 rounded-lg border border-border font-bold uppercase tracking-wider text-xs text-muted-foreground hover:bg-muted transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={maxVotes === 0}
              className={`ml-auto px-7 py-2.5 rounded-xl font-black uppercase tracking-widest text-sm hover:opacity-90 hover:scale-105 disabled:opacity-30 disabled:pointer-events-none transition-all flex items-center gap-2 ${
                isElection ? 'bg-primary text-primary-foreground' : 'bg-yellow-500 text-black'
              }`}
            >
              {isElection ? <UserPlus className="w-5 h-5" /> : <CheckCircle className="w-5 h-5" />}
              {isElection ? 'Elect Mayor'
                : isTie && tieBreakRule === 'NO_EXECUTION' ? 'Confirm No Execution'
                : isTie ? 'Confirm Double Execution'
                : 'Confirm Execution'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Voter Wizard ──────────────────────────────────────────────────────────
  const voterWeight = currentVoter ? getVoterWeight(currentVoter, isElection) : 1;
  const isWeightless = !isElection && voterWeight === 0;
  const isMayor = !isElection && currentVoter?.isMayor;
  const candidates = players.filter(p => p.isAlive && p.id !== currentVoter.id);

  return (
    <div className="fixed inset-0 bg-background/95 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className={`bg-card w-full max-w-2xl border-2 rounded-2xl p-6 sm:p-8 shadow-2xl animate-in zoom-in-95 duration-300 ${isElection ? 'border-primary/40' : 'border-yellow-500/40'}`}>

        <div className="flex items-center justify-between mb-5">
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">
            Voter {voterIndex + 1} of {alivePlayers.length}
          </span>
          <div className="flex gap-1">
            {alivePlayers.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i < voterIndex ? (isElection ? 'w-4 bg-primary' : 'w-4 bg-yellow-500') : i === voterIndex ? (isElection ? 'w-6 bg-primary/70' : 'w-6 bg-yellow-400') : 'w-4 bg-border'
                }`}
              />
            ))}
          </div>
        </div>

        <div className={`rounded-2xl border-2 p-5 mb-6 text-center ${
          isMayor ? (isElection ? 'border-primary/60 bg-primary/5' : 'border-yellow-500/60 bg-yellow-500/5') :
          isWeightless ? 'border-pink-500/40 bg-pink-500/5' :
          'border-border bg-muted/10'
        }`}>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-2">Now Voting</p>
          <div className="flex items-center justify-center gap-2 mb-1">
            {currentVoter?.isMayor && <Crown className="w-6 h-6 text-yellow-400" />}
            <h2 className="text-3xl font-black tracking-tight">{currentVoter?.name}</h2>
          </div>

          {isMayor && (
            <div className="mt-2 inline-flex items-center gap-1.5 bg-yellow-500/15 border border-yellow-500/30 rounded-full px-3 py-1 text-xs font-black uppercase tracking-widest text-yellow-400">
              <Crown className="w-3.5 h-3.5" /> Mayor — vote counts as 2
            </div>
          )}
          {isWeightless && (
            <div className="mt-2 inline-flex items-center gap-1.5 bg-pink-500/15 border border-pink-500/30 rounded-full px-3 py-1 text-xs font-black uppercase tracking-widest text-pink-400">
              <XCircle className="w-3.5 h-3.5" /> Exposed — vote counts as 0
            </div>
          )}
        </div>

        <p className="text-xs uppercase tracking-widest text-muted-foreground font-bold mb-3">
          {isElection ? 'Who are they electing as Mayor?' : 'Who are they voting to execute?'}
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
          {candidates.map(candidate => {
            return (
              <button
                key={candidate.id}
                onClick={() => castVote(candidate.id)}
                className={`group p-4 border-2 rounded-xl text-left transition-all active:scale-95 ${
                  isElection ? 'border-border hover:border-primary hover:bg-primary/10' : 'border-border hover:border-yellow-500 hover:bg-yellow-500/10'
                }`}
              >
                 <div className="flex items-center gap-1.5 mb-1">
                  {candidate.isMayor && <Crown className="w-3.5 h-3.5 text-yellow-400" />}
                  {candidate.status === 'Exposed' && <span className="text-[9px] font-bold text-pink-400">Exposed</span>}
                </div>
                <span className={`font-black block leading-tight transition-colors ${isElection ? 'group-hover:text-primary' : 'group-hover:text-yellow-400'}`}>
                  {candidate.name}
                </span>
                {!isElection && isMayor && (
                  <span className="text-[9px] text-yellow-500/80 font-bold uppercase tracking-wider mt-1 block">
                    +2 votes
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-3 border-t border-border pt-5">
          <button
            onClick={goBack}
            disabled={voterIndex === 0}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-border font-bold uppercase tracking-wider text-xs hover:bg-muted transition-colors disabled:opacity-30 disabled:pointer-events-none"
          >
            <ChevronLeft className="w-4 h-4" /> Back
          </button>

          <button
            onClick={() => castVote('PASS')}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-border font-bold uppercase tracking-wider text-xs text-muted-foreground hover:bg-muted transition-colors"
          >
            <Minus className="w-4 h-4" /> Pass
          </button>

          <button
            onClick={() => setShowResults(true)}
            className="ml-auto flex items-center gap-2 px-5 py-2.5 rounded-lg bg-muted font-bold uppercase tracking-wider text-xs hover:bg-muted/80 transition-colors"
          >
            Skip to Results <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
