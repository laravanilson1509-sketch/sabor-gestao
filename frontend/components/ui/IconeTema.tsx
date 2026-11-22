import { Egg, Flag, Flame, Gift, HandHeart, Heart, PartyPopper, Pizza, Ribbon, Sandwich, Sparkles, Sun, Tag, TreePine, type LucideIcon } from 'lucide-react';
import type { IconeTema as Nome } from '@/lib/temasDatas';

const ICONES: Record<Nome, LucideIcon> = {
  laco: Ribbon,
  presente: Gift,
  coracao: Heart,
  arvore: TreePine,
  ovo: Egg,
  festa: PartyPopper,
  chama: Flame,
  pizza: Pizza,
  sanduiche: Sandwich,
  bandeira: Flag,
  estrela: Sparkles,
  etiqueta: Tag,
  maos: HandHeart,
  sol: Sun,
};

export default function IconeTema({ nome, size = 18, className, color }: { nome: Nome; size?: number; className?: string; color?: string }) {
  const Icone = ICONES[nome] ?? Sparkles;
  return <Icone size={size} strokeWidth={1.75} aria-hidden className={className} color={color} />;
}
