'use client';

import { useMemo, useState, type CSSProperties } from 'react';
import { ArrowLeft, ArrowRight, Check, Eye, Heart, Moon, Shield, Skull, Sparkles, WandSparkles, X } from 'lucide-react';
import { gameStore } from '@/logic/game-store';
import { inspectAlignment } from '@/logic/rules';
import { emptyNightDraft, ROLE_CATALOG, type GameStatus, type NightDraft, type NightStep, type Player, type ResolutionEffect, type RoleType } from '@/types';
import { RoleIcon } from '@/features/ui/RoleIcon';
import { Dialog } from '@/features/ui/Dialog';

const roleByStep: Partial<Record<NightStep, RoleType>> = { CUPID: 'CUPID', BODYGUARD: 'BODYGUARD', SEER: 'SEER', WEREWOLVES: 'WEREWOLF', WITCH: 'WITCH' };

export function NightAssistant({ players, status }: { players: Player[]; status: GameStatus }) {
  const availableSteps = useMemo<NightStep[]>(() => {
    const ordered: NightStep[] = ['CUPID', 'BODYGUARD', 'SEER', 'WEREWOLVES', 'WITCH'];
    return [...ordered.filter((step) => {
      const role = roleByStep[step];
      return role && players.some((player) => player.role === role) && (step !== 'CUPID' || status.dayNumber === 1);
    }), 'REVIEW'];
  }, [players, status.dayNumber]);
  const [stepIndex, setStepIndex] = useState(0);
  const [draft, setDraft] = useState<NightDraft>(emptyNightDraft);
  const [skipped, setSkipped] = useState<Set<NightStep>>(new Set());
  const [confirmExit, setConfirmExit] = useState(false);
  const step = availableSteps[stepIndex];
  const preview = gameStore.previewNightResolution(draft);
  const hasDraft = Object.values(draft).some((value) => Array.isArray(value) ? value.length > 0 : value !== null);
  const leave = () => { setDraft(emptyNightDraft()); gameStore.cancelNightDraft(); };
  const advance = (skip = false) => {
    if (skip) {
      setSkipped((current) => new Set(current).add(step));
      setDraft((current) => step === 'CUPID' ? { ...current, cupidTargetIds: [] } : step === 'BODYGUARD' ? { ...current, bodyguardTargetId: null } : step === 'SEER' ? { ...current, seerTargetId: null } : step === 'WEREWOLVES' ? { ...current, werewolfTargetId: null, witchSaveTargetId: null } : step === 'WITCH' ? { ...current, witchSaveTargetId: null, witchPoisonTargetId: null } : current);
    }
    else setSkipped((current) => { const next = new Set(current); next.delete(step); return next; });
    setStepIndex((index) => Math.min(availableSteps.length - 1, index + 1));
  };

  return <div className="night-workspace enter-fade">
    <header className="night-header">
      <div className="night-title"><span className="night-orb"><Moon size={22} fill="currentColor"/></span><div><p className="eyebrow">Night {status.dayNumber}</p><h1>Keep the village sleeping</h1></div></div>
      <button className="button button--ghost" onClick={() => hasDraft ? setConfirmExit(true) : leave()}><X size={17}/> Exit night</button>
    </header>
    <nav className="night-progress" aria-label="Night sequence">{availableSteps.map((item, index) => <button key={item} className={`night-progress__item ${index === stepIndex ? 'is-active' : index < stepIndex ? 'is-done' : ''} ${skipped.has(item) ? 'is-skipped' : ''}`} onClick={() => setStepIndex(index)}><span>{index < stepIndex ? <Check size={13}/> : index + 1}</span>{item === 'WEREWOLVES' ? 'Wolves' : item.charAt(0) + item.slice(1).toLowerCase()}</button>)}</nav>
    <section className="night-stage" key={step}>
      {step === 'REVIEW' ? <Review players={players} status={status} draft={draft} skipped={skipped} warnings={preview.warnings} effects={preview.effects} onResolve={() => gameStore.confirmNightResolution(draft, preview)}/> : <RoleStep step={step} players={players} status={status} draft={draft} setDraft={setDraft}/>}
    </section>
    <footer className="night-footer">
      <button className="button button--ghost" disabled={stepIndex === 0} onClick={() => setStepIndex((index) => Math.max(0, index - 1))}><ArrowLeft size={17}/> Back</button>
      <p>{stepIndex + 1} of {availableSteps.length}</p>
      {step !== 'REVIEW' ? <div className="night-footer__next"><button className="button button--ghost" onClick={() => advance(true)}>Skip role</button><button className="button button--primary" onClick={() => advance(false)}>Continue <ArrowRight size={17}/></button></div> : null}
    </footer>
    {confirmExit ? <Dialog title="Discard this night draft?" eyebrow="Unconfirmed actions" danger onClose={() => setConfirmExit(false)}><p>Your selections have not changed the game yet. Exiting will discard them.</p><div className="dialog-actions"><button className="button button--ghost" onClick={() => setConfirmExit(false)}>Keep editing</button><button className="button button--danger" onClick={leave}>Discard draft</button></div></Dialog> : null}
  </div>;
}

