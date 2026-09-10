import { Crown, Eye, Flame, Heart, MoonStar, Shield, Sparkles, Target, UserRound, WandSparkles } from 'lucide-react';
import type { RoleType } from '@/types';

const icons = { VILLAGER: UserRound, WEREWOLF: MoonStar, SEER: Eye, HUNTER: Target, WITCH: WandSparkles, CUPID: Heart, BODYGUARD: Shield, MAYOR: Crown, IDIOT: Sparkles, ELDER: Flame } satisfies Record<RoleType, typeof UserRound>;

export function RoleIcon({ role, size = 18 }: { role: RoleType; size?: number }) {
  const Icon = icons[role];
  return <Icon aria-hidden="true" size={size} strokeWidth={1.8} />;
}
