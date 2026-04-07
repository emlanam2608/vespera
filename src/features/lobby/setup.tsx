import { useState } from 'react';
import { useStream } from '@/logic/antigravity/stream';
import { gameStore } from '@/logic/game-store';
import { RoleType, ROLE_WEIGHTS } from '@/types';
import { UserPlus, Shuffle, Trash2, RotateCcw, Play, AlertCircle, Info, Sparkles, Zap, Eye, Heart, Shield, Target, Crown, AlertTriangle, Flame, User as UserIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';

function getRoleIcon(role: string) {
  switch (role) {
    case 'WEREWOLF': return <Zap className="w-3.5 h-3.5 text-red-500" />;
    case 'SEER': return <Eye className="w-3.5 h-3.5 text-purple-400" />;
    case 'WITCH': return <Heart className="w-3.5 h-3.5 text-green-400" />;
    case 'BODYGUARD': return <Shield className="w-3.5 h-3.5 text-blue-400" />;
    case 'HUNTER': return <Target className="w-3.5 h-3.5 text-orange-400" />;
    case 'MAYOR': return <Crown className="w-3.5 h-3.5 text-yellow-400" />;
    case 'IDIOT': return <AlertTriangle className="w-3.5 h-3.5 text-pink-400" />;
    case 'ELDER': return <Flame className="w-3.5 h-3.5 text-amber-400" />;
    case 'CUPID': return <Heart className="w-3.5 h-3.5 text-pink-400" />;
    default: return <UserIcon className="w-3.5 h-3.5 text-muted-foreground" />;
  }
}

export function LobbySetup() {
  const players = useStream(gameStore.playerList);
  const [newName, setNewName] = useState('');
  const router = useRouter();

  const handleAddPlayer = (e: React.FormEvent) => {
    e.preventDefault();
    if (newName.trim()) {
      gameStore.addPlayer(newName.trim());
      setNewName('');
    }
  };

  const AVAILABLE_ROLES: RoleType[] = [
    'WEREWOLF', 'WEREWOLF', 
    'SEER', 'WITCH', 'BODYGUARD', 
    'HUNTER', 'VILLAGER', 'VILLAGER', 'VILLAGER', 'VILLAGER'
  ];

  const handleRandomize = () => {
    const total = players.length;
    if (total === 0) return;

    // 1. Base Wolf Count (~1 per 3.5 players)
    const wolfCount = Math.max(1, Math.floor(total / 3.5));
    let currentRoles: RoleType[] = Array(wolfCount).fill('WEREWOLF');

    // 2. Mandatory Roles (Large games need a Seer)
    if (total >= 5 && currentRoles.length < total) {
      currentRoles.push('SEER');
    }

    // 3. Fill the rest with Villagers
    while (currentRoles.length < total) {
      currentRoles.push('VILLAGER');
    }

    // 4. Greedy Balancing Logic: Upgrade Villagers to Power Roles to reach the "Green Zone" (-2 to +2)
    const calculateScore = (rs: RoleType[]) => rs.reduce((s, r) => s + (ROLE_WEIGHTS[r] || 0), 0);
    const powerPool: RoleType[] = ['WITCH', 'BODYGUARD', 'HUNTER', 'ELDER', 'IDIOT', 'CUPID'];
    const shuffledPower = [...powerPool].sort(() => Math.random() - 0.5);
    
    let attempts = 0;
    // Aim for score >= -2 (Village doesn't get steamrolled)
    while (calculateScore(currentRoles) < -2 && attempts < shuffledPower.length) {
      const vIndex = currentRoles.indexOf('VILLAGER');
      if (vIndex !== -1 && attempts < shuffledPower.length) {
        currentRoles[vIndex] = shuffledPower[attempts];
      }
      attempts++;
    }

    gameStore.randomizeRoles(currentRoles);
  };

  const handleStartGame = () => {
    gameStore.setPhase('DAY');
    router.push('/');
  };

  return (
    <div className="bg-card border-2 border-border rounded-xl p-6 shadow-sm max-w-5xl mx-auto mt-12">
      <div className="flex items-center justify-between mb-8 pb-4 border-b border-border">
        <h2 className="text-3xl font-black flex items-center gap-2 uppercase tracking-tighter">
          Match Setup
        </h2>
        {players.length > 0 && <BalanceIndicator players={players} />}
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div>
          <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-4">Add Players</h3>
          <form onSubmit={handleAddPlayer} className="flex gap-2 mb-4">
            <input 
              type="text" 
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="Player Name..."
              className="flex-1 bg-background border border-border rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-primary transition-colors"
            />
            <button 
              type="submit"
              disabled={!newName.trim()}
              className="bg-primary text-primary-foreground px-4 py-2 rounded-lg font-bold hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              <UserPlus className="w-5 h-5" />
            </button>
          </form>

          <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
            {players.map((p, idx) => (
              <div key={p.id} className="group flex items-center gap-4 p-4 rounded-xl border-2 border-border bg-card hover:border-primary/50 transition-all">
                <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center font-black text-xs text-muted-foreground shrink-0">
                  {idx + 1}
                </div>
                
                <div className="flex-1 min-w-0">
                   <p className="font-black text-sm truncate uppercase tracking-tight">{p.name}</p>
                   <div className="flex items-center gap-2 mt-1">
                      {getRoleIcon(p.role)}
                      <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{p.role === 'WEREWOLF' ? 'Werewolf' : p.role}</span>
                   </div>
                </div>

                <div className="flex gap-2 items-center">
                  <select 
                    value={p.role} 
                    onChange={e => gameStore.assignRole(p.id, e.target.value as RoleType)}
                    className="bg-muted text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg border-none cursor-pointer hover:bg-muted/80 transition-colors"
                  >
                    <option value="VILLAGER">Villager</option>
                    <option value="WEREWOLF">Werewolf</option>
                    <option value="SEER">Seer</option>
                    <option value="WITCH">Witch</option>
                    <option value="BODYGUARD">Bodyguard</option>
                    <option value="HUNTER">Hunter</option>
                    <option value="MAYOR">Mayor</option>
                    <option value="IDIOT">Idiot</option>
                    <option value="ELDER">Elder</option>
                    <option value="CUPID">Cupid</option>
                  </select>
                  <button 
                    type="button"
                    onClick={() => gameStore.removePlayer(p.id)}
                    className="p-2 text-destructive opacity-30 group-hover:opacity-100 hover:bg-destructive/10 rounded-lg transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
            {players.length === 0 && (
              <p className="text-sm text-muted-foreground italic text-center py-4">No players added yet.</p>
            )}
          </div>
        </div>

        <div>
          <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-4">Actions</h3>
          <div className="space-y-3">
            <button 
              onClick={handleRandomize}
              disabled={players.length === 0}
              className="w-full border border-border px-4 py-3 rounded-lg font-bold hover:bg-muted transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Shuffle className="w-4 h-4" /> Randomize Roles
            </button>
            
            <button 
              onClick={() => {
                if(window.confirm('Are you sure you want to completely clear players and reset the setup?')) {
                   gameStore.resetGame();
                   gameStore.clearPlayers();
                }
              }}
              className="w-full border border-destructive/30 text-destructive px-4 py-3 rounded-lg font-bold hover:bg-destructive/10 transition-colors flex items-center justify-center gap-2"
            >
              <RotateCcw className="w-4 h-4" /> Clear All Data & Reset
            </button>
            
            <div className="pt-8 mt-8 border-t border-border">
              <button 
                onClick={handleStartGame}
                disabled={players.length < 3}
                className="w-full bg-primary text-primary-foreground px-4 py-4 rounded-lg font-bold hover:opacity-90 transition-opacity flex items-center justify-center gap-2 disabled:opacity-50 uppercase tracking-tight text-lg shadow-lg shadow-primary/20"
              >
                <Play className="w-6 h-6 fill-current" /> Start Game
              </button>
              {players.length < 3 && (
                <p className="text-xs text-muted-foreground text-center mt-2">Add at least 3 players to start</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function BalanceIndicator({ players }: { players: any[] }) {
  const score = players.reduce((sum, p) => sum + (ROLE_WEIGHTS[p.role as RoleType] || 0), 0);
  
  let status: 'balanced' | 'village' | 'wolf' = 'balanced';
  if (score > 2) status = 'village';
  if (score < -2) status = 'wolf';

  const suggestions: RoleType[] = [];
  if (score < -2) {
    if (Math.abs(score) >= 5) suggestions.push('SEER', 'WITCH');
    else suggestions.push('VILLAGER', 'BODYGUARD');
  } else if (score > 2) {
    if (score >= 6) suggestions.push('WEREWOLF');
    else suggestions.push('WEREWOLF'); // Keep it simple
  }

  return (
    <div className="flex flex-col items-end gap-2 animate-in fade-in slide-in-from-right-4 duration-500">
      <div className="flex items-center gap-3">
        <div className="text-right">
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-50 mb-0.5">Game Balance</p>
          <p className={`text-xl font-black ${
            status === 'balanced' ? 'text-green-500' : 
            status === 'village' ? 'text-blue-400' : 'text-red-500'
          }`}>
            {score > 0 ? `+${score}` : score} 
            <span className="text-[10px] ml-1.5 opacity-70">
              {status === 'balanced' ? 'BALANCED' : status === 'village' ? 'VILLAGE ADV.' : 'WOLF ADV.'}
            </span>
          </p>
        </div>
        <div className="h-10 w-1 rounded-full bg-border overflow-hidden flex flex-col-reverse">
           <div 
             className={`w-full transition-all duration-700 ${
               status === 'balanced' ? 'bg-green-500' : 
               status === 'village' ? 'bg-blue-400' : 'bg-red-500'
             }`} 
             style={{ height: `${Math.min(Math.abs(score) * 10, 100)}%` }}
           />
        </div>
      </div>
      
      {suggestions.length > 0 && (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-muted rounded-lg border border-border mt-1">
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Try adding:</span>
          <div className="flex gap-1.5">
            {suggestions.map(s => (
              <span key={s} className="text-[10px] font-bold bg-background px-1.5 py-0.5 rounded border border-border">{s}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
