'use client';

import { useState, useRef, useEffect } from 'react';
import { useStream } from '@/logic/antigravity/stream';
import { gameStore } from '@/logic/game-store';
import { Player, NightAction } from '@/types';
import { Check, ArrowRight, Zap, Eye, Shield, ShieldOff, Heart, Skull, Flame, Play, BarChart2, ChevronLeft, CheckCircle, UserPlus, XCircle } from 'lucide-react';

type Step = 'BODYGUARD' | 'SEER' | 'WEREWOLVES' | 'WITCH' | 'SUMMARY';

export function NightEngineWizard() {
  const [currentStep, setCurrentStep] = useState<Step>('BODYGUARD');
  const [seerResult, setSeerResult] = useState<{ id: string, role: string } | null>(null);
  
  const players = useStream(gameStore.playerList);
  const status = useStream(gameStore.gameStatus);

  const [draftActions, setDraftActions] = useState<Omit<NightAction, 'id' | 'resolved'>[]>([]);
  const [draftWitchState, setDraftWitchState] = useState(status.witchState);

  if (status.phase !== 'NIGHT') {
    return null;
  }

  const alivePlayers = players.filter(p => p.isAlive);
  
  const isBodyguardAlive = players.some(p => p.role === 'BODYGUARD' && p.isAlive);
  const isSeerAlive = players.some(p => p.role === 'SEER' && p.isAlive);
  const areWerewolvesAlive = players.some(p => p.role === 'WEREWOLF' && p.isAlive);
  const isWitchAlive = players.some(p => p.role === 'WITCH' && p.isAlive);

  // Helpers to check state
  const hasBodyguardActioned = draftActions.some(a => a.type === 'BODYGUARD_PROTECT');
  const bodyguardTarget = draftActions.find(a => a.type === 'BODYGUARD_PROTECT')?.targetId;
  const hasWerewolfActioned = draftActions.some(a => a.type === 'WEREWOLF_KILL');
  
  const werewolfKills = draftActions.filter(a => a.type === 'WEREWOLF_KILL').map(a => a.targetId);
  const victimName = werewolfKills.length > 0 
    ? players.find(p => p.id === werewolfKills[0])?.name 
    : null;

  const handleBodyguardProtect = (playerId: string) => {
    setDraftActions(prev => {
      if (prev.find(a => a.type === 'BODYGUARD_PROTECT')?.targetId === playerId) {
        return prev.filter(a => a.type !== 'BODYGUARD_PROTECT'); 
      }
      return [...prev.filter(a => a.type !== 'BODYGUARD_PROTECT'), { actorId: 'bodyguard', targetId: playerId, type: 'BODYGUARD_PROTECT' }];
    });
  };

  const handleSeerInspect = (player: Player) => {
    if (seerResult?.id === player.id) setSeerResult(null);
    else setSeerResult({ id: player.id, role: player.role });
  };

  const handleWerewolfKill = (playerId: string) => {
    setDraftActions(prev => {
      if (prev.find(a => a.type === 'WEREWOLF_KILL')?.targetId === playerId) {
        return prev.filter(a => a.type !== 'WEREWOLF_KILL');
      }
      return [...prev.filter(a => a.type !== 'WEREWOLF_KILL'), { actorId: 'werewolves', targetId: playerId, type: 'WEREWOLF_KILL' }];
    });
  };

  const handleWitchSave = () => {
    setDraftActions(prev => {
      const isSaving = prev.some(a => a.type === 'WITCH_SAVE');
      if (isSaving) {
        setDraftWitchState(s => ({ ...s, hasHeal: true }));
        return prev.filter(a => a.type !== 'WITCH_SAVE');
      } else {
        setDraftWitchState(s => ({ ...s, hasHeal: false }));
        const newActions = [...prev];
        werewolfKills.forEach(vid => {
          newActions.push({ actorId: 'witch', targetId: vid, type: 'WITCH_SAVE' });
        });
        return newActions;
      }
    });
  };

  const handleWitchPoison = (playerId: string) => {
    setDraftActions(prev => {
      const existing = prev.find(a => a.type === 'WITCH_KILL');
      if (existing?.targetId === playerId) {
        setDraftWitchState(s => ({ ...s, hasPoison: true }));
        return prev.filter(a => a.type !== 'WITCH_KILL');
      } else {
        setDraftWitchState(s => ({ ...s, hasPoison: false }));
        return [...prev.filter(a => a.type !== 'WITCH_KILL'), { actorId: 'witch', targetId: playerId, type: 'WITCH_KILL' }];
      }
    });
  };

  const finishNight = () => {
    gameStore.gameStatus.update(s => ({ ...s, witchState: draftWitchState }));
    draftActions.forEach(a => gameStore.addNightAction(a));
    gameStore.resolveNight();
    setCurrentStep('BODYGUARD');
    setSeerResult(null);
    setDraftActions([]);
  };

  const cancelNight = () => {
    gameStore.setPhase('DAY');
    setCurrentStep('BODYGUARD');
    setSeerResult(null);
    setDraftActions([]);
    setDraftWitchState(status.witchState);
  };

  return (
    <div className="bg-card border-2 border-primary/20 rounded-2xl p-8 shadow-2xl">
      <div className="flex gap-2 mb-8 overflow-x-auto pb-4">
        <StepIndicator label="Bodyguard" active={currentStep === 'BODYGUARD'} done={draftActions.some(a => a.type === 'BODYGUARD_PROTECT')} />
        <StepIndicator label="Seer" active={currentStep === 'SEER'} done={!!seerResult} />
        <StepIndicator label="Werewolves" active={currentStep === 'WEREWOLVES'} done={hasWerewolfActioned} />
        <StepIndicator label="Witch" active={currentStep === 'WITCH'} done={draftActions.some(a => a.type === 'WITCH_SAVE' || a.type === 'WITCH_KILL')} />
        <StepIndicator label="Summary" active={currentStep === 'SUMMARY'} done={false} />
      </div>

      <div className="min-h-[300px]">
                  {/* BODYGUARD STEP */}
        {currentStep === 'BODYGUARD' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h2 className="text-2xl font-black mb-2 flex items-center gap-2 text-blue-400">
              <Shield className="w-6 h-6" /> BODYGUARD AWAKES
            </h2>
            {!isBodyguardAlive ? (
              <div className="py-8 text-center text-muted-foreground border border-dashed border-border rounded-xl mb-6">
                <Skull className="w-12 h-12 mx-auto mb-4 opacity-20" />
                <p className="text-xl font-bold uppercase tracking-widest text-destructive/50">Bodyguard is Eliminated</p>
                <p className="text-sm mt-2">Wait a few seconds to preserve the mystery before continuing.</p>
              </div>
            ) : status.villageCursed ? (
              <div className="py-8 text-center border border-dashed border-amber-500/30 rounded-xl mb-6">
                <Flame className="w-12 h-12 mx-auto mb-4 text-amber-500/40" />
                <p className="text-xl font-bold uppercase tracking-widest text-amber-500/60">Village Curse Active</p>
                <p className="text-sm mt-2 text-muted-foreground">The Bodyguard's power has been suppressed.</p>
              </div>
            ) : (
              <>
                <p className="text-muted-foreground mb-6">Who will the Bodyguard protect tonight? (Cannot protect the same player twice in a row)</p>
                
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
                  {alivePlayers.map(player => {
                    const isBlocked = status.lastProtectedId === player.id;
                    const isSelected = bodyguardTarget === player.id;
                    return (
                      <button 
                        key={player.id}
                        disabled={isBlocked}
                        className={`p-3 text-left border rounded-lg transition-all font-bold ${
                          isBlocked ? 'opacity-30 border-dashed border-red-500 cursor-not-allowed' :
                          isSelected ? 'bg-blue-500/20 border-blue-500 text-blue-400' :
                          'border-border hover:bg-blue-500/10 hover:border-blue-500'
                        }`}
                        onClick={() => handleBodyguardProtect(player.id)}
                      >
                        {player.name} {isBlocked && <span className="text-[10px] text-destructive ml-2 uppercase">Blocked</span>}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
            
            <ActionControls 
              onSkip={() => setCurrentStep('SEER')} 
              onNext={() => setCurrentStep('SEER')} 
            />
          </div>
        )}

                {/* SEER STEP */}
        {currentStep === 'SEER' && (
          <div className="animate-in fade-in slide-in-from-right-4 duration-500">
            <h2 className="text-2xl font-black mb-2 flex items-center gap-2 text-purple-400">
              <Eye className="w-6 h-6" /> SEER AWAKES
            </h2>
            {!isSeerAlive ? (
              <div className="py-8 text-center text-muted-foreground border border-dashed border-border rounded-xl mb-6">
                <Skull className="w-12 h-12 mx-auto mb-4 opacity-20" />
                <p className="text-xl font-bold uppercase tracking-widest text-destructive/50">Seer is Eliminated</p>
                <p className="text-sm mt-2">Wait a few seconds to preserve the mystery before continuing.</p>
              </div>
            ) : status.villageCursed ? (
              <div className="py-8 text-center border border-dashed border-amber-500/30 rounded-xl mb-6">
                <Flame className="w-12 h-12 mx-auto mb-4 text-amber-500/40" />
                <p className="text-xl font-bold uppercase tracking-widest text-amber-500/60">Village Curse Active</p>
                <p className="text-sm mt-2 text-muted-foreground">The Seer's vision has been clouded by the curse.</p>
              </div>
            ) : (
              <>
                <p className="text-muted-foreground mb-6">Choose a player to reveal their true role.</p>
                
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
                  {alivePlayers.map(player => {
                    const isSelected = seerResult?.id === player.id;
                    return (
                      <button 
                        key={player.id}
                        className={`p-3 text-left border rounded-lg transition-all font-bold ${
                          isSelected ? 'bg-purple-500/20 border-purple-500 text-purple-400' :
                          'border-border hover:bg-purple-500/10 hover:border-purple-500'
                        }`}
                        onClick={() => handleSeerInspect(player)}
                      >
                        {player.name}
                      </button>
                    );
                  })}
                </div>
                {seerResult && (
                  <div className="p-6 border border-purple-500/30 bg-purple-500/5 rounded-xl text-center mb-6">
                    <p className="text-muted-foreground uppercase text-sm font-bold tracking-widest mb-2">Player Alignment Revealed</p>
                    <p className="text-3xl font-black text-purple-400 mb-6">
                      {seerResult.role === 'WEREWOLF' ? 'WEREWOLF' : 'HUMAN'}
                    </p>
                  </div>
                )}
              </>
            )}

            <ActionControls 
              onSkip={() => setCurrentStep('WEREWOLVES')} 
              onNext={() => setCurrentStep('WEREWOLVES')} 
            />
          </div>
        )}

                {/* WEREWOLVES STEP */}
        {currentStep === 'WEREWOLVES' && (
          <div className="animate-in fade-in slide-in-from-right-4 duration-500">
            <h2 className="text-2xl font-black mb-2 flex items-center gap-2 text-destructive">
              <Zap className="w-6 h-6" /> WEREWOLVES AWAKE
            </h2>
            {!areWerewolvesAlive ? (
              <div className="py-8 text-center text-muted-foreground border border-dashed border-border rounded-xl mb-6">
                <Skull className="w-12 h-12 mx-auto mb-4 opacity-20" />
                <p className="text-xl font-bold uppercase tracking-widest text-destructive/50">Werewolves are Eliminated</p>
                <p className="text-sm mt-2">Wait a few seconds to preserve the mystery before continuing.</p>
              </div>
            ) : (
              <>
                <p className="text-muted-foreground mb-6">Who do the werewolves want to eliminate tonight?</p>
                
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
                  {alivePlayers.map(player => {
                    const isSelected = werewolfKills.includes(player.id);
                    const isElder = player.role === 'ELDER';
                    return (
                      <button 
                        key={player.id}
                        className={`p-3 text-left border rounded-lg transition-all font-bold ${
                          isSelected ? 'bg-destructive/20 border-destructive text-destructive' :
                          'border-border hover:bg-destructive/10 hover:border-destructive'
                        }`}
                        onClick={() => handleWerewolfKill(player.id)}
                      >
                        <span>{player.name}</span>
                        {isElder && (
                          <span className={`ml-2 text-[9px] font-black uppercase tracking-widest inline-flex items-center gap-0.5 ${
                            status.elderShieldCracked ? 'text-amber-400' : 'text-blue-400'
                          }`}>
                            {status.elderShieldCracked
                              ? <><ShieldOff className="w-2.5 h-2.5" />Cracked</>
                              : <><Shield className="w-2.5 h-2.5" />Shield</>}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            <ActionControls 
              onSkip={() => setCurrentStep('WITCH')} 
              onNext={() => setCurrentStep('WITCH')} 
            />
          </div>
        )}

                {/* WITCH STEP */}
        {currentStep === 'WITCH' && (
          <div className="animate-in fade-in slide-in-from-right-4 duration-500">
            <h2 className="text-2xl font-black mb-2 flex items-center gap-2 text-green-400">
              <Heart className="w-6 h-6" /> WITCH AWAKES
            </h2>
            
            {!isWitchAlive ? (
              <div className="py-8 text-center text-muted-foreground border border-dashed border-border rounded-xl mb-6">
                <Skull className="w-12 h-12 mx-auto mb-4 opacity-20" />
                <p className="text-xl font-bold uppercase tracking-widest text-destructive/50">Witch is Eliminated</p>
                <p className="text-sm mt-2">Wait a few seconds to preserve the mystery before continuing.</p>
              </div>
            ) : status.villageCursed ? (
              <div className="py-8 text-center border border-dashed border-amber-500/30 rounded-xl mb-6">
                <Flame className="w-12 h-12 mx-auto mb-4 text-amber-500/40" />
                <p className="text-xl font-bold uppercase tracking-widest text-amber-500/60">Village Curse Active</p>
                <p className="text-sm mt-2 text-muted-foreground">The Witch's potions have been rendered inert by the curse.</p>
              </div>
            ) : (
              <>
                <div className="mb-8 p-4 bg-muted/30 rounded-lg border border-border">
                  <p className="text-muted-foreground uppercase text-xs font-bold tracking-widest mb-1">Werewolves Attacked</p>
                  <p className="text-xl font-black text-foreground">
                    {victimName || 'Nobody'}
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  <div className="p-4 border border-green-500/20 rounded-xl">
                    <h3 className="font-bold mb-4 flex items-center gap-2"><Heart className="w-4 h-4 text-green-500"/> Healing Potion</h3>
                    {status.witchState.hasHeal ? (
                       <button 
                         disabled={!victimName}
                         onClick={handleWitchSave}
                         className={`w-full py-3 font-bold uppercase rounded-lg transition-colors disabled:opacity-30 disabled:pointer-events-none ${
                           draftActions.some(a => a.type === 'WITCH_SAVE') 
                             ? 'bg-green-500 text-black shadow-[0_0_15px_rgba(34,197,94,0.5)]' 
                             : 'bg-green-500/10 text-green-500 hover:bg-green-500/20'
                         }`}
                       >
                         Save {victimName}
                       </button>
                    ) : (
                       <p className="text-muted-foreground text-sm font-bold uppercase">Potion Used</p>
                    )}
                  </div>
                  
                  <div className="p-4 border border-purple-500/20 rounded-xl">
                    <h3 className="font-bold mb-4 flex items-center gap-2"><Skull className="w-4 h-4 text-purple-500"/> Poison Potion</h3>
                    {status.witchState.hasPoison ? (
                       <div className="space-y-2 max-h-40 overflow-y-auto pr-2">
                         {alivePlayers.filter(p => !werewolfKills.includes(p.id)).map(player => {
                            const isPoisoned = draftActions.find(a => a.type === 'WITCH_KILL')?.targetId === player.id;
                            return (
                               <button 
                                 key={player.id}
                                 onClick={() => handleWitchPoison(player.id)}
                                 className={`w-full text-left p-2 border rounded text-sm font-bold transition-colors ${
                                   isPoisoned ? 'bg-purple-500 border-purple-500 text-black' : 'border-border hover:border-purple-500 hover:bg-purple-500/10'
                                 }`}
                               >
                                 Poison {player.name}
                               </button>
                            );
                         })}
                       </div>
                    ) : (
                       <p className="text-muted-foreground text-sm font-bold uppercase">Potion Used</p>
                    )}
                  </div>
                </div>
              </>
            )}

            <ActionControls 
              onSkip={() => setCurrentStep('SUMMARY')} 
              onNext={() => setCurrentStep('SUMMARY')} 
            />
          </div>
        )}

        {/* SUMMARY STEP */}
        {currentStep === 'SUMMARY' && (
          <div className="animate-in fade-in slide-in-from-right-4 duration-500 text-center py-12">
            <h2 className="text-3xl font-black mb-4">Night Phase Complete</h2>
            <p className="text-muted-foreground mb-8">All actions have been recorded. It's time to wake the village.</p>
            
            <button 
              onClick={finishNight}
              className="bg-primary text-primary-foreground px-8 py-4 rounded-xl font-black uppercase tracking-tighter hover:opacity-90 flex items-center gap-3 mx-auto text-lg hover:scale-105 transition-transform"
            >
              <Play className="w-5 h-5" /> Resolve Night & Wake Village
            </button>
          </div>
        )}
      </div>

      {currentStep !== 'SUMMARY' && (
        <div className="mt-8 pt-6 border-t border-border flex justify-start">
          <button 
             onClick={cancelNight}
             className="text-muted-foreground text-sm font-bold uppercase hover:text-destructive transition-colors"
          >
            Cancel Night Phase
          </button>
        </div>
      )}
    </div>
  );
}

function StepIndicator({ label, active, done }: { label: string, active: boolean, done: boolean }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (active && ref.current) {
      ref.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'center',
      });
    }
  }, [active]);

  return (
    <div ref={ref} className={`flex items-center gap-2 whitespace-nowrap px-4 py-2 rounded-full border shrink-0 transition-all duration-300 ${
      active ? 'bg-primary/10 border-primary text-primary' 
      : done ? 'bg-muted/50 border-border text-foreground'
      : 'border-transparent text-muted-foreground'
    }`}>
      {done ? (
        <Check className="w-3 h-3 text-green-500" />
      ) : (
        <div className={`w-2 h-2 rounded-full ${active ? 'bg-primary animate-pulse' : 'bg-muted'}`} />
      )}
      <span className={`text-xs font-black uppercase tracking-widest ${done ? 'opacity-80' : ''}`}>{label}</span>
    </div>
  );
}

function ActionControls({ onSkip, onNext }: { onSkip: () => void, onNext: () => void }) {
  return (
    <div className="mt-8 flex justify-end gap-3">
      <button 
        onClick={onSkip}
        className="px-6 py-2 border border-border rounded font-bold uppercase tracking-tight text-sm hover:bg-muted transition-colors"
      >
        Skip Role
      </button>
      <button 
        onClick={onNext}
        className="bg-primary text-primary-foreground px-6 py-2 rounded font-bold uppercase tracking-tight text-sm hover:opacity-90 flex items-center gap-2 group"
      >
        Next Step <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
      </button>
    </div>
  );
}
