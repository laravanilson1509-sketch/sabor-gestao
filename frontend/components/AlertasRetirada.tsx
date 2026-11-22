'use client';

// Aviso para o colaborador: "seu pedido está pronto". Aparece em qualquer tela do sistema,
// só para quem enviou o pedido à cozinha. Ao retirar, ele confirma e o pedido vai para Finalizados.

import { useCallback, useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { BellRing } from 'lucide-react';
import { confirmarRetirada, listarAlertasPara, type PedidoRetirada } from '@/lib/queries/cozinha';

const INTERVALO_MS = 10000;

export default function AlertasRetirada({ supabase, email }: { supabase: SupabaseClient; email: string | null }) {
  const [alertas, setAlertas] = useState<PedidoRetirada[]>([]);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    if (!email) return;
    try {
      setAlertas(await listarAlertasPara(supabase, email));
    } catch {
      /* sem rede ou sem permissão: tenta de novo no próximo ciclo */
    }
  }, [supabase, email]);

  useEffect(() => {
    carregar();
    const t = setInterval(carregar, INTERVALO_MS);
    return () => clearInterval(t);
  }, [carregar]);

  async function retirar(a: PedidoRetirada) {
    if (!email) return;
    setOcupado(a.chave);
    setErro(null);
    try {
      await confirmarRetirada(supabase, a.itemIds, email);
      setAlertas((l) => l.filter((x) => x.chave !== a.chave));
    } catch (e: any) {
      setErro(e?.message || 'Não foi possível confirmar a retirada.');
    }
    setOcupado(null);
  }

  if (alertas.length === 0) return null;

  return (
    <div role="alert" aria-live="assertive" className="fixed bottom-4 right-4 z-[70] flex w-[min(22rem,calc(100vw-2rem))] flex-col gap-2">
      {alertas.map((a) => (
        <div key={a.chave} className="ui-glass rounded-xl border border-warning p-4 shadow-token-lg">
          <p className="flex items-center gap-2 text-sm font-semibold text-warning">
            <BellRing size={16} aria-hidden /> Pedido pronto para retirar
          </p>
          <p className="mt-1 text-lg font-bold text-ink">
            {a.titulo}
            {a.codigo && <span className="ml-2 text-sm tabular-nums text-accent">{a.codigo}</span>}
          </p>
          {a.cliente && <p className="text-sm text-ink-soft">{a.cliente}</p>}
          <p className="mt-1 text-xs text-ink-muted">{a.itens.map((i) => i.quantidade + '× ' + i.nome).join(' · ')}</p>
          <button type="button" onClick={() => retirar(a)} disabled={ocupado !== null} className="btn btn-primario mt-3 w-full !min-h-[44px]">
            {ocupado === a.chave ? 'Confirmando...' : 'Retirei o pedido'}
          </button>
        </div>
      ))}
      {erro && <p className="rounded-token bg-danger-soft px-3 py-2 text-sm text-danger">{erro}</p>}
    </div>
  );
}
