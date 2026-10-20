'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import { contarPendenciasAbertas, EVENTO_PENDENCIAS } from '@/lib/queries/pendenciasEstoque';
import './globals.css';

const LINKS = [
  { href: '/whatsapp', label: 'WhatsApp' },
  { href: '/estoque', label: 'Estoque' },
  { href: '/pdv', label: 'PDV' },
  { href: '/cozinha', label: 'Cozinha' },
  { href: '/caixa', label: 'Caixa' },
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
        <div className="min-h-screen md:flex">
          {/* Barra superior (celular) */}
          <header className="md:hidden sticky top-0 z-30 flex items-center justify-between bg-white border-b border-[#DCE3E7] px-4 h-14">
            <span className="font-bold text-[#16252B]">Sabor Gestão</span>
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
            <p className="hidden md:block px-3 pt-2 pb-6 text-lg font-bold text-[#16252B]">
              Sabor Gestão
            </p>
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
          <main className="tema-claro flex-1 min-w-0">{children}</main>
        </div>
      </body>
    </html>
  );
}