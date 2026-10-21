'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import { contarPendenciasAbertas, EVENTO_PENDENCIAS } from '@/lib/queries/pendenciasEstoque';
import Logo from '@/components/Logo';
import TelaAbertura from '@/components/TelaAbertura';
import TelaInicio from '@/components/TelaInicio';
import './globals.css';

const LINKS = [
  { href: '/whatsapp', label: 'WhatsApp' },
  { href: '/estoque', label: 'Estoque' },
  { href: '/pdv', label: 'PDV' },
  { href: '/cozinha', label: 'Cozinha' },
  { href: '/caixa', label: 'Caixa' },
  { href: '/impressao', label: 'Impressão' },
  { href: '/cadastros', label: 'Cadastros' },
  { href: '/delivery', label: 'Delivery' },
  { href: '/compras', label: 'Compras' },
  { href: '/financeiro', label: 'Financeiro' },
];

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [aberto, setAberto] = useState(false);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  async function handleSair() {
    await supabase.auth.signOut();
    setAberto(false);
    router.push('/login');
    router.refresh();
  }

  const naLogin = pathname === '/login';
  const naInicio = pathname === '/';
  const tituloTela = LINKS.find((l) => pathname.startsWith(l.href))?.label || '';

  // título da aba do navegador (o layout é de cliente, então não usa metadata)
  useEffect(() => {
    document.title = 'Império';
  }, [pathname]);

  // contador de conferências de estoque pendentes, mostrado ao lado de "Estoque"
  const [pendencias, setPendencias] = useState(0);
  useEffect(() => {
    if (naLogin) return;
    const atualizar = () =>
      contarPendenciasAbertas(supabase, process.env.NEXT_PUBLIC_UNIDADE_ID!)
        .then(setPendencias)
        .catch(() => setPendencias(0));
    atualizar();
    window.addEventListener(EVENTO_PENDENCIAS, atualizar);
    return () => window.removeEventListener(EVENTO_PENDENCIAS, atualizar);
  }, [pathname]);

  function classeLink(href: string) {
    const ativo = pathname.startsWith(href);
    return (
      'block rounded-lg px-3 py-2.5 text-[15px] transition ' +
      (ativo
        ? 'bg-[#DCEEF2] text-[#0B4F5E] font-semibold'
        : 'text-[#5B6B73] hover:bg-[#F1F5F7] hover:text-[#16252B]')
    );
  }

  if (naLogin) {
    return (
      <html lang="pt-BR">
        <body className="bg-[#EEF2F4]">
          <main>{children}</main>
        </body>
      </html>
    );
  }

  return (
    <html lang="pt-BR">
      <body className="bg-[#EEF2F4] text-[#16252B]">
        <TelaAbertura ativa={!naLogin} />
        <div className="min-h-screen md:flex">
          {/* Barra superior (celular) */}
          <header className="md:hidden sticky top-0 z-30 flex items-center justify-between bg-white border-b border-[#DCE3E7] px-4 h-14">
            <Link href="/" aria-label="Início">
              <Logo tamanho={30} />
            </Link>
            <button
              onClick={() => setAberto((v) => !v)}
              className="h-10 w-10 text-2xl text-[#16252B]"
              aria-label={aberto ? 'Fechar menu' : 'Abrir menu'}
            >
              {aberto ? '✕' : '☰'}
            </button>
          </header>

          {/* Menu lateral */}
          <aside
            className={
              (aberto ? 'block ' : 'hidden ') +
              'md:flex md:flex-col md:w-60 md:shrink-0 md:sticky md:top-0 md:h-screen ' +
              'bg-white border-r border-[#DCE3E7] p-4'
            }
          >
            <Link href="/" aria-label="Início" className="hidden md:block px-3 pt-2 pb-6">
              <Logo tamanho={34} />
            </Link>
            <nav className="flex flex-col gap-1">
              {LINKS.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  onClick={() => setAberto(false)}
                  className={classeLink(l.href) + ' flex items-center justify-between'}
                >
                  {l.label}
                  {l.href === '/estoque' && pendencias > 0 && (
                    <span
                      className="rounded-full px-2 py-0.5 text-xs font-semibold bg-[#FFF0C7] text-[#7A5A0A]"
                      title="Conferências de estoque pendentes"
                    >
                      {pendencias}
                    </span>
                  )}
                </Link>
              ))}
            </nav>
            <button
              onClick={handleSair}
              className="mt-4 md:mt-auto rounded-lg px-3 py-2.5 text-left text-[15px] text-[#5B6B73] hover:bg-[#FADBD6] hover:text-[#B3261E] transition"
            >
              Sair
            </button>
          </aside>

          {/* Conteúdo */}
          <main className="tema-claro flex-1 min-w-0">
            {/* a tela inicial fica sempre aqui; as outras abrem por cima */}
            <TelaInicio supabase={supabase} />
            {!naInicio && (
              <div
                className={
                  (aberto ? 'hidden md:flex ' : 'flex ') +
                  'fixed z-20 flex-col bg-[#EEF2F4] overflow-hidden shadow-2xl ' +
                  'top-14 left-0 right-0 bottom-0 ' +
                  'md:top-3 md:right-3 md:bottom-3 md:left-[16rem] md:rounded-2xl md:border md:border-[#DCE3E7]'
                }
              >
                <div className="flex items-center justify-between gap-3 bg-white border-b border-[#DCE3E7] px-4 h-11 shrink-0">
                  <span className="text-sm font-semibold text-[#16252B]">{tituloTela}</span>
                  <Link
                    href="/"
                    className="text-sm text-[#5B6B73] hover:text-[#16252B] rounded-lg px-2.5 py-1 hover:bg-[#F1F5F7] transition"
                    aria-label="Fechar e voltar ao início"
                  >
                    ✕ Fechar
                  </Link>
                </div>
                <div className="flex-1 overflow-y-auto">{children}</div>
              </div>
            )}
          </main>
        </div>
      </body>
    </html>
  );
}