'use client';

// Aba "Pedidos prontos": o que já saiu da produção e espera o colaborador retirar.
// A cozinha avisa quem enviou o pedido; quem retira confirma, e o pedido vai para "Finalizados".

import { BellRing, CheckCheck, Undo2 } from 'lucide-react';
import type { CartaoCozinha } from '@/lib/queries/cozinha';
import { nomeDoEmail } from '@/lib/nomes';

type Props = {
  cartoes: CartaoCozinha[];
  agora: number;
  ocupado: string | null;
  onAlerta: (c: CartaoCozinha) => void;
  onRetirada: (c: CartaoCozinha) => void;
  onVoltar: (c: CartaoCozinha) => void;
};

const hora = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
const minutosDesde = (iso: string, agora: number) => Math.max(0, Math.floor((agora - new Date(iso).getTime()) / 60000));
const tempo = (m: number) => {
  if (m < 60) return m + ' min';
  if (m < 1440) return Math.floor(m / 60) + 'h' + (m % 60 ? ' ' + (m % 60) + 'min' : '');
  const d = Math.floor(m / 1440);
  return d + (d === 1 ? ' dia' : ' dias');
};

export default function PedidosProntos({ cartoes, agora, ocupado, onAlerta, onRetirada, onVoltar }: Props) {
  if (cartoes.length === 0) {
    return (
      <div className="rounded-card border border-dashed border-line-strong bg-surface p-10 text-center">
        <p className="font-medium text-ink">Nenhum pedido pronto esperando retirada</p>
        <p className="mt-1 text-sm text-ink-muted">Quando a cozinha marcar um pedido como pronto, ele aparece aqui.</p>
      </div>
    );
  }

  return (
    <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {cartoes.map((c) => {
        const minutos = minutosDesde(c.desde, agora);
        const doPdv = !c.deliveryId;
        const responsavel = c.enviadoPor ? nomeDoEmail(c.enviadoPor) : null;
        return (
          <li key={c.chave} className="flex flex-col rounded-xl border border-line bg-surface p-4">
            <div className="mb-3 flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-lg font-bold text-ink">{c.titulo}</p>
                <p className="truncate text-xs text-ink-muted">
                  {c.codigo && <span className="font-semibold tabular-nums text-ink-soft">{c.codigo}</span>}
                  {c.codigo && c.subtitulo ? ' · ' : ''}
                  {c.subtitulo}
                </p>
              </div>
              <p className={'shrink-0 text-sm ' + (minutos >= 10 ? 'font-semibold text-danger' : 'text-success')}>pronto há {tempo(minutos)}</p>
            </div>

            <ul className="mb-3 divide-y divide-line-soft border-t border-line-soft">
              {c.itens.map((i, k) => (
                <li key={k} className="py-1.5 text-sm text-ink">
                  <span className="font-bold">{i.quantidade}×</span> {i.nome}
                </li>
              ))}
            </ul>

            {doPdv ? (
              <>
                <p className="mb-3 text-xs text-ink-muted">
                  Enviado por <strong className="text-ink-soft">{responsavel || 'não identificado'}</strong>
                  {c.alertaEm && (
                    <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-warning-soft px-2 py-0.5 font-semibold text-warning">
                      <BellRing size={12} aria-hidden /> alerta enviado às {hora(c.alertaEm)}
                    </span>
                  )}
                </p>
                <div className="mt-auto grid grid-cols-[1fr_auto] gap-2">
                  <button
                    type="button"
                    onClick={() => onAlerta(c)}
                    disabled={ocupado !== null || !c.enviadoPor}
                    title={c.enviadoPor ? undefined : 'Não sei quem enviou este pedido'}
                    className="btn btn-primario col-span-2"
                  >
                    <BellRing size={16} aria-hidden /> {c.alertaEm ? 'Alertar de novo' : 'Enviar alerta' + (responsavel ? ' para ' + responsavel : '')}
                  </button>
                  <button type="button" onClick={() => onRetirada(c)} disabled={ocupado !== null} className="btn btn-secundario justify-center" title="Confirma que o pedido já foi retirado">
                    <CheckCheck size={16} aria-hidden /> Retirado
                  </button>
                  <button type="button" onClick={() => onVoltar(c)} disabled={ocupado !== null} className="btn btn-secundario" aria-label="Voltar para preparo" title="Voltar para preparo">
                    <Undo2 size={16} aria-hidden />
                  </button>
                </div>
              </>
            ) : (
              <p className="mt-auto text-xs text-ink-muted">Pedido de delivery: a saída é acompanhada na tela Delivery.</p>
            )}
          </li>
        );
      })}
    </ul>
  );
}
