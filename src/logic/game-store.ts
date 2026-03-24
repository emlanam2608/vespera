import { createStream, Stream } from './antigravity/stream';
import { Player, RoleType, GameStatus, NightAction, GameLog, LogEventType, TieBreakRule } from '../types';

export class GameStore {
  public playerList: Stream<Player[]>;
  public gameStatus: Stream<GameStatus>;
  public nightActions: Stream<NightAction[]>;
  public gameLogs: Stream<GameLog[]>;

  constructor() {
    let initialPlayers = this.getInitialPlayers();
    let initialStatus: GameStatus = {
      phase: 'LOBBY',
      dayCount: 0,
      winner: null,
      witchState: { hasHeal: true, hasPoison: true },
      lastProtectedId: null,
      pendingHunterId: null,
      tieBreakRule: 'NO_EXECUTION',
      villageCursed: false,
    };
    let initialActions: NightAction[] = [];
    let initialLogs: GameLog[] = [];

    if (typeof window !== 'undefined') {
      const savedPlayers = localStorage.getItem('vespera-players');
      const savedStatus = localStorage.getItem('vespera-status');
      const savedActions = localStorage.getItem('vespera-actions');
      const savedLogs = localStorage.getItem('vespera-logs');

      if (savedPlayers) { try { initialPlayers = JSON.parse(savedPlayers); } catch (e) {} }
      if (savedStatus) { try { initialStatus = { ...initialStatus, ...JSON.parse(savedStatus) }; } catch (e) {} }
      if (savedActions) { try { initialActions = JSON.parse(savedActions); } catch (e) {} }
      if (savedLogs) { try { initialLogs = JSON.parse(savedLogs); } catch (e) {} }
    }

    this.playerList = createStream<Player[]>(initialPlayers);
    this.gameStatus = createStream<GameStatus>(initialStatus);
    this.nightActions = createStream<NightAction[]>(initialActions);
    this.gameLogs = createStream<GameLog[]>(initialLogs);

    if (typeof window !== 'undefined') {
      this.playerList.subscribe(players => localStorage.setItem('vespera-players', JSON.stringify(players)));
      this.gameStatus.subscribe(status => localStorage.setItem('vespera-status', JSON.stringify(status)));
      this.nightActions.subscribe(actions => localStorage.setItem('vespera-actions', JSON.stringify(actions)));
      this.gameLogs.subscribe(logs => localStorage.setItem('vespera-logs', JSON.stringify(logs)));
    }
  }

  private getInitialPlayers(): Player[] {
    return [];
  }

  // ── Logging ──────────────────────────────────────────────────────────────

  private addLog(type: LogEventType, message: string, involvedPlayerIds: string[] = []) {
    const status = this.gameStatus.value;
    this.gameLogs.update(logs => [
      ...logs,
      {
        id: Math.random().toString(36).substring(2, 9),
        timestamp: Date.now(),
        dayCount: status.dayCount,
        phase: status.phase,
        type,
        message,
        involvedPlayerIds,
      }
    ]);
  }

  // ── Player Management ─────────────────────────────────────────────────────

  public addPlayer(name: string) {
    this.playerList.update(players => [
      ...players,
      {
        id: `player-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        name,
        role: 'VILLAGER',
        isAlive: true,
        status: 'Alive',
      }
    ]);
  }

  public removePlayer(playerId: string) {
    this.playerList.update(players => players.filter(p => p.id !== playerId));
  }

  public clearPlayers() {
    this.playerList.set([]);
  }

  public assignRole(playerId: string, role: RoleType) {
    this.playerList.update(players =>
      players.map(p => p.id === playerId ? { ...p, role } : p)
    );
  }

  public randomizeRoles(roleDefinitions: RoleType[]) {
    const shuffled = [...roleDefinitions].sort(() => Math.random() - 0.5);
    this.playerList.update(players =>
      players.map((p, i) => ({
        ...p,
        role: i < shuffled.length ? shuffled[i] : 'VILLAGER'
      }))
    );
  }

  private checkWinConditions() {
    const players = this.playerList.value;
    const alivePlayers = players.filter(p => p.isAlive);
    const wolves = alivePlayers.filter(p => p.role === 'WEREWOLF');
    const humans = alivePlayers.filter(p => p.role !== 'WEREWOLF');

    const getPower = (p: Player) => {
      if (p.status === 'Exposed') return 0;
      return p.isMayor ? 2 : 1;
    };

    const wolfPower = wolves.reduce((sum, p) => sum + getPower(p), 0);
    const humanPower = humans.reduce((sum, p) => sum + getPower(p), 0);

    if (wolfPower === 0 && wolves.length === 0 && players.some(p => p.role === 'WEREWOLF')) {
      // Villagers win if all wolves are gone
      this.gameStatus.update(status => ({ ...status, winner: 'VILLAGERS', phase: 'GAMEOVER' }));
      this.addLog('INFO', '🎉 VICTORY! All werewolves have been eliminated. The Village is safe.', []);
      return;
    }

    if (wolfPower >= humanPower && alivePlayers.length > 0) {
      // Werewolves win if they have equal or more voting power than humans
      this.gameStatus.update(status => ({ ...status, winner: 'WEREWOLVES', phase: 'GAMEOVER' }));
      this.addLog('INFO', '🐺 VICTORY! The werewolves have controlled the voting power of the village.', []);
      return;
    }
  }

  public assignMayor(playerId: string) {
    // Clear existing mayor
    this.playerList.update(players =>
      players.map(p => ({ ...p, isMayor: p.id === playerId }))
    );
    const player = this.playerList.value.find(p => p.id === playerId);
    if (player) {
      this.addLog('SPECIAL', `${player.name} has been elected as the new Mayor!`, [playerId]);
    }
    this.gameStatus.update(status => ({ ...status, phase: 'DAY' }));
    this.checkWinConditions();
  }

  // Eliminate a player (Night phase / manual). killedBy defaults to 'Night'.
  public eliminatePlayer(playerId: string, killedBy: 'Night' | 'Village' = 'Night') {
    const player = this.playerList.value.find(p => p.id === playerId);
    if (!player || !player.isAlive) return;

    this.playerList.update(players =>
      players.map(p => p.id === playerId ? { ...p, isAlive: false, status: 'Alive' } : p)
    );

    this.addLog('NIGHT_DEATH', `${player.name} was eliminated during the night.`, [playerId]);

    if (player.role === 'HUNTER') {
      this.gameStatus.update(status => ({ ...status, phase: 'REVENGE', pendingHunterId: player.id }));
      this.addLog('ABILITY', `${player.name} (Hunter) triggers Last Stand!`, [playerId]);
    } else {
      this.checkWinConditions();
    }
  }

  // Revive a player (manual override)
  public revivePlayer(playerId: string) {
    this.playerList.update(players =>
      players.map(p => p.id === playerId ? { ...p, isAlive: true, status: 'Alive' } : p)
    );
    const player = this.playerList.value.find(p => p.id === playerId);
    if (player) this.addLog('INFO', `${player.name} was revived by the moderator.`, [playerId]);
  }

  // ── Voting & Execution ────────────────────────────────────────────────────

  /**
   * Executes a player following a village vote. Handles role-specific effects:
   * - IDIOT: stays alive, gets "Exposed" status
   * - HUNTER: triggers Hunter Revenge phase
   * - ELDER: triggers Village Curse (if killed by village)
   */
  public voteExecution(playerId: string) {
    const player = this.playerList.value.find(p => p.id === playerId);
    if (!player) return;

    if (player.role === 'IDIOT' && player.status !== 'Exposed') {
      // Idiot survives their first execution — gets Exposed, vote weight → 0
      this.playerList.update(players =>
        players.map(p => p.id === playerId ? { ...p, status: 'Exposed' } : p)
      );
      this.addLog('SPECIAL', `${player.name} (Idiot) survived execution! They are now Exposed — their votes count for nothing.`, [playerId]);
      return;
    }

    if (player.role === 'ELDER') {
      // Village kills the Elder → curse: all special powers lost
      this.playerList.update(players =>
        players.map(p => p.id === playerId ? { ...p, isAlive: false, status: 'Alive' } : p)
      );
      this.gameStatus.update(status => ({ ...status, villageCursed: true }));
      this.addLog('EXECUTION', `${player.name} (Elder) was executed by the village.`, [playerId]);
      this.addLog('SPECIAL', `Village Curse activated! The Seer, Bodyguard, and Witch lose their powers for the rest of the game.`, [playerId]);
      return;
    }

    // Standard execution
    this.playerList.update(players =>
      players.map(p => p.id === playerId ? { ...p, isAlive: false } : p)
    );
    this.addLog('EXECUTION', `${player.name} (${player.role}) was executed by the village.`, [playerId]);

    if (player.role === 'HUNTER') {
      this.gameStatus.update(status => ({ ...status, phase: 'REVENGE', pendingHunterId: player.id }));
      this.addLog('ABILITY', `${player.name} (Hunter) triggers Last Stand!`, [playerId]);
    } else {
      this.checkWinConditions();
    }
  }

  public setTieBreakRule(rule: TieBreakRule) {
    this.gameStatus.update(status => ({ ...status, tieBreakRule: rule }));
  }

  public toggleMayor(playerId: string) {
    this.playerList.update(players =>
      players.map(p => p.id === playerId ? { ...p, isMayor: !p.isMayor } : p)
    );
    const player = this.playerList.value.find(p => p.id === playerId);
    if (player) {
      this.addLog('SPECIAL', `${player.name} is ${player.isMayor ? 'now' : 'no longer'} the Mayor.`, [playerId]);
    }
  }

  // ── Night Resolution ──────────────────────────────────────────────────────

  public resolveNight() {
    const actions = this.nightActions.value;
    let playersToKill: string[] = [];

    const bodyguardProtect = actions.find(a => a.type === 'BODYGUARD_PROTECT')?.targetId;
    const werewolfKills = actions.filter(a => a.type === 'WEREWOLF_KILL').map(a => a.targetId);
    const witchSave = actions.find(a => a.type === 'WITCH_SAVE')?.targetId;
    const witchKills = actions.filter(a => a.type === 'WITCH_KILL').map(a => a.targetId);

    werewolfKills.forEach(targetId => {
      if (targetId !== bodyguardProtect && targetId !== witchSave) {
        playersToKill.push(targetId);
      }
    });

    witchKills.forEach(targetId => {
      if (!playersToKill.includes(targetId)) {
        playersToKill.push(targetId);
      }
    });

    // Apply deaths
    this.playerList.update(players =>
      players.map(p =>
        playersToKill.includes(p.id) ? { ...p, isAlive: false } : p
      )
    );

    // Log each kill
    const allPlayers = this.playerList.value;
    playersToKill.forEach(id => {
      const p = allPlayers.find(pl => pl.id === id);
      if (p) this.addLog('NIGHT_DEATH', `${p.name} (${p.role}) was killed during the night.`, [id]);
    });

    if (bodyguardProtect) {
      const protected_ = allPlayers.find(p => p.id === bodyguardProtect);
      if (protected_ && werewolfKills.includes(bodyguardProtect)) {
        this.addLog('ABILITY', `${protected_.name} was protected by the Bodyguard.`, [bodyguardProtect]);
      }
    }

    const hunterKilled = playersToKill.find(id => this.playerList.value.find(p => p.id === id)?.role === 'HUNTER');

    this.gameStatus.update(status => ({
      ...status,
      phase: hunterKilled ? 'REVENGE' : 'DAY',
      dayCount: status.dayCount + 1,
      lastProtectedId: bodyguardProtect || null,
      pendingHunterId: hunterKilled || null,
    }));

    if (hunterKilled) {
      const hunter = allPlayers.find(p => p.id === hunterKilled);
      if (hunter)      this.addLog('ABILITY', `${hunter.name} (Hunter) triggers Last Stand!`, [hunterKilled]);
    } else {
      this.checkWinConditions();
    }

    this.nightActions.set([]);
  }

  // ── Hunter Revenge ────────────────────────────────────────────────────────

  public executeHunterRevenge(targetId: string | null) {
    const previousPhase = this.gameLogs.value.find(l => l.type === 'ABILITY' && l.message.includes('Last Stand'))?.phase ?? 'DAY';
    this.gameStatus.update(status => ({ ...status, phase: 'DAY', pendingHunterId: null }));

    if (targetId) {
      const player = this.playerList.value.find(p => p.id === targetId);
      this.playerList.update(players =>
        players.map(p => p.id === targetId ? { ...p, isAlive: false } : p)
      );
      if (player) this.addLog('ABILITY', `Hunter shoots ${player.name} with their dying breath.`, [targetId]);
    } else {
      this.addLog('INFO', 'Hunter chose to spare the village.', []);
    }

    this.checkWinConditions();
  }

  // ── Night Actions ─────────────────────────────────────────────────────────

  public addNightAction(action: Omit<NightAction, 'id' | 'resolved'>) {
    this.nightActions.update(actions => [
      ...actions,
      { ...action, id: Math.random().toString(36).substring(7), resolved: false }
    ]);
  }

  public useWitchPotion(type: 'HEAL' | 'POISON') {
    this.gameStatus.update(status => ({
      ...status,
      witchState: {
        ...status.witchState,
        hasHeal: type === 'HEAL' ? false : status.witchState.hasHeal,
        hasPoison: type === 'POISON' ? false : status.witchState.hasPoison,
      }
    }));
  }

  // ── Game Control ──────────────────────────────────────────────────────────

  public setPhase(phase: GameStatus['phase']) {
    this.gameStatus.update(status => ({ ...status, phase }));
  }

  public resetGame() {
    this.gameStatus.set({
      phase: 'LOBBY',
      dayCount: 0,
      winner: null,
      witchState: { hasHeal: true, hasPoison: true },
      lastProtectedId: null,
      pendingHunterId: null,
      tieBreakRule: 'NO_EXECUTION',
      villageCursed: false,
    });
    this.playerList.update(players => players.map(p => ({ ...p, isAlive: true, status: 'Alive' as const, isMayor: false })));
    this.nightActions.set([]);
    this.gameLogs.set([]);
  }
}

// Singleton
export const gameStore = new GameStore();
