'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import './globals.css';

const LINKS = [
  { href: '/whatsapp', label: '💬 WhatsApp' },
  { href: '/estoque', label: '📦 Estoque' },
  { href: '/cadastros', label: '📋 Cadastros' },
  { href: '/delivery', label: '🛵 Delivery' },
  { href: '/compras', label: '🛒 Compras' },
    { href: '/financeiro', label: '💰 Financeiro' },
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

  function classeLink(href: string) {
    const ativo = pathname.startsWith(href);
    return (
      'font-medium transition ' +
      (ativo ? 'text-blue-400' : 'text-white hover:text-blue-400')
    );
  }

  return (
    <html lang="pt-BR">
      <body className="bg-gray-900">
        {!naLogin && (
          <nav className="bg-gray-800 border-b border-gray-700">
            <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-6">
              <div className="hidden md:flex items-center gap-6 flex-1">
                {LINKS.map((l) => (
                  <Link key={l.href} href={l.href} className={classeLink(l.href)}>
                    {l.label}
                  </Link>
                ))}
              </div>

              <span className="md:hidden text-white font-semibold flex-1">
                Sabor Gestão
              </span>

              <button
                onClick={() => setAberto((v) => !v)}
                className="md:hidden text-white text-2xl px-2"
                aria-label="Abrir menu"
              >
                {aberto ? '✕' : '☰'}
              </button>

              <button
                onClick={handleSair}
                className="hidden md:block text-sm text-gray-400 hover:text-red-400 transition"
              >
                Sair
              </button>
            </div>

            {aberto && (
              <div className="md:hidden border-t border-gray-700 px-4 py-2 flex flex-col">
                {LINKS.map((l) => (
                  <Link
                    key={l.href}
                    href={l.href}
                    onClick={() => setAberto(false)}
                    className={'py-3 ' + classeLink(l.href)}
                  >
                    {l.label}
                  </Link>
                ))}
                <button
                  onClick={handleSair}
                  className="py-3 text-left text-gray-400 hover:text-red-400"
                >
                  Sair
                </button>
              </div>
            )}
          </nav>
        )}
        <main>{children}</main>
      </body>
    </html>
  );
}