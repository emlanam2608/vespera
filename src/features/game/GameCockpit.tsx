'use client';

import { useState, type CSSProperties } from 'react';
import { AlertTriangle, ArrowRight, Check, ChevronDown, ChevronUp, Crown, Eye, Flame, Heart, History, Moon, RotateCcw, ShieldCheck, Skull, Sparkles, Sun, Target, Undo2, UserRoundCheck, UsersRound } from 'lucide-react';
import { gameStore } from '@/logic/game-store';
import { useStream } from '@/logic/antigravity/stream';
import { ROLE_CATALOG, type DayOutcomeDraft, type GameEvent, type GameEventType, type Player, type PlayerCorrection, type ResolutionPreview, type UndoCheckpoint, type Winner } from '@/types';
import { Dialog } from '@/features/ui/Dialog';
import { RoleIcon } from '@/features/ui/RoleIcon';
import { NightAssistant } from '@/features/game/NightAssistant';

export function GameCockpit() {
  const players = useStream(gameStore.playerList);
  const status = useStream(gameStore.gameStatus);
  const events = useStream(gameStore.gameEvents);
  const undo = useStream(gameStore.undoCheckpoint);
  const [dialog, setDialog] = useState<'DAY' | 'WINNER' | 'RESET' | 'UNDO' | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dismissedBrief, setDismissedBrief] = useState<string | null>(null);
  const aliveCount = players.filter((player) => player.isAlive).length;
  const lastResolution = events.findLast((event) => event.type === 'NIGHT' || event.type === 'DAY');

  if (status.phase === 'NIGHT' && status.stage === 'RUNNING') return <NightAssistant players={players} status={status}/>;
  if (status.stage === 'FINISHED') return <FinishedGame players={players} winner={status.confirmedWinner!} events={events} undo={undo}/>;
  const selected = players.find((player) => player.id === selectedId) ?? null;

  return <main className="app-shell game-shell">
    <div className="ambient ambient--one"/><div className="ambient ambient--two"/>
    <header className="cockpit-header enter-down">
      <div className="compact-brand"><span className="compact-brand__mark"><Moon size={18} fill="currentColor"/></span><div><strong>Vespera</strong><span>Host console</span></div></div>
      <div className="phase-lockup"><p className="eyebrow">Current chapter</p><h1><Sun size={25}/> Day {status.dayNumber}</h1></div>
      <div className="header-actions"><button className="icon-button" disabled={!undo} onClick={() => setDialog('UNDO')} aria-label={undo ? `Review undo for ${undo.label}` : 'Nothing to undo'}><Undo2 size={19}/></button><button className="icon-button" onClick={() => setDialog('RESET')} aria-label="Start a new session"><RotateCcw size={19}/></button></div>
    </header>

    <section className="status-strip enter-up">
      <div><span className="status-icon status-icon--alive"><UserRoundCheck size={18}/></span><p><strong>{aliveCount}</strong><span>Alive</span></p></div>
      <div><span className="status-icon status-icon--out"><Skull size={18}/></span><p><strong>{players.length - aliveCount}</strong><span>Eliminated</span></p></div>
      <div><span className="status-icon"><UsersRound size={18}/></span><p><strong>{players.length}</strong><span>At the table</span></p></div>
      <div><span className={status.villageCursed ? 'status-icon status-icon--curse' : 'status-icon'}>{status.villageCursed ? <Flame size={18}/> : <ShieldCheck size={18}/>}</span><p><strong>{status.villageCursed ? 'Cursed' : 'Clear'}</strong><span>Village state</span></p></div>
    </section>

    {status.suggestedWinner ? <section className="winner-suggestion enter-up"><span><Sparkles size={19}/></span><div><p className="eyebrow">Host check</p><strong>{winnerLabel(status.suggestedWinner)} may have reached their win condition.</strong><p>Vespera will not end the game until you confirm it.</p></div><div className="winner-suggestion__actions"><button className="button button--ghost" onClick={() => gameStore.dismissWinnerSuggestion()}>Keep playing</button><button className="button button--primary" onClick={() => setDialog('WINNER')}>Review winner</button></div></section> : null}

    {lastResolution && lastResolution.id !== dismissedBrief ? <AnnouncementBrief event={lastResolution} onDismiss={() => setDismissedBrief(lastResolution.id)}/> : null}

    {status.phase === 'DAY' ? <section className="primary-actions enter-up stagger-1">
      <button className="action-tile action-tile--day" onClick={() => setDialog('DAY')}><span><Sun size={24}/></span><div><p className="eyebrow">The table decides</p><strong>Record day outcome</strong><p>Elimination, no elimination, or Mayor.</p></div><ArrowRight size={20}/></button>
      <button className="action-tile action-tile--night" onClick={() => gameStore.startNight()}><span><Moon size={24} fill="currentColor"/></span><div><p className="eyebrow">Lower the lights</p><strong>Begin night {status.dayNumber}</strong><p>Walk through only the roles in this game.</p></div><ArrowRight size={20}/></button>
    </section> : null}

    {status.phase === 'HUNTER_RESPONSE' ? <HunterResponse players={players}/> : null}

    <div className="cockpit-grid">
      <section className="roster-panel enter-up stagger-2">
        <div className="section-heading"><div><p className="eyebrow">Private roster</p><h2>The village</h2><p>Roles stay concealed until you open a player.</p></div><span className="privacy-badge"><Eye size={15}/> Tap to reveal</span></div>
        <div className="player-grid">{players.map((player, index) => <PlayerCard key={player.id} player={player} index={index} onClick={() => setSelectedId(player.id)}/>)}</div>
      </section>
      <HistoryPanel events={events}/>
    </div>

    {selected ? <PlayerDialog player={selected} players={players} onClose={() => setSelectedId(null)}/> : null}
    {dialog === 'DAY' ? <DayOutcomeDialog players={players} onClose={() => setDialog(null)}/> : null}
    {dialog === 'WINNER' ? <WinnerDialog suggested={status.suggestedWinner} onClose={() => setDialog(null)}/> : null}
    {dialog === 'UNDO' && undo ? <UndoDialog checkpoint={undo} onClose={() => setDialog(null)}/> : null}
    {dialog === 'RESET' ? <ResetDialog onClose={() => setDialog(null)}/> : null}
  </main>;
}

