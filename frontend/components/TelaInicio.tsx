'use client';

// Tela inicial: fica sempre montada no fundo. As outras telas abrem por cima
// dela (veja o layout), então nada aqui se perde ao navegar.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { SupabaseClient } from '@supabase/supabase-js';
import Logo from './Logo';

const traco = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

const RECURSOS = [
  {
    titulo: 'Pedidos e comandas',
    texto: 'Mais agilidade no atendimento',
    href: '/pdv',
    icone: (
      <>
        <path d="M6 15 a6 6 0 0 1 12 0 v2 H6 Z" {...traco} />
        <path d="M8 19 h8 M12 9 v-2" {...traco} />
      </>
    ),
  },
  {
    titulo: 'Financeiro',
    texto: 'Controle total do seu negócio',
    href: '/financeiro',
    icone: (
      <>
        <path d="M4 19 h16" {...traco} />
        <path d="M5 15 l4 -4 3 3 6 -7" {...traco} />
        <path d="M14 7 h4 v4" {...traco} />
      </>
    ),
  },
  {
    titulo: 'Equipe',
    texto: 'Organização e desempenho',
    href: '/cadastros/funcionarios',
    icone: (
      <>
        <circle cx="12" cy="9" r="3" {...traco} />
        <circle cx="5.5" cy="10.5" r="2" {...traco} />
        <circle cx="18.5" cy="10.5" r="2" {...traco} />
        <path d="M6.5 19 a5.5 5 0 0 1 11 0" {...traco} />
      </>
    ),
  },
  {
    titulo: 'Estoque',
    texto: 'Nunca falte o que você precisa',
    href: '/estoque',
    icone: (
      <>
        <path d="M4 9 l2 -4 h12 l2 4 v1 a2 2 0 0 1 -4 0 a2 2 0 0 1 -4 0 a2 2 0 0 1 -4 0 a2 2 0 0 1 -4 0 Z" {...traco} />
        <path d="M5.5 12 v7 h13 v-7 M10 19 v-4 h4 v4" {...traco} />
      </>
    ),
  },
  {
    titulo: 'Relatórios',
    texto: 'Decisões com base em dados',
    href: '/financeiro',
    icone: (
      <>
        <rect x="6" y="3.5" width="12" height="17" rx="2" {...traco} />
        <path d="M9 16 v-3 M12 16 v-6 M15 16 v-4" {...traco} />
      </>
    ),
  },
];

const DICAS = [
  { titulo: 'Cadastrar um prato', texto: 'Monte a ficha técnica e defina o preço de venda.', href: '/cadastros/pratos', botao: 'Cadastrar' },
  { titulo: 'Lançar um pedido', texto: 'Abra uma mesa ou venda no balcão e envie para a produção.', href: '/pdv', botao: 'Abrir PDV' },
  { titulo: 'Configurar impressoras', texto: 'Defina onde sai a comanda da cozinha, do bar e a conta.', href: '/impressao', botao: 'Configurar' },
  { titulo: 'Abrir o caixa', texto: 'Informe o troco inicial para receber os pagamentos.', href: '/caixa', botao: 'Abrir caixa' },
  { titulo: 'Registrar uma compra', texto: 'Lance a nota do fornecedor e atualize o estoque.', href: '/compras/nova', botao: 'Nova compra' },
  { titulo: 'Acompanhar o financeiro', texto: 'Veja faturamento, contas a pagar e o resultado do mês.', href: '/financeiro', botao: 'Ver painel' },
];

