// lib/navegacao.ts — única lista do menu: o menu lateral e o título da barra do topo leem daqui.

import {
  Bike,
  BookUser,
  ChefHat,
  MessageCircle,
  Package,
  Printer,
  ShoppingBasket,
  Store,
  TrendingUp,
  Wallet,
  type LucideIcon,
} from 'lucide-react';

export type FilhoMenu = { href: string; rotulo: string };
// filhos: atalhos que aparecem no painel flutuante ao passar o mouse (ou focar) no item
export type ItemMenu = { href: string; rotulo: string; icone: LucideIcon; filhos?: FilhoMenu[] };

export const MENU: ItemMenu[] = [
  { href: '/whatsapp', rotulo: 'WhatsApp', icone: MessageCircle },
  {
    href: '/estoque',
    rotulo: 'Estoque',
    icone: Package,
  },
  { href: '/pdv', rotulo: 'PDV', icone: Store },
  { href: '/cozinha', rotulo: 'Cozinha', icone: ChefHat },
  { href: '/caixa', rotulo: 'Caixa', icone: Wallet },
  { href: '/impressao', rotulo: 'Impressão', icone: Printer },
  {
    href: '/cadastros',
    rotulo: 'Cadastros',
    icone: BookUser,
  },
  { href: '/delivery', rotulo: 'Delivery', icone: Bike },
  {
    href: '/compras',
    rotulo: 'Compras',
    icone: ShoppingBasket,
    filhos: [
      { href: '/compras', rotulo: 'Solicitações' },
      { href: '/compras/nova', rotulo: 'Nova solicitação' },
      { href: '/compras/precos', rotulo: 'Histórico de preços' },
    ],
  },
  { href: '/financeiro', rotulo: 'Financeiro', icone: TrendingUp },
];

export const tituloDaRota = (caminho: string) => MENU.find((i) => caminho.startsWith(i.href))?.rotulo || '';