function PlayerCard({ player, index, onClick }: { player: Player; index: number; onClick: () => void }) {
  return <button className={`village-card ${player.isAlive ? '' : 'is-eliminated'}`} onClick={onClick} aria-label={`${player.name}, ${player.isAlive ? 'alive' : 'eliminated'}; open private record`} style={{ '--delay': `${Math.min(index * 40, 360)}ms` } as CSSProperties}>
    <span className="village-card__avatar">{player.name.charAt(0).toUpperCase()}</span>
    <span className="village-card__copy"><strong>{player.name}</strong><small>{player.isAlive ? 'Alive' : 'Eliminated'}</small></span>
    <span className="village-card__badges">{player.isMayor ? <i title="Mayor"><Crown size={14}/></i> : null}{player.status === 'EXPOSED' ? <i title="Exposed"><AlertTriangle size={14}/></i> : null}{player.loverPartnerId ? <i title="Lover"><Heart size={14}/></i> : null}</span>
    <Eye className="village-card__reveal" size={17}/>
  </button>;
}

function PlayerDialog({ player, players, onClose }: { player: Player; players: Player[]; onClose: () => void }) {
  const [correction, setCorrection] = useState<PlayerCorrection | null>(null);
  const lover = players.find((candidate) => candidate.id === player.loverPartnerId);
  const apply = () => { if (correction && gameStore.confirmPlayerCorrection(correction)) onClose(); };
  if (correction) return <Dialog title="Confirm moderator correction" eyebrow="This changes the committed game" danger onClose={() => setCorrection(null)}><div className="confirmation-callout"><AlertTriangle size={22}/><p>{correction.type === 'ELIMINATE' ? `${player.name} will be marked eliminated.` : correction.type === 'REVIVE' ? `${player.name} will return alive.` : player.isMayor ? `${player.name} will lose the Mayor marker.` : `${player.name} will become Mayor.`}</p></div><p>This action will appear in history and can be undone once.</p><div className="dialog-actions"><button className="button button--ghost" onClick={() => setCorrection(null)}>Go back</button><button className="button button--danger" onClick={apply}>Confirm correction</button></div></Dialog>;
  return <Dialog title={player.name} eyebrow="Secret player record" onClose={onClose}>
    <div className={`secret-role tone-${ROLE_CATALOG[player.role].tone}`}><span><RoleIcon role={player.role} size={31}/></span><div><p className="eyebrow">Secret role</p><h3>{ROLE_CATALOG[player.role].label}</h3><p>{ROLE_CATALOG[player.role].description}</p></div></div>
    <div className="detail-grid"><div><span>Life</span><strong>{player.isAlive ? 'Alive' : 'Eliminated'}</strong></div><div><span>Vote</span><strong>{player.status === 'EXPOSED' ? 'No vote' : player.isMayor ? 'Counts twice' : 'Normal'}</strong></div><div><span>Mayor</span><strong>{player.isMayor ? 'Yes' : 'No'}</strong></div><div><span>Lover</span><strong>{lover?.name ?? 'None'}</strong></div></div>
    <details className="correction-zone"><summary>Moderator correction</summary><p>Use only to mirror a correction already agreed at the table.</p><div className="dialog-actions"><button className="button button--ghost" onClick={() => setCorrection({ type: player.isAlive ? 'ELIMINATE' : 'REVIVE', playerId: player.id })}>{player.isAlive ? <><Skull size={16}/> Mark eliminated</> : <><Heart size={16}/> Restore alive</>}</button><button className="button button--ghost" onClick={() => setCorrection({ type: 'TOGGLE_MAYOR', playerId: player.id })}><Crown size={16}/>{player.isMayor ? 'Remove Mayor' : 'Make Mayor'}</button></div></details>
  </Dialog>;
}

