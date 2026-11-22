'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import { contarPendenciasAbertas, EVENTO_PENDENCIAS } from '@/lib/queries/pendenciasEstoque';
import { tituloDaRota } from '@/lib/navegacao';
import { SCRIPT_TEMA, ThemeProvider } from '@/components/ThemeProvider';
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import TelaAbertura from '@/components/TelaAbertura';
import TelaInicio from '@/components/TelaInicio';
import './design-tokens.css';
import './globals.css';

const CHAVE_MENU = 'sidebar-recolhida';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [gavetaAberta, setGavetaAberta] = useState(false); // menu no celular
  const [recolhida, setRecolhida] = useState(false); // menu recolhido no computador
  const [email, setEmail] = useState<string | null>(null);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const naLogin = pathname === '/login';
  const naInicio = pathname === '/';

  async function handleSair() {
    await supabase.auth.signOut();
    setGavetaAberta(false);
    router.push('/login');
    router.refresh();
  }

  // título da aba do navegador (o layout é de cliente, então não usa metadata)
  useEffect(() => {
    document.title = 'FoodFlow';
  }, [pathname]);

  // lembra se o menu estava recolhido
  useEffect(() => {
    try {
      setRecolhida(localStorage.getItem(CHAVE_MENU) === '1');
    } catch {
      // sem armazenamento: começa expandido
    }
  }, []);

  function alternarMenu() {
    setRecolhida((v) => {
      try {
        localStorage.setItem(CHAVE_MENU, v ? '0' : '1');
      } catch {
        // vale só nesta visita
      }
      return !v;
    });
  }

  // quem está logado (aparece no menu do usuário)
  useEffect(() => {
    if (naLogin) return;
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
  }, [naLogin]);

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

  // trocou de tela: fecha a gaveta do celular
  useEffect(() => setGavetaAberta(false), [pathname]);

  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        {/* aplica o tema salvo antes de a página aparecer (sem piscar) */}
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_TEMA }} />
        {/* letra manuscrita da tela inicial */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Great+Vibes&display=swap" rel="stylesheet" />
      </head>
      <body>
        <ThemeProvider>
          {naLogin ? (
            <main>{children}</main>
          ) : (
            <>
              <TelaAbertura ativa />
              <div
                className="min-h-screen md:flex"
                style={{ '--sidebar-w': recolhida ? '64px' : '240px', '--navbar-h': '56px' } as React.CSSProperties}
              >
                <Sidebar
                  atual={pathname}
                  recolhida={recolhida}
                  onAlternar={alternarMenu}
                  gavetaAberta={gavetaAberta}
                  onFecharGaveta={() => setGavetaAberta(false)}
                  pendencias={pendencias}
                />

                <div className="flex min-w-0 flex-1 flex-col">
                  <Navbar
                    titulo={tituloDaRota(pathname)}
                    painelAberto={!naInicio}
                    onAbrirMenu={() => setGavetaAberta(true)}
                    email={email}
                    onSair={handleSair}
                  />

                  <main className="relative flex-1 min-w-0">
                    {/* a tela inicial fica sempre aqui; as outras abrem por cima */}
                    <div
                      aria-hidden={!naInicio || undefined}
                      {...(!naInicio ? ({ inert: '' } as object) : {})}
                      className={'transition-opacity duration-150 ' + (!naInicio ? 'opacity-25 select-none' : '')}
                    >
                      <TelaInicio supabase={supabase} />
                    </div>
                    {!naInicio && (
                      <div
                        className={
                          'fixed z-20 overflow-hidden border-line bg-app shadow-token-lg ' +
                          'left-0 right-0 bottom-0 top-[var(--navbar-h)] ' +
                          'md:left-[calc(var(--sidebar-w)+12px)] md:right-3 md:bottom-3 md:top-[calc(var(--navbar-h)+8px)] md:rounded-card md:border'
                        }
                      >
                        <div className="h-full overflow-y-auto">{children}</div>
                      </div>
                    )}
                  </main>
                </div>
              </div>
            </>
          )}
        </ThemeProvider>
      </body>
    </html>
  );
}
