'use client';

// Aba "Finalizados": pedidos já retirados. Dá para pesquisar por data, nome (quem reservou),
// mesa, código da comanda e colaborador.

import { useEffect, useMemo, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { listarFinalizados, type PedidoRetirada } from '@/lib/queries/cozinha';
import BarraBusca, { NadaEncontrado } from '@/components/BarraBusca';
import { combina } from '@/lib/busca';
import { nomeDoEmail } from '@/lib/nomes';

const dataISO = (d: Date) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const dataHora = (iso: string) => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
const hora = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

export default function PedidosFinalizados({ supabase }: { supabase: SupabaseClient }) {
  const hoje = dataISO(new Date());
  const [de, setDe] = useState(hoje);
  const [ate, setAte] = useState(hoje);
  const [busca, setBusca] = useState('');
  const [lista, setLista] = useState<PedidoRetirada[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  async function carregar() {
    setCarregando(true);
    setErro(null);
    try {
      // as datas são do dia local: de 00:00 do primeiro dia até 00:00 do dia seguinte ao último
      const inicio = new Date(de + 'T00:00:00');
      const fim = new Date(ate + 'T00:00:00');
      fim.setDate(fim.getDate() + 1);
      setLista(await listarFinalizados(supabase, { de: inicio.toISOString(), ate: fim.toISOString() }));
    } catch (e: any) {
      setErro(
        /does not exist|Could not find/i.test(e?.message || '')
          ? 'Falta rodar o SQL 0022_cozinha_retirada no Supabase (SQL Editor) para usar esta tela.'
          : e?.message || 'Não foi possível carregar os pedidos finalizados.'
      );
    }
    setCarregando(false);
  }

  useEffect(() => {
    if (de && ate && de <= ate) carregar();
  }, [de, ate]);

  const filtrados = useMemo(
    () =>
      lista.filter((p) =>
        combina(busca, p.codigo, p.titulo, p.cliente, p.enviadoPor && nomeDoEmail(p.enviadoPor), p.enviadoPor, p.retiradoPor && nomeDoEmail(p.retiradoPor), ...p.itens.map((i) => i.nome))
      ),
    [lista, busca]
  );

  const campoData = 'rounded-token border border-line bg-surface px-3 py-2 text-sm text-ink';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <BarraBusca
          valor={busca}
          onChange={setBusca}
          debounce={300}
          atalho
          placeholder="Buscar por código, nome de quem reservou, mesa, colaborador ou item"
          className="min-w-[16rem] flex-1"
        />
        <label className="text-xs text-ink-muted">
          De
          <input type="date" value={de} max={ate} onChange={(e) => setDe(e.target.value)} className={campoData + ' mt-1 block'} />
        </label>
        <label className="text-xs text-ink-muted">
          Até
          <input type="date" value={ate} min={de} max={hoje} onChange={(e) => setAte(e.target.value)} className={campoData + ' mt-1 block'} />
        </label>
        <button type="button" onClick={() => { setDe(hoje); setAte(hoje); }} className="btn btn-secundario">
          Hoje
        </button>
      </div>

      {erro && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-token bg-danger-soft px-4 py-3 text-sm text-danger">
          <span>{erro}</span>
          <button type="button" onClick={carregar} className="font-semibold underline">
            Tentar de novo
          </button>
        </div>
      )}

      {carregando ? (
        <p className="py-10 text-center text-sm text-ink-muted">Carregando...</p>
      ) : erro ? null : lista.length === 0 ? (
        <div className="rounded-card border border-dashed border-line-strong bg-surface p-10 text-center">
          <p className="font-medium text-ink">Nenhum pedido finalizado neste período</p>
          <p className="mt-1 text-sm text-ink-muted">Pedidos aparecem aqui depois que o colaborador confirma a retirada.</p>
        </div>
      ) : filtrados.length === 0 ? (
        <NadaEncontrado busca={busca} />
      ) : (
        <>
          <p className="text-sm text-ink-muted tabular-nums">
            {filtrados.length} {filtrados.length === 1 ? 'pedido' : 'pedidos'}
          </p>
          <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {filtrados.map((p) => (
              <li key={p.chave} className="rounded-xl border border-line bg-surface p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-bold text-ink">
                      {p.titulo}
                      {p.codigo && <span className="ml-2 text-sm font-semibold tabular-nums text-accent">{p.codigo}</span>}
                    </p>
                    {p.cliente && <p className="text-sm text-ink-soft">{p.cliente}</p>}
                  </div>
                  <p className="shrink-0 text-right text-xs text-ink-muted">
                    retirado {p.retiradoEm && dataHora(p.retiradoEm)}
                  </p>
                </div>
                <p className="mt-2 text-sm text-ink-soft">{p.itens.map((i) => i.quantidade + '× ' + i.nome).join(' · ')}</p>
                <p className="mt-2 text-xs text-ink-muted">
                  Enviado por {p.enviadoPor ? nomeDoEmail(p.enviadoPor) : '—'}
                  {p.alertaEm && ' · alertado às ' + hora(p.alertaEm)}
                  {p.retiradoPor && ' · retirada confirmada por ' + nomeDoEmail(p.retiradoPor)}
                </p>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