function DayOutcomeDialog({ players, onClose }: { players: Player[]; onClose: () => void }) {
  const alive = players.filter((player) => player.isAlive);
  const [draft, setDraft] = useState<DayOutcomeDraft>({ type: 'ELIMINATION' });
  const [reviewing, setReviewing] = useState(false);
  const preview = gameStore.previewDayOutcome(draft);
  const commit = () => { if (gameStore.confirmDayOutcome(draft, preview)) onClose(); };
  return <Dialog title={reviewing ? 'Confirm day outcome' : 'What did the village decide?'} eyebrow={reviewing ? 'Review before committing' : 'Daytime record'} onClose={onClose}>
    {!reviewing ? <><div className="outcome-options"><button className={draft.type === 'ELIMINATION' ? 'outcome-option is-active' : 'outcome-option'} onClick={() => setDraft({ type: 'ELIMINATION' })}><Skull size={20}/><span><strong>Player eliminated</strong><small>Record the table’s decision</small></span></button><button className={draft.type === 'NO_ELIMINATION' ? 'outcome-option is-active' : 'outcome-option'} onClick={() => setDraft({ type: 'NO_ELIMINATION' })}><ShieldCheck size={20}/><span><strong>No elimination</strong><small>Tie, pass, or no consensus</small></span></button><button className={draft.type === 'MAYOR_ELECTION' ? 'outcome-option is-active' : 'outcome-option'} onClick={() => setDraft({ type: 'MAYOR_ELECTION' })}><Crown size={20}/><span><strong>Mayor elected</strong><small>Record the chosen player</small></span></button></div>{draft.type !== 'NO_ELIMINATION' ? <PlayerPicker players={draft.type === 'MAYOR_ELECTION' ? alive.filter((player) => !player.isMayor) : alive} selectedId={draft.playerId ?? null} onSelect={(playerId) => setDraft({ ...draft, playerId })}/> : null}<div className="dialog-actions"><button className="button button--ghost" onClick={onClose}>Cancel</button><button className="button button--primary" disabled={preview.warnings.length > 0} onClick={() => setReviewing(true)}>Review outcome <ArrowRight size={17}/></button></div></> : <><ResolutionCard preview={preview}/><div className="dialog-actions"><button className="button button--ghost" onClick={() => setReviewing(false)}>Edit</button><button className="button button--primary" onClick={commit}><Check size={17}/> Confirm outcome</button></div></>}
  </Dialog>;
}

function HunterResponse({ players }: { players: Player[] }) {
  const [targetId, setTargetId] = useState<string | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const preview = gameStore.previewHunterResponse(targetId);
  return <section className="hunter-panel enter-up"><span className="hunter-panel__icon"><Target size={26}/></span><div><p className="eyebrow">Mandatory response</p><h2>Hunter’s last stand</h2><p>Choose a living target or explicitly pass. Nothing changes until confirmation.</p>{!reviewing ? <PlayerPicker players={players.filter((player) => player.isAlive)} selectedId={targetId} onSelect={setTargetId}/> : <ResolutionCard preview={preview}/>}<div className="dialog-actions">{reviewing ? <><button className="button button--ghost" onClick={() => setReviewing(false)}>Edit</button><button className="button button--primary" onClick={() => gameStore.confirmHunterResponse(targetId, preview)}>Confirm response</button></> : <><button className="button button--ghost" onClick={() => { setTargetId(null); setReviewing(true); }}>Pass</button><button className="button button--primary" disabled={!targetId} onClick={() => setReviewing(true)}>Review shot</button></>}</div></div></section>;
}

function PlayerPicker({ players, selectedId, onSelect }: { players: Player[]; selectedId: string | null; onSelect: (id: string) => void }) { return <div className="dialog-player-grid">{players.map((player) => <button key={player.id} className={selectedId === player.id ? 'dialog-player is-selected' : 'dialog-player'} onClick={() => onSelect(player.id)}><span>{player.name.charAt(0).toUpperCase()}</span><strong>{player.name}</strong>{selectedId === player.id ? <Check size={16}/> : null}</button>)}</div>; }
function ResolutionCard({ preview }: { preview: ResolutionPreview }) { return <div className="resolution-card"><p className="eyebrow">Expected consequences</p>{preview.effects.length ? preview.effects.map((effect) => <p key={`${effect.type}-${effect.playerId ?? effect.resource ?? ''}`}><Check size={15}/>{effect.explanation}</p>) : <p><ShieldCheck size={15}/>No player state will change.</p>}{preview.warnings.map((warning) => <p className="form-error" key={warning}><AlertTriangle size={15}/>{warning}</p>)}</div>; }

function AnnouncementBrief({ event, onDismiss }: { event: GameEvent; onDismiss: () => void }) { const announcements = event.type === 'NIGHT' ? event.effects.filter((effect) => effect.type === 'ELIMINATE' || effect.type === 'CRACK_ELDER_SHIELD') : event.effects; return <section className="morning-brief enter-up"><span className="morning-brief__sun"><Sun size={22}/></span><div><p className="eyebrow">{event.type === 'NIGHT' ? 'Morning brief' : 'Moderator brief'}</p><h2>What to announce</h2>{announcements.length ? announcements.map((effect) => <p key={`${effect.type}-${effect.playerId ?? effect.resource ?? ''}`}>{effect.explanation}</p>) : <p>{event.type === 'NIGHT' ? 'No deaths to announce. The village wakes intact.' : 'No mechanical consequence to announce.'}</p>}</div><button className="icon-button" onClick={onDismiss} aria-label="Dismiss announcement brief"><Check size={18}/></button></section>; }

function WinnerDialog({ suggested, onClose }: { suggested: Winner | null; onClose: () => void }) { const [winner, setWinner] = useState<Winner>(suggested ?? 'VILLAGERS'); return <Dialog title="Finish this game?" eyebrow="The host has the final word" onClose={onClose}><div className="winner-options">{(['VILLAGERS', 'WEREWOLVES', 'LOVERS'] as Winner[]).map((option) => <button key={option} className={winner === option ? 'winner-option is-active' : 'winner-option'} onClick={() => setWinner(option)}><span>{option === 'VILLAGERS' ? <UsersRound/> : option === 'WEREWOLVES' ? <Moon/> : <Heart/>}</span><strong>{winnerLabel(option)}</strong></button>)}</div><p>Finishing records the winner and locks normal play. You can still undo this action once.</p><div className="dialog-actions"><button className="button button--ghost" onClick={onClose}>Keep playing</button><button className="button button--primary" onClick={() => gameStore.finishGame(winner)}>Confirm {winnerLabel(winner)}</button></div></Dialog>; }
function ResetDialog({ onClose }: { onClose: () => void }) { return <Dialog title="Start a new session?" eyebrow="Current progress will be cleared" danger onClose={onClose}><p>Keep the names at this table, or clear everything and begin with an empty roster.</p><div className="dialog-actions dialog-actions--stack"><button className="button button--ghost" onClick={onClose}>Cancel</button><button className="button button--secondary" onClick={() => gameStore.resetSession(true)}>Keep player names</button><button className="button button--danger" onClick={() => gameStore.resetSession(false)}>Clear all data</button></div></Dialog>; }

function UndoDialog({ checkpoint, onClose }: { checkpoint: UndoCheckpoint; onClose: () => void }) { const snapshot = checkpoint.snapshot; const alive = snapshot.players.filter((player) => player.isAlive).length; return <Dialog title={`Undo ${checkpoint.label}?`} eyebrow="Restore the previous confirmed state" onClose={onClose}><div className="undo-summary"><Undo2 size={22}/><div><strong>Vespera will restore Day {snapshot.status.dayNumber}, {snapshot.status.phase.toLowerCase().replace('_', ' ')}.</strong><p>{alive} alive · {snapshot.players.length - alive} eliminated · {snapshot.events.length} earlier history events.</p></div></div><p>The current committed action and its effects will be removed. Undo can only be used once and cannot be redone.</p><div className="dialog-actions"><button className="button button--ghost" onClick={onClose}>Keep current state</button><button className="button button--primary" onClick={() => gameStore.undoLastCommit()}><Undo2 size={17}/> Confirm undo</button></div></Dialog>; }

function HistoryPanel({ events }: { events: GameEvent[] }) { const [open, setOpen] = useState(false); const [filter, setFilter] = useState<'ALL' | GameEventType>('ALL'); const filtered = filter === 'ALL' ? events : events.filter((event) => event.type === filter); const visible = open ? filtered.toReversed() : filtered.slice(-3).toReversed(); const filters: Array<'ALL' | GameEventType> = ['ALL', 'DAY', 'NIGHT', 'HUNTER', 'CORRECTION', 'SYSTEM']; return <aside className="history-panel enter-up stagger-3"><button className="history-panel__header" onClick={() => setOpen((value) => !value)}><span><History size={18}/><strong>Game history</strong></span>{open ? <ChevronUp size={18}/> : <ChevronDown size={18}/>}</button>{open ? <div className="history-filters" aria-label="Filter history">{filters.map((item) => <button key={item} className={filter === item ? 'is-active' : ''} onClick={() => setFilter(item)}>{item === 'ALL' ? 'All' : item === 'HUNTER' ? 'Ability' : item.charAt(0) + item.slice(1).toLowerCase()}</button>)}</div> : null}<div className="timeline">{visible.length ? visible.map((event) => <article key={event.id}><span className={`timeline__dot type-${event.type.toLowerCase()}`}/><div><small>Day {event.dayNumber} · {event.type.toLowerCase()}</small><p>{event.summary}</p></div></article>) : <p className="muted">No confirmed events in this view.</p>}</div>{!open && filtered.length > 3 ? <button className="text-button" onClick={() => setOpen(true)}>Show {filtered.length - 3} earlier events</button> : null}</aside>; }

function FinishedGame({ players, winner, events, undo }: { players: Player[]; winner: Winner; events: GameEvent[]; undo: UndoCheckpoint | null }) { const [dialog, setDialog] = useState<'RESET' | 'UNDO' | null>(null); return <main className="app-shell finished-shell"><div className="finished-glow"/><section className="finished-card enter-up"><span className="finished-card__icon">{winner === 'LOVERS' ? <Heart size={40}/> : winner === 'WEREWOLVES' ? <Moon size={40}/> : <Sparkles size={40}/>}</span><p className="eyebrow">Game complete</p><h1>{winnerLabel(winner)} win</h1><p>{events.length} confirmed moments across the game. The final roster remains private below.</p><div className="finished-roster">{players.map((player) => <div key={player.id}><RoleIcon role={player.role}/><span><strong>{player.name}</strong><small>{ROLE_CATALOG[player.role].label}</small></span></div>)}</div><div className="finished-actions">{undo ? <button className="button button--ghost" onClick={() => setDialog('UNDO')}><Undo2 size={17}/> Undo finish</button> : null}<button className="button button--primary button--large" onClick={() => setDialog('RESET')}><RotateCcw size={18}/> Start another game</button></div></section>{dialog === 'RESET' ? <ResetDialog onClose={() => setDialog(null)}/> : null}{dialog === 'UNDO' && undo ? <UndoDialog checkpoint={undo} onClose={() => setDialog(null)}/> : null}</main>; }
const winnerLabel = (winner: Winner) => winner === 'VILLAGERS' ? 'Villagers' : winner === 'WEREWOLVES' ? 'Werewolves' : 'Lovers';
