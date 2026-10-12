'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

function LoginForm() {
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
    <div className="min-h-screen flex items-center justify-center bg-[#EEF2F4] px-4">
      <form
        onSubmit={entrar}
        className="w-full max-w-md rounded-2xl bg-white border border-[#DCE3E7] p-8 shadow-sm space-y-5"
      >
        <div>
          <p className="text-lg font-bold text-[#16252B]">Sabor Gestão</p>
          <h1 className="mt-4 text-2xl font-bold text-[#16252B]">Entrar</h1>
          <p className="mt-1 text-sm text-[#5B6B73]">Use o e-mail e a senha criados para você.</p>
        </div>

        <div className="space-y-2">
          <label htmlFor="email" className="block text-sm font-medium text-[#2B3C44]">
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
            className="w-full h-12 rounded-xl border border-[#C9D3D8] bg-white px-4 text-[#16252B] placeholder:text-[#8FA0A8] focus:outline-none focus:ring-2 focus:ring-[#0E6B7E]"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="senha" className="block text-sm font-medium text-[#2B3C44]">
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
              className="w-full h-12 rounded-xl border border-[#C9D3D8] bg-white pl-4 pr-12 text-[#16252B] placeholder:text-[#8FA0A8] focus:outline-none focus:ring-2 focus:ring-[#0E6B7E]"
            />
            <button
              type="button"
              onClick={() => setMostrar((v) => !v)}
              aria-label={mostrar ? 'Ocultar senha' : 'Mostrar senha'}
              className="absolute right-1 top-1 h-10 w-10 flex items-center justify-center rounded-lg text-[#5B6B73] hover:text-[#0E6B7E]"
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
          <p role="alert" className="text-sm text-[#B3261E] bg-[#FADBD6] rounded-lg px-3 py-2">
            {erro}
          </p>
        )}

        <button
          type="submit"
          disabled={carregando}
          className="w-full h-12 rounded-xl bg-[#0E6B7E] hover:bg-[#0B5A6A] disabled:opacity-60 text-white font-semibold"
        >
          {carregando ? 'Entrando...' : 'Entrar'}
        </button>
      </form>
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