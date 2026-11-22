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

export const ABAS_FINANCEIRO = [
  { id: 'painel', rotulo: 'Painel' },
  { id: 'pagar', rotulo: 'Contas a pagar' },
  { id: 'receber', rotulo: 'Contas a receber' },
  { id: 'fluxo', rotulo: 'Fluxo de caixa' },
  { id: 'dre', rotulo: 'DRE (lucro)' },
  { id: 'precos', rotulo: 'Preços e custos fixos' },
] as const;
export type AbaFinanceiro = (typeof ABAS_FINANCEIRO)[number]['id'];

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
    filhos: [
      { href: '/cadastros/pratos', rotulo: 'Pratos' },
      { href: '/cadastros/produtos', rotulo: 'Produtos do estoque' },
      { href: '/cadastros/fichas-tecnicas', rotulo: 'Fichas técnicas' },
      { href: '/cadastros/fornecedores', rotulo: 'Fornecedores' },
      { href: '/cadastros/clientes', rotulo: 'Clientes' },
      { href: '/cadastros/funcionarios', rotulo: 'Funcionários' },
      { href: '/cadastros/motoboys', rotulo: 'Motoboys' },
    ],
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
  {
    href: '/financeiro',
    rotulo: 'Financeiro',
    icone: TrendingUp,
    filhos: ABAS_FINANCEIRO.map((a) => ({ href: '/financeiro/' + a.id, rotulo: a.rotulo })),
  },
];

export const tituloDaRota = (caminho: string) => MENU.find((i) => caminho.startsWith(i.href))?.rotulo || '';