function nomeDoEmail(email: string | undefined | null) {
  const base = (email || '').split('@')[0].split(/[._-]/)[0].replace(/\d+/g, '');
  return base ? base.charAt(0).toUpperCase() + base.slice(1) : '';
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
    <div className="relative min-h-[calc(100vh-3.5rem)] md:min-h-screen bg-white overflow-hidden">
      {/* Formas decorativas dos cantos */}
      <svg aria-hidden className="absolute -top-10 -right-10 w-[26rem] max-w-[70%] pointer-events-none" viewBox="0 0 400 300">
        <path d="M400 0 V230 C330 250 250 190 240 120 C232 60 180 30 120 0 Z" fill="#DCEEF2" />
        <path d="M400 0 V160 C350 170 300 130 292 90 C286 55 250 25 215 0 Z" fill="#0E6B7E" opacity="0.9" />
        <path d="M120 0 C180 30 232 60 240 120 C250 190 330 250 400 230" fill="none" stroke="#E3B341" strokeWidth="3" />
      </svg>
      <svg aria-hidden className="absolute -bottom-12 -right-12 w-[24rem] max-w-[60%] pointer-events-none" viewBox="0 0 400 260">
        <path d="M400 260 V60 C330 40 260 90 230 150 C210 195 150 240 100 260 Z" fill="#DCEEF2" />
        <path d="M400 260 V130 C360 120 320 150 300 190 C285 220 250 245 225 260 Z" fill="#0E6B7E" opacity="0.9" />
        <path d="M400 60 C330 40 260 90 230 150 C210 195 150 240 100 260" fill="none" stroke="#E3B341" strokeWidth="3" />
      </svg>

      <div className="relative max-w-6xl mx-auto px-5 md:px-10 py-8 md:py-10">
        <div className="flex items-start justify-between gap-4">
          <Logo tamanho={52} tagline />
          {(empresa || nome) && (
            <p className="hidden md:block text-xs text-right text-[#5B6B73] relative z-10">
              {empresa && <span className="block font-semibold text-[#16252B]">{empresa}</span>}
              {nome && <span>Olá, {nome}</span>}
            </p>
          )}
        </div>

        <div className="mt-10 md:mt-14 grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-10 items-center">
          <div>
            <h1
              className="font-normal leading-[1.1] text-[#0A4E5C]"
              style={{ fontFamily: "'Great Vibes', 'Brush Script MT', cursive" }}
            >
              <span className="block text-5xl md:text-7xl">Olá{nome ? ', ' + nome : ''}</span>
              <span className="block text-5xl md:text-7xl mt-1">
                Seja{' '}
                <span className="relative inline-block text-[#C99A1E]">
                  bem-vindo!
                  {/* traço fino de assinatura */}
                  <svg viewBox="0 0 320 24" preserveAspectRatio="none" className="absolute left-0 -bottom-3 w-full h-5" aria-hidden>
                    <path
                      d="M4 16 C50 6 110 4 170 10 C215 15 262 12 316 4"
                      fill="none"
                      stroke="#E3B341"
                      strokeWidth="1.4"
                      strokeLinecap="round"
                    />
                    <path d="M40 20 C110 14 200 14 270 18" fill="none" stroke="#E3B341" strokeWidth="0.8" strokeLinecap="round" opacity="0.7" />
                  </svg>
                </span>
              </span>
            </h1>
            <p className="mt-10 text-lg md:text-xl font-light text-[#2B3C44] max-w-lg">
              Sua operação no restaurante ou bar mais organizada, prática e lucrativa.
            </p>
            <p className="mt-3 text-base font-light text-[#5B6B73] max-w-lg">
              Vamos juntos transformar o seu negócio em grandes resultados!
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/pdv"
                className="inline-flex items-center gap-2 bg-[#0E6B7E] hover:bg-[#0B5A6A] !text-white px-7 py-3 rounded-full text-sm font-medium transition"
              >
                Acessar o sistema <span aria-hidden>→</span>
              </Link>
              <a
                href="#como-funciona"
                className="inline-flex items-center gap-2 px-7 py-3 rounded-full border border-[#0E6B7E]/40 text-[#0A4E5C] text-sm font-medium hover:bg-[#F1F8FA] transition"
              >
                <span aria-hidden>▷</span> Ver como funciona
              </a>
            </div>
          </div>

          <ul className="relative z-10 space-y-0 lg:pl-6">
            {RECURSOS.map((r) => (
              <li key={r.titulo} className="border-b border-[#DCE3E7] last:border-0">
                <Link href={r.href} className="flex items-center gap-4 py-4 group">
                  <span className="text-[#0E6B7E]">
                    <svg viewBox="0 0 24 24" width="34" height="34" aria-hidden>
                      {r.icone}
                    </svg>
                  </span>
                  <span>
                    <span className="block text-base font-bold text-[#16252B] group-hover:text-[#0E6B7E] transition">
                      {r.titulo}
                    </span>
                    <span className="block text-sm text-[#5B6B73]">{r.texto}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div id="como-funciona" className="relative z-10 mt-14 border-t border-[#E6ECEF] pt-6 scroll-mt-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#5B6B73] mb-4">Dicas para você começar</p>
          <div className="flex gap-4 overflow-x-auto pb-3 snap-x">
            {DICAS.map((d, k) => (
              <div key={d.titulo} className="snap-start shrink-0 w-64 border-l-2 border-[#0E6B7E]/30 pl-4 pr-2 py-1 bg-white/80">
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
      </div>
    </div>
  );
}