function RoleStep({ step, players, status, draft, setDraft }: { step: Exclude<NightStep, 'REVIEW'>; players: Player[]; status: GameStatus; draft: NightDraft; setDraft: (draft: NightDraft) => void }) {
  const role = roleByStep[step]!;
  const meta = ROLE_CATALOG[role];
  const rolePlayers = players.filter((player) => player.role === role);
  const alivePlayers = players.filter((player) => player.isAlive);
  const aliveActor = rolePlayers.some((player) => player.isAlive);
  const setOne = (key: Exclude<keyof NightDraft, 'cupidTargetIds'>, playerId: string) => setDraft({ ...draft, [key]: draft[key] === playerId ? null : playerId });

  if (!aliveActor) return <GhostPane role={role} cursed={false}/>;
  if (status.villageCursed && meta.cursed) return <GhostPane role={role} cursed/>;

  return <div className={`role-stage tone-${meta.tone}`}>
    <header className="role-stage__header"><span className="role-stage__icon"><RoleIcon role={role} size={28}/></span><div><p className="eyebrow">{meta.faction === 'WEREWOLF' ? 'The pack wakes' : `${meta.label} wakes`}</p><h2>{titleFor(step)}</h2><p>{instructionFor(step)}</p></div></header>
    {step === 'CUPID' ? <TargetGrid players={alivePlayers} selected={draft.cupidTargetIds} onSelect={(playerId) => setDraft({ ...draft, cupidTargetIds: draft.cupidTargetIds.includes(playerId) ? draft.cupidTargetIds.filter((id) => id !== playerId) : draft.cupidTargetIds.length < 2 ? [...draft.cupidTargetIds, playerId] : [draft.cupidTargetIds[1], playerId] })} badges={draft.cupidTargetIds.map((id, index) => [id, `Lover ${index + 1}`])}/> : null}
    {step === 'BODYGUARD' ? <TargetGrid players={alivePlayers} selected={draft.bodyguardTargetId ? [draft.bodyguardTargetId] : []} disabled={status.lastProtectedPlayerId ? [status.lastProtectedPlayerId] : []} onSelect={(id) => setOne('bodyguardTargetId', id)} badges={status.lastProtectedPlayerId ? [[status.lastProtectedPlayerId, 'Last night']] : []}/> : null}
    {step === 'SEER' ? <><TargetGrid players={alivePlayers} selected={draft.seerTargetId ? [draft.seerTargetId] : []} onSelect={(id) => setOne('seerTargetId', id)}/>{draft.seerTargetId ? <div className="alignment-reveal pop-in"><Eye size={22}/><span>{players.find((player) => player.id === draft.seerTargetId)?.name} is</span><strong>{inspectAlignment(players, draft.seerTargetId) === 'WEREWOLF' ? 'Werewolf' : 'Human'}</strong></div> : null}</> : null}
    {step === 'WEREWOLVES' ? <TargetGrid players={alivePlayers} selected={draft.werewolfTargetId ? [draft.werewolfTargetId] : []} onSelect={(id) => setOne('werewolfTargetId', id)} badges={players.filter((player) => player.role === 'ELDER').map((player) => [player.id, status.elderShield === 'INTACT' ? 'Shield intact' : 'Shield cracked'])}/> : null}
    {step === 'WITCH' ? <WitchStep players={alivePlayers} status={status} draft={draft} setDraft={setDraft}/> : null}
  </div>;
}

function WitchStep({ players, status, draft, setDraft }: { players: Player[]; status: GameStatus; draft: NightDraft; setDraft: (draft: NightDraft) => void }) {
  const victim = players.find((player) => player.id === draft.werewolfTargetId);
  return <div className="witch-layout">
    <article className="potion-card potion-card--heal"><header><Heart size={20}/><div><strong>Healing potion</strong><span>{status.witchResources.healAvailable ? 'Available' : 'Already used'}</span></div></header><p>{victim ? `The pack chose ${victim.name}.` : 'The pack chose no victim.'}</p><button className={draft.witchSaveTargetId ? 'button button--selected' : 'button button--secondary'} disabled={!victim || !status.witchResources.healAvailable} onClick={() => setDraft({ ...draft, witchSaveTargetId: draft.witchSaveTargetId ? null : victim!.id })}>{draft.witchSaveTargetId ? <><Check size={17}/> Will save {victim?.name}</> : 'Use healing potion'}</button></article>
    <article className="potion-card potion-card--poison"><header><WandSparkles size={20}/><div><strong>Poison potion</strong><span>{status.witchResources.poisonAvailable ? 'Available' : 'Already used'}</span></div></header><p>Choose one additional player, or leave the potion unused.</p>{status.witchResources.poisonAvailable ? <TargetGrid compact players={players.filter((player) => player.id !== victim?.id)} selected={draft.witchPoisonTargetId ? [draft.witchPoisonTargetId] : []} onSelect={(id) => setDraft({ ...draft, witchPoisonTargetId: draft.witchPoisonTargetId === id ? null : id })}/> : null}</article>
  </div>;
}

function TargetGrid({ players, selected, onSelect, disabled = [], badges = [], compact = false }: { players: Player[]; selected: string[]; onSelect: (id: string) => void; disabled?: string[]; badges?: string[][]; compact?: boolean }) {
  const labels = new Map(badges.map(([id, label]) => [id, label]));
  return <div className={compact ? 'target-grid target-grid--compact' : 'target-grid'}>{players.map((player, index) => { const active = selected.includes(player.id); const blocked = disabled.includes(player.id); return <button type="button" key={player.id} className={`target-card ${active ? 'is-selected' : ''}`} disabled={blocked} onClick={() => onSelect(player.id)} style={{ '--delay': `${Math.min(index * 35, 280)}ms` } as CSSProperties}><span className="target-card__avatar">{player.name.charAt(0).toUpperCase()}</span><span><strong>{player.name}</strong>{labels.has(player.id) ? <small>{labels.get(player.id)}</small> : <small>{active ? 'Selected' : 'Tap to choose'}</small>}</span>{active ? <Check className="target-card__check" size={17}/> : null}</button>; })}</div>;
}

function Review({ players, status, draft, skipped, warnings, effects, onResolve }: { players: Player[]; status: GameStatus; draft: NightDraft; skipped: Set<NightStep>; warnings: string[]; effects: ResolutionEffect[]; onResolve: () => void }) {
  const name = (id: string | null) => players.find((player) => player.id === id)?.name ?? 'No target';
  const stateFor = (step: Exclude<NightStep, 'REVIEW'>) => { const role = roleByStep[step]!; if (!players.some((player) => player.role === role && player.isAlive)) return 'Eliminated · no action'; if (status.villageCursed && ROLE_CATALOG[role].cursed) return 'Suppressed by curse'; return skipped.has(step) ? 'Skipped' : null; };
  const has = (role: RoleType) => players.some((player) => player.role === role);
  const rows = [has('CUPID') && status.dayNumber === 1 ? ['Cupid', stateFor('CUPID') ?? (draft.cupidTargetIds.length ? draft.cupidTargetIds.map(name).join(' + ') : 'No pair')] : null, has('BODYGUARD') ? ['Bodyguard', stateFor('BODYGUARD') ?? name(draft.bodyguardTargetId)] : null, has('SEER') ? ['Seer', stateFor('SEER') ?? name(draft.seerTargetId)] : null, has('WEREWOLF') ? ['Werewolves', stateFor('WEREWOLVES') ?? name(draft.werewolfTargetId)] : null, has('WITCH') ? ['Witch', stateFor('WITCH') ?? ([draft.witchSaveTargetId ? `Save ${name(draft.witchSaveTargetId)}` : null, draft.witchPoisonTargetId ? `Poison ${name(draft.witchPoisonTargetId)}` : null].filter(Boolean).join(' · ') || 'No potion')] : null].filter((row): row is string[] => row !== null);
  const deaths = new Set(effects.filter((effect) => effect.type === 'ELIMINATE').map((effect) => effect.playerId));
  const survivors = players.filter((player) => player.isAlive && !deaths.has(player.id));
  return <div className="review-stage"><header className="role-stage__header"><span className="role-stage__icon"><Sparkles size={28}/></span><div><p className="eyebrow">Before the village wakes</p><h2>Review the night</h2><p>Nothing changes until you resolve this summary.</p></div></header><div className="review-outcomes"><div><span>Expected alive</span><strong>{survivors.length}</strong><small>{survivors.map((player) => player.name).join(', ') || 'None'}</small></div><div className={deaths.size ? 'has-deaths' : ''}><span>Expected deaths</span><strong>{deaths.size}</strong><small>{players.filter((player) => deaths.has(player.id)).map((player) => player.name).join(', ') || 'None'}</small></div></div><div className="review-columns"><div className="review-list">{rows.map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div><div className="effects-list"><p className="eyebrow">Expected consequences</p>{effects.map((effect) => <p key={`${effect.type}-${effect.playerId ?? effect.resource ?? ''}`}><Check size={15}/>{effect.explanation}</p>)}{!effects.length ? <p>No mechanical changes.</p> : null}</div></div>{warnings.map((warning) => <p className="form-error" key={warning}>{warning}</p>)}<button className="button button--primary button--large resolve-button" disabled={warnings.length > 0} onClick={onResolve}><Moon size={18}/> Resolve night & wake village</button></div>;
}

function GhostPane({ role, cursed }: { role: RoleType; cursed: boolean }) { return <div className="ghost-pane"><span>{cursed ? <Shield size={30}/> : <Skull size={30}/>}</span><p className="eyebrow">Keep the rhythm</p><h2>{cursed ? 'Village curse active' : `${ROLE_CATALOG[role].label} is eliminated`}</h2><p>{cursed ? 'This role has lost its power. Pause briefly, then continue.' : 'Show no target controls. Pause briefly to preserve the mystery.'}</p></div>; }
const titleFor = (step: NightStep) => ({ CUPID: 'Choose two Lovers', BODYGUARD: 'Choose tonight’s protection', SEER: 'Read one alignment', WEREWOLVES: 'Choose the pack’s victim', WITCH: 'Decide whether to intervene', REVIEW: 'Review the night' })[step];
const instructionFor = (step: NightStep) => ({ CUPID: 'Select exactly two living players. Tap again to change the pair.', BODYGUARD: 'The target from last night is unavailable.', SEER: 'Vespera reveals only Human or Werewolf.', WEREWOLVES: 'Record the target agreed on at the table.', WITCH: 'Healing and poison are each available once per game.', REVIEW: '' })[step];
