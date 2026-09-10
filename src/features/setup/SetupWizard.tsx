'use client';

import { useMemo, useState } from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Check, Eye, EyeOff, Minus, Plus, Shuffle, Trash2, UserPlus, UsersRound } from 'lucide-react';
import { gameStore } from '@/logic/game-store';
import { createPlayer, ROLE_CATALOG, type Player, type RoleType } from '@/types';
import { RoleIcon } from '@/features/ui/RoleIcon';

const roles = Object.keys(ROLE_CATALOG) as RoleType[];
const steps = ['Players', 'Role mix', 'Assignments'] as const;
const countRoles = (players: Player[]) => players.reduce<Record<RoleType, number>>((counts, player) => ({ ...counts, [player.role]: counts[player.role] + 1 }), Object.fromEntries(roles.map((role) => [role, 0])) as Record<RoleType, number>);

export function SetupWizard({ savedPlayers }: { savedPlayers: Player[] }) {
  const [step, setStep] = useState(0);
  const [players, setPlayers] = useState<Player[]>(() => savedPlayers.map((player) => createPlayer(player.name, player.id)));
  const [name, setName] = useState('');
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const counts = useMemo(() => countRoles(players), [players]);
  const balance = players.reduce((sum, player) => sum + ROLE_CATALOG[player.role].balanceWeight, 0);
  const duplicateNames = new Set(players.map((player) => player.name.trim().toLocaleLowerCase())).size !== players.length;
  const duplicateSpecial = roles.some((role) => ROLE_CATALOG[role].unique && counts[role] > 1);
  const canStart = players.length >= 3 && counts.WEREWOLF > 0 && !duplicateNames && !duplicateSpecial && players.every((player) => player.name.trim());

  const addPlayer = () => {
    const value = name.trim();
    if (!value || players.some((player) => player.name.toLocaleLowerCase() === value.toLocaleLowerCase())) return;
    setPlayers((current) => [...current, gameStore.createSetupPlayer(value)]);
    setName('');
  };
  const updateRoleCount = (role: RoleType, delta: number) => {
    if (delta > 0) {
      if (players.length === 0 || (ROLE_CATALOG[role].unique && counts[role] >= 1)) return;
      const replacement = players.findIndex((player) => player.role === 'VILLAGER' && role !== 'VILLAGER');
      if (replacement < 0) return;
      setPlayers((current) => current.map((player, index) => index === replacement ? { ...player, role } : player));
      return;
    }
    const replacement = players.map((player) => player.role).lastIndexOf(role);
    if (replacement >= 0 && role !== 'VILLAGER') setPlayers((current) => current.map((player, index) => index === replacement ? { ...player, role: 'VILLAGER' } : player));
  };
  const shuffle = () => {
    const rolePool = players.map((player) => player.role);
    for (let index = rolePool.length - 1; index > 0; index -= 1) {
      const target = Math.floor(Math.random() * (index + 1));
      [rolePool[index], rolePool[target]] = [rolePool[target], rolePool[index]];
    }
    setPlayers((current) => current.map((player, index) => ({ ...player, role: rolePool[index] })));
    setRevealed(new Set());
  };
  const move = (index: number, direction: -1 | 1) => setPlayers((current) => {
    const target = index + direction;
    if (target < 0 || target >= current.length) return current;
    const next = [...current]; [next[index], next[target]] = [next[target], next[index]]; return next;
  });

  return <main className="app-shell setup-shell">
    <header className="brand-header enter-up">
      <div className="brand-mark"><MoonLogo /></div>
      <div><p className="eyebrow">Private moderator workspace</p><h1>Vespera</h1><p className="lede">Quiet guidance for a game that still happens around the table.</p></div>
    </header>
    <nav className="setup-progress" aria-label="Setup progress">{steps.map((label, index) => <div key={label} className={index === step ? 'setup-progress__step is-active' : index < step ? 'setup-progress__step is-done' : 'setup-progress__step'}><span>{index < step ? <Check size={14} /> : index + 1}</span><strong>{label}</strong></div>)}</nav>

    {step === 0 ? <section className="surface enter-up stagger-1">
      <div className="section-heading"><div><p className="eyebrow">Step 1</p><h2>Who is at the table?</h2><p>Add players in seating order. You can adjust the order before continuing.</p></div><span className="count-pill"><UsersRound size={16} /> {players.length}</span></div>
      <form className="add-player" onSubmit={(event) => { event.preventDefault(); addPlayer(); }}><UserPlus size={20} /><input value={name} onChange={(event) => setName(event.target.value)} aria-label="Player name" placeholder="Type a player name…" autoComplete="off"/><button className="button button--primary" disabled={!name.trim()}>Add</button></form>
      <div className="setup-player-list">{players.length ? players.map((player, index) => <div className="setup-player-row" key={player.id}><span className="seat-number">{String(index + 1).padStart(2, '0')}</span><input value={player.name} aria-label={`Name for player ${index + 1}`} onChange={(event) => setPlayers((current) => current.map((item) => item.id === player.id ? { ...item, name: event.target.value } : item))}/><div className="row-actions"><button type="button" className="icon-button" disabled={index === 0} onClick={() => move(index, -1)} aria-label={`Move ${player.name} up`}><ArrowUp size={17}/></button><button type="button" className="icon-button" disabled={index === players.length - 1} onClick={() => move(index, 1)} aria-label={`Move ${player.name} down`}><ArrowDown size={17}/></button><button type="button" className="icon-button icon-button--danger" onClick={() => setPlayers((current) => current.filter((item) => item.id !== player.id))} aria-label={`Remove ${player.name}`}><Trash2 size={17}/></button></div></div>) : <div className="empty-state"><UsersRound size={34}/><strong>Your table is empty</strong><p>Add at least three players to begin.</p></div>}</div>
      {players.length ? <div className="clear-roster"><span>Roster draft only</span><button type="button" className="button button--danger" onClick={() => { setPlayers([]); setRevealed(new Set()); }}><Trash2 size={16}/> Clear all</button></div> : null}
      {duplicateNames ? <p className="form-error">Player names must be unique.</p> : null}
    </section> : null}

    {step === 1 ? <section className="surface enter-up">
      <div className="section-heading"><div><p className="eyebrow">Step 2</p><h2>Shape the story</h2><p>Choose the cast. Balance is guidance, not a verdict.</p></div><div className={`balance-orb ${balance < -2 ? 'is-wolf' : balance > 2 ? 'is-village' : 'is-close'}`}><strong>{balance > 0 ? `+${balance}` : balance}</strong><span>{balance < -2 ? 'Wolf leaning' : balance > 2 ? 'Village leaning' : 'Close'}</span></div></div>
      <div className="role-grid">{roles.map((role) => { const meta = ROLE_CATALOG[role]; return <article key={role} className={`role-card tone-${meta.tone}`}><div className="role-card__icon"><RoleIcon role={role}/></div><div className="role-card__copy"><strong>{meta.label}</strong><p>{meta.description}</p></div><div className="counter"><button type="button" onClick={() => updateRoleCount(role, -1)} disabled={role === 'VILLAGER' || counts[role] === 0} aria-label={`Remove ${meta.label}`}><Minus size={15}/></button><span>{counts[role]}</span><button type="button" onClick={() => updateRoleCount(role, 1)} disabled={role === 'VILLAGER' || players.every((player) => player.role !== 'VILLAGER') || (meta.unique && counts[role] >= 1)} aria-label={`Add ${meta.label}`}><Plus size={15}/></button></div></article>; })}</div>
      {counts.WEREWOLF === 0 ? <p className="form-error">Add at least one Werewolf before continuing.</p> : null}
    </section> : null}

    {step === 2 ? <section className="surface enter-up">
      <div className="section-heading"><div><p className="eyebrow">Step 3</p><h2>Private assignments</h2><p>Review or shuffle roles. Tap the eye only when the screen is safe.</p></div><button className="button button--secondary" onClick={shuffle}><Shuffle size={17}/> Shuffle</button></div>
      <div className="assignment-list">{players.map((player, index) => <div className={`assignment-row tone-${ROLE_CATALOG[player.role].tone}`} key={player.id}><span className="seat-number">{String(index + 1).padStart(2, '0')}</span><div className="assignment-row__name"><strong>{player.name}</strong><span>{revealed.has(player.id) ? ROLE_CATALOG[player.role].label : 'Role concealed'}</span></div>{revealed.has(player.id) ? <div className="role-reveal"><RoleIcon role={player.role}/><select value={player.role} aria-label={`Role for ${player.name}`} onChange={(event) => setPlayers((current) => current.map((item) => item.id === player.id ? { ...item, role: event.target.value as RoleType } : item))}>{roles.map((role) => <option key={role} value={role}>{ROLE_CATALOG[role].label}</option>)}</select></div> : null}<button type="button" className="icon-button" onClick={() => setRevealed((current) => { const next = new Set(current); if (next.has(player.id)) next.delete(player.id); else next.add(player.id); return next; })} aria-label={`${revealed.has(player.id) ? 'Hide' : 'Reveal'} role for ${player.name}`}>{revealed.has(player.id) ? <EyeOff size={18}/> : <Eye size={18}/>}</button></div>)}</div>
      {duplicateSpecial ? <p className="form-error">Special roles may only appear once.</p> : null}
    </section> : null}

    <footer className="wizard-footer"><button className="button button--ghost" disabled={step === 0} onClick={() => setStep((value) => value - 1)}><ArrowLeft size={17}/> Back</button><p>{step === 0 ? `${players.length} players` : step === 1 ? `${players.length} roles assigned` : 'Ready when the table is ready'}</p>{step < 2 ? <button className="button button--primary" disabled={step === 0 ? players.length < 3 || duplicateNames : counts.WEREWOLF === 0} onClick={() => setStep((value) => value + 1)}>Continue <ArrowRight size={17}/></button> : <button className="button button--primary" disabled={!canStart} onClick={() => gameStore.confirmSetup({ players })}>Begin game <ArrowRight size={17}/></button>}</footer>
  </main>;
}

function MoonLogo() { return <svg aria-hidden="true" viewBox="0 0 64 64"><path d="M43 8c-9 4-15 13-15 23 0 12 8 21 20 24-5 3-10 5-16 5C16 60 4 48 4 32S16 4 32 4c4 0 8 1 11 4Z" fill="currentColor"/><path d="m45 21 2 5 5 2-5 2-2 5-2-5-5-2 5-2 2-5Z" fill="currentColor" opacity=".7"/></svg>; }
