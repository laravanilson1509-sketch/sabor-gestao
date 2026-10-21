'use client';

// Tela inicial: fica sempre montada no fundo. As outras telas abrem por cima
// dela (veja o layout), então nada aqui se perde ao navegar.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { SupabaseClient } from '@supabase/supabase-js';
import Logo from './Logo';

const DICAS = [
  { titulo: 'Cadastrar um prato', texto: 'Monte a ficha técnica e defina o preço de venda.', href: '/cadastros/pratos', botao: 'Cadastrar' },
  { titulo: 'Lançar um pedido', texto: 'Abra uma mesa ou venda no balcão e envie para a produção.', href: '/pdv', botao: 'Abrir PDV' },
  { titulo: 'Configurar impressoras', texto: 'Defina onde sai a comanda da cozinha, do bar e a conta.', href: '/impressao', botao: 'Configurar' },
  { titulo: 'Abrir o caixa', texto: 'Informe o troco inicial para receber os pagamentos.', href: '/caixa', botao: 'Abrir caixa' },
  { titulo: 'Registrar uma compra', texto: 'Lance a nota do fornecedor e atualize o estoque.', href: '/compras/nova', botao: 'Nova compra' },
  { titulo: 'Acompanhar o financeiro', texto: 'Veja faturamento, contas a pagar e o resultado do mês.', href: '/financeiro', botao: 'Ver painel' },
];

function nomeDoEmail(email: string | undefined | null) {
  const base = (email || '').split('@')[0].split(/[._-]/)[0];
  return base ? base.charAt(0).toUpperCase() + base.slice(1) : '';
}

function Ilustracao() {
  return (
    <svg viewBox="0 0 320 230" className="w-full h-auto" role="img" aria-label="Ilustração de gráficos">
      <rect x="20" y="150" width="34" height="60" rx="5" fill="#0E6B7E" opacity="0.25" />
      <rect x="64" y="120" width="34" height="90" rx="5" fill="#0E6B7E" opacity="0.45" />
      <rect x="108" y="85" width="34" height="125" rx="5" fill="#0E6B7E" />
      <path d="M20 118 L66 92 L108 100 L168 48" fill="none" stroke="#E3B341" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M158 44 L172 46 L168 60" fill="none" stroke="#E3B341" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="238" cy="118" r="62" fill="#DCEEF2" />
      <path d="M238 118 L238 56 A62 62 0 0 1 297 99 Z" fill="#E3B341" />
      <path d="M238 118 L297 99 A62 62 0 0 1 252 179 Z" fill="#0A4E5C" />
      <circle cx="238" cy="118" r="26" fill="#fff" />
      <path d="M227 124 L226 111 L232 116 L238 107 L244 116 L250 111 L249 124 Z" fill="#E3B341" />
      <line x1="10" y1="212" x2="310" y2="212" stroke="#C9D3D8" strokeWidth="2" />
    </svg>
  );
}

export default function TelaInicio({ supabase }: { supabase: SupabaseClient }) {
  const [nome, setNome] = useState('');
  const [empresa, setEmpresa] = useState('');

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setNome(nomeDoEmail(data.user?.email)));
    supabase
      .from('pdv_config')
      .select('nome_estabelecimento')
      .eq('unidade_id', process.env.NEXT_PUBLIC_UNIDADE_ID!)
      .maybeSingle()
      .then(({ data }) => setEmpresa(data?.nome_estabelecimento || ''));
  }, []);

  return (
    <div className="min-h-[calc(100vh-3.5rem)] md:min-h-screen bg-white">
      {/* Faixa superior */}
      <div className="flex items-center justify-between gap-3 border-b border-[#E6ECEF] px-5 md:px-8 h-16">
        <div className="min-w-0">
          <p className="text-xs font-semibold tracking-wide text-[#16252B] truncate">
            {(empresa || 'Império').toUpperCase()}
          </p>
          <p className="text-xs text-[#8FA0A8]">Painel inicial</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden sm:block text-xs font-semibold uppercase tracking-wide text-[#5B6B73]">
            {nome || 'Usuário'}
          </span>
          <span className="h-9 w-9 rounded-full bg-[#0E6B7E] text-white flex items-center justify-center text-sm font-bold">
            {(nome || 'U').charAt(0)}
          </span>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-5 md:px-8 py-8 md:py-10">
        {/* Boas-vindas */}
        <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] gap-8 items-center">
          <div>
            <h1 className="text-4xl md:text-5xl font-bold text-[#16252B]">
              <span className="italic font-normal text-[#0E6B7E]" style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}>
                Olá,
              </span>{' '}
              {nome || 'bem-vindo'}!
            </h1>
            <p className="mt-5 text-2xl md:text-3xl leading-snug text-[#8FA0A8]">
              O Império foi criado para
              <br />
              <span className="relative inline-block px-3 text-[#16252B]">
                você voar
                <svg viewBox="0 0 150 46" preserveAspectRatio="none" className="absolute inset-0 w-full h-full" aria-hidden>
                  <ellipse cx="75" cy="23" rx="72" ry="19" fill="none" stroke="#E3B341" strokeWidth="2.5" />
                </svg>
              </span>{' '}
              no dia a dia!
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/pdv" className="bg-[#0E6B7E] hover:bg-[#0B5A6A] text-white px-5 py-3 rounded-lg text-sm font-medium transition">
                Abrir o PDV
              </Link>
              <Link href="/cozinha" className="px-5 py-3 rounded-lg border border-[#DCE3E7] bg-white text-[#2B3C44] text-sm font-medium hover:bg-[#F1F5F7] transition">
                Ver a cozinha
              </Link>
            </div>
          </div>
          <div className="hidden md:block max-w-md justify-self-center w-full">
            <Ilustracao />
          </div>
        </div>

        {/* Dicas */}
        <div className="mt-10 border-t border-[#E6ECEF] pt-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#5B6B73] mb-4">Dicas para você</p>
          <div className="flex gap-4 overflow-x-auto pb-3 snap-x">
            {DICAS.map((d, k) => (
              <div key={d.titulo} className="snap-start shrink-0 w-64 border-l-2 border-[#0E6B7E]/30 pl-4 pr-2 py-1">
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border-2 border-[#0E6B7E] text-xs font-bold text-[#0E6B7E]">
                  {k + 1}
                </span>
                <p className="mt-3 text-base font-semibold text-[#16252B]">{d.titulo}</p>
                <p className="mt-1 text-sm text-[#5B6B73] min-h-[3.5rem]">{d.texto}</p>
                <Link
                  href={d.href}
                  className="mt-3 block text-center text-sm font-medium text-[#2B3C44] bg-[#F1F5F7] hover:bg-[#DCEEF2] rounded-lg py-2 transition"
                >
                  {d.botao}
                </Link>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-8 flex justify-center opacity-[0.12] select-none" aria-hidden>
          <Logo tamanho={44} />
        </div>
      </div>
    </div>
  );
}
