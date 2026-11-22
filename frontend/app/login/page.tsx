'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Logo from '@/components/Logo'
import { temaDoDia } from '@/lib/temasDatas'

function LacoCampanha({ cor }: { cor: string }) {
  return (
    <svg
      viewBox="0 0 120 140"
      width="96"
      height="112"
      fill="none"
      stroke={cor}
      strokeWidth="13"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M60 74 C18 42 36 8 60 24 C84 8 102 42 60 74 Z" />
      <path d="M60 74 L34 128" />
      <path d="M60 74 L86 128" />
    </svg>
  )
}

function LoginForm() {
  const campanha = temaDoDia()
  const router = useRouter()
  const params = useSearchParams()
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [mostrar, setMostrar] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [carregando, setCarregando] = useState(false)

  async function entrar(e: React.FormEvent) {
    e.preventDefault()
    setErro(null)
    setCarregando(true)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha })
    if (error) {
      setErro('E-mail ou senha incorretos.')
      setCarregando(false)
      return
    }
    const destino = params.get('next') || params.get('redirectTo') || '/'
    router.push(destino.startsWith('/') ? destino : '/')
    router.refresh()
  }

  return (
    <div className="min-h-screen md:flex bg-app">
      {/* Painel da esquerda (só em telas médias ou maiores) */}
      <section className="hidden md:flex md:flex-1 flex-col justify-between bg-surface border-r border-line p-12">
        <Logo tamanho={44} tagline />

        <div>
          <h2 className="text-5xl font-extrabold leading-[1.05] tracking-tight text-ink">
            A cozinha sob controle,
            <br />
            do estoque ao pedido.
          </h2>
          <p className="mt-4 max-w-sm text-ink-muted">
            Estoque, fichas técnicas, financeiro e delivery em um só lugar.
          </p>
        </div>

        {/* campanha do mês (muda sozinha: Novembro Azul, Dezembro Vermelho...) */}
        <div className="flex items-center gap-6 rounded-card border border-line bg-surface-hover p-6">
          <div className="shrink-0">
            <LacoCampanha cor={campanha.cor2} />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-accent-ink">{campanha.nome}</p>
            <p className="mt-1 text-xl font-bold leading-snug text-ink">Cuidar de você também é prioridade.</p>
            <p className="mt-2 text-sm text-ink-muted">{campanha.frase}</p>
          </div>
        </div>
      </section>

      {/* Formulário */}
      <section className="flex items-center justify-center px-4 py-10 md:w-[460px] md:shrink-0 md:px-10">
        <form onSubmit={entrar} className="w-full max-w-sm space-y-5">
          <div>
            <div className="md:hidden mb-6">
              <Logo tamanho={40} />
            </div>
            <h1 className="text-2xl font-bold text-ink">Entrar</h1>
            <p className="mt-1 text-sm text-ink-muted">Use o e-mail e a senha criados para você.</p>
          </div>

          <div className="space-y-2">
            <label htmlFor="email" className="block text-sm font-medium text-ink-soft">
              E-mail
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="voce@restaurante.com"
              className="w-full h-12 rounded-xl border border-line-strong bg-surface px-4 text-ink placeholder:text-ink-subtle focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="senha" className="block text-sm font-medium text-ink-soft">
              Senha
            </label>
            <div className="relative">
              <input
                id="senha"
                type={mostrar ? 'text' : 'password'}
                required
                autoComplete="current-password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder="Sua senha"
                className="w-full h-12 rounded-xl border border-line-strong bg-surface pl-4 pr-12 text-ink placeholder:text-ink-subtle focus:outline-none focus:ring-2 focus:ring-accent"
              />
              <button
                type="button"
                onClick={() => setMostrar((v) => !v)}
                aria-label={mostrar ? 'Ocultar senha' : 'Mostrar senha'}
                className="absolute right-1 top-1 h-10 w-10 flex items-center justify-center rounded-lg text-ink-muted hover:text-accent"
              >
                {mostrar ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M17.9 17.9A10.9 10.9 0 0 1 12 19c-6.5 0-10-7-10-7a18 18 0 0 1 4.1-4.9M9.9 5.2A9.9 9.9 0 0 1 12 5c6.5 0 10 7 10 7a18 18 0 0 1-2.2 3.2M1 1l22 22" />
                    <path d="M14.1 14.1a3 3 0 1 1-4.2-4.2" />
                  </svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {erro && (
            <p role="alert" className="text-sm text-danger bg-danger-soft rounded-lg px-3 py-2">
              {erro}
            </p>
          )}

          <button
            type="submit"
            disabled={carregando}
            className="btn btn-primario w-full h-12 rounded-xl disabled:opacity-60"
          >
            {carregando ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </section>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  )
}