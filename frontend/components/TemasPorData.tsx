'use client';

// Janela do calendário de temas: o tema de hoje, a escolha de quais temas mostrar e as
// próximas datas.

import { useMemo } from 'react';
import Modal from '@/components/ui/Modal';
import IconeTema from '@/components/ui/IconeTema';
import { proximasDatas, corTextoSobre, type Preferencia } from '@/lib/temasDatas';
import { quandoTexto, salvarPreferencia, usePreferenciaTemas, useTemaDoDia } from '@/lib/temasPreferencia';

const OPCOES: { valor: Preferencia; titulo: string; descricao: string }[] = [
  { valor: 'auto', titulo: 'Automático', descricao: 'Campanhas de saúde, datas comerciais, feriados e dias da gastronomia.' },
  { valor: 'saude', titulo: 'Só campanhas de saúde', descricao: 'Janeiro Branco, Outubro Rosa, Novembro Azul e as demais do mês.' },
  { valor: 'off', titulo: 'Desligado', descricao: 'Sem faixa e sem cores de data no sistema.' },
];

const TIPO_ROTULO = { saude: 'Saúde', comercial: 'Comercial', feriado: 'Feriado', gastronomia: 'Gastronomia', neutro: '' } as const;

const dataCurta = (d: Date) =>
  d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' }).replace('.', '');

export default function TemasPorData({ aberto, onFechar }: { aberto: boolean; onFechar: () => void }) {
  const pref = usePreferenciaTemas();
  const tema = useTemaDoDia();
  const proximas = useMemo(() => (aberto ? proximasDatas(new Date(), 8) : []), [aberto]);

  return (
    <Modal
      aberto={aberto}
      onFechar={onFechar}
      titulo="Temas por data"
      tamanho="lg"
      rodape={
        <button type="button" onClick={onFechar} className="btn btn-primario">
          Fechar
        </button>
      }
    >
      <div className="space-y-6">
        {/* hoje */}
        {tema && !tema.neutro ? (
          <div
            className="flex items-center gap-4 rounded-card p-4"
            style={{ background: tema.cor2, color: corTextoSobre(tema.cor2) }}
          >
            <IconeTema nome={tema.icone} size={32} />
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide opacity-80">
                {TIPO_ROTULO[tema.tipo]} · {quandoTexto(tema) ?? 'tema de hoje'}
              </p>
              <p className="text-lg font-semibold leading-tight">{tema.nome}</p>
              <p className="text-sm opacity-90">{tema.frase}</p>
            </div>
          </div>
        ) : (
          <p className="rounded-card border border-line bg-surface-hover p-4 text-sm text-ink-muted">
            {pref === 'off' ? 'Temas por data desligados neste navegador.' : 'Nenhum tema para hoje.'}
          </p>
        )}

        {/* escolha */}
        <fieldset>
          <legend className="mb-2 text-sm font-semibold text-ink">O que mostrar</legend>
          <div role="radiogroup" aria-label="Quais temas por data mostrar" className="space-y-2">
            {OPCOES.map((o) => (
              <button
                key={o.valor}
                type="button"
                role="radio"
                aria-checked={pref === o.valor}
                onClick={() => salvarPreferencia(o.valor)}
                className={
                  'ui-focus flex w-full items-start gap-3 rounded-token border px-4 py-3 text-left transition-colors ' +
                  (pref === o.valor ? 'border-accent bg-accent-soft' : 'border-line hover:bg-surface-hover')
                }
              >
                <span
                  aria-hidden
                  className={'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 ' + (pref === o.valor ? 'border-accent' : 'border-line-strong')}
                >
                  {pref === o.valor && <span className="h-2 w-2 rounded-full bg-accent" />}
                </span>
                <span>
                  <span className="block text-sm font-medium text-ink">{o.titulo}</span>
                  <span className="block text-xs text-ink-muted">{o.descricao}</span>
                </span>
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-ink-subtle">A escolha vale só neste navegador.</p>
        </fieldset>

        {/* próximas datas */}
        {pref === 'auto' && (
          <section>
            <h3 className="mb-2 text-sm font-semibold text-ink">Próximas datas</h3>
            <ul className="divide-y divide-line-soft rounded-token border border-line">
              {proximas.map((p) => (
                <li key={p.id} className="flex items-center gap-3 px-4 py-2.5">
                  <span aria-hidden className="h-3 w-3 shrink-0 rounded-full" style={{ background: p.cor2, boxShadow: `0 0 0 2px ${p.cor}55` }} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-ink">{p.nome}</span>
                    <span className="block text-xs text-ink-muted">
                      {TIPO_ROTULO[p.tipo]} · {dataCurta(p.inicio)}
                    </span>
                  </span>
                  <span className="whitespace-nowrap text-xs tabular-nums text-ink-muted">
                    {p.faltam === 0 ? 'hoje' : p.faltam === 1 ? 'amanhã' : 'em ' + p.faltam + ' dias'}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-ink-subtle">Cada data aparece alguns dias antes. Se duas coincidem, vale a mais importante para o restaurante.</p>
          </section>
        )}
      </div>
    </Modal>
  );
}
