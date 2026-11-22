'use client';

// Tabela padrão: cabeçalho fixo, ordenação, carregamento em esqueleto, estado vazio e
// paginação. As linhas são memorizadas: digitar na busca não redesenha linhas iguais.
// Passe `colunas` e `aoClicarLinha` estáveis (useMemo / useCallback) para o ganho valer.

import { memo } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, ChevronsUpDown } from 'lucide-react';

export type Coluna<T> = {
  chave: string;
  cabecalho: string;
  render?: (linha: T) => React.ReactNode;
  alinhar?: 'esq' | 'dir' | 'centro';
  ordenavel?: boolean;
  className?: string;
};

export type Ordem = { chave: string; direcao: 'asc' | 'desc' } | null;

type Props<T> = {
  descricao: string; // nome da tabela para leitores de tela
  colunas: Coluna<T>[];
  linhas: T[];
  chaveLinha: (linha: T) => string;
  carregando?: boolean;
  vazio?: React.ReactNode;
  aoClicarLinha?: (linha: T) => void;
  classeLinha?: (linha: T) => string; // ex.: esmaecer linhas inativas
  ordem?: Ordem;
  aoMudarOrdem?: (ordem: Ordem) => void;
  pagina?: number; // começa em 1
  porPagina?: number;
  total?: number;
  aoMudarPagina?: (pagina: number) => void;
  cartaoMobile?: (linha: T) => React.ReactNode; // celular (< 768px): lista de cartões no lugar da tabela
};

const ALINHAR = { esq: 'text-left', dir: 'text-right tabular-nums', centro: 'text-center' };

function LinhaBase<T>({ linha, colunas, aoClicar, classe }: { linha: T; colunas: Coluna<T>[]; aoClicar?: (l: T) => void; classe?: string }) {
  return (
    <tr
      onClick={aoClicar ? () => aoClicar(linha) : undefined}
      onKeyDown={
        aoClicar
          ? (e) => {
              if ((e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) {
                e.preventDefault();
                aoClicar(linha);
              }
            }
          : undefined
      }
      tabIndex={aoClicar ? 0 : undefined}
      className={'ui-focus transition-colors hover:bg-surface-hover ' + (aoClicar ? 'cursor-pointer ' : '') + (classe || '')}
    >
      {colunas.map((c) => (
        <td key={c.chave} className={'px-4 py-3.5 text-sm text-ink ' + ALINHAR[c.alinhar || 'esq'] + ' ' + (c.className || '')}>
          {c.render ? c.render(linha) : String((linha as Record<string, unknown>)[c.chave] ?? '—')}
        </td>
      ))}
    </tr>
  );
}
const Linha = memo(LinhaBase) as typeof LinhaBase;

export default function DataTable<T>({
  descricao,
  colunas,
  linhas,
  chaveLinha,
  carregando,
  vazio,
  aoClicarLinha,
  classeLinha,
  ordem,
  aoMudarOrdem,
  pagina = 1,
  porPagina = 25,
  total,
  aoMudarPagina,
  cartaoMobile,
}: Props<T>) {
  const totalLinhas = total ?? linhas.length;
  const ultimaPagina = Math.max(1, Math.ceil(totalLinhas / porPagina));
  const de = totalLinhas === 0 ? 0 : (pagina - 1) * porPagina + 1;
  const ate = Math.min(pagina * porPagina, totalLinhas);

  function alternarOrdem(chave: string) {
    if (!aoMudarOrdem) return;
    if (!ordem || ordem.chave !== chave) aoMudarOrdem({ chave, direcao: 'asc' });
    else if (ordem.direcao === 'asc') aoMudarOrdem({ chave, direcao: 'desc' });
    else aoMudarOrdem(null);
  }

  return (
    <div className="bg-surface border border-line rounded-card overflow-hidden">
      <div className={(cartaoMobile ? 'hidden md:block ' : '') + 'overflow-auto max-h-[calc(100vh-21rem)]'}>
        <table className="w-full min-w-[560px]" aria-label={descricao} aria-busy={carregando || undefined}>
          <thead className="sticky top-0 z-10 bg-surface-hover border-b border-line">
            <tr>
              {colunas.map((c) => {
                const ativa = ordem?.chave === c.chave;
                return (
                  <th
                    key={c.chave}
                    scope="col"
                    aria-sort={c.ordenavel ? (ativa ? (ordem!.direcao === 'asc' ? 'ascending' : 'descending') : 'none') : undefined}
                    className={'px-4 py-3 text-xs font-semibold uppercase tracking-wide text-ink-muted ' + ALINHAR[c.alinhar || 'esq']}
                  >
                    {c.ordenavel && aoMudarOrdem ? (
                      <button
                        type="button"
                        onClick={() => alternarOrdem(c.chave)}
                        className="ui-table-sort inline-flex items-center gap-1 uppercase tracking-wide hover:text-ink rounded-sm"
                      >
                        {c.cabecalho}
                        {ativa ? (
                          ordem!.direcao === 'asc' ? <ChevronUp size={14} aria-hidden /> : <ChevronDown size={14} aria-hidden />
                        ) : (
                          <ChevronsUpDown size={14} aria-hidden className="opacity-50" />
                        )}
                      </button>
                    ) : (
                      c.cabecalho
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {carregando
              ? Array.from({ length: 6 }, (_, i) => (
                  <tr key={i}>
                    {colunas.map((c) => (
                      <td key={c.chave} className="px-4 py-4">
                        <div className="ui-skeleton h-4" style={{ width: c.chave === colunas[0].chave ? '70%' : '50%' }} />
                      </td>
                    ))}
                  </tr>
                ))
              : linhas.map((l) => <Linha key={chaveLinha(l)} linha={l} colunas={colunas} aoClicar={aoClicarLinha} classe={classeLinha?.(l)} />)}
          </tbody>
        </table>
      </div>

      {cartaoMobile && (
        <ul className="md:hidden divide-y divide-line" aria-label={descricao}>
          {carregando
            ? Array.from({ length: 4 }, (_, i) => (
                <li key={i} className="space-y-2 p-4">
                  <div className="ui-skeleton h-4 w-2/3" />
                  <div className="ui-skeleton h-3 w-1/2" />
                </li>
              ))
            : linhas.map((l) => (
                <li
                  key={chaveLinha(l)}
                  onClick={aoClicarLinha ? () => aoClicarLinha(l) : undefined}
                  className={'p-4 ' + (aoClicarLinha ? 'cursor-pointer active:bg-surface-hover ' : '') + (classeLinha?.(l) || '')}
                >
                  {cartaoMobile(l)}
                </li>
              ))}
        </ul>
      )}
      {!carregando && linhas.length === 0 && (vazio || <p className="p-8 text-center text-sm text-ink-muted">Nada por aqui.</p>)}

      {aoMudarPagina && totalLinhas > porPagina && (
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t border-line text-sm text-ink-muted">
          <span className="tabular-nums">
            Mostrando {de}–{ate} de {totalLinhas}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => aoMudarPagina(pagina - 1)}
              disabled={pagina <= 1}
              className="btn btn-secundario !px-3 !py-1.5"
              aria-label="Página anterior"
            >
              <ChevronLeft size={16} aria-hidden />
            </button>
            <span className="tabular-nums">
              {pagina} / {ultimaPagina}
            </span>
            <button
              type="button"
              onClick={() => aoMudarPagina(pagina + 1)}
              disabled={pagina >= ultimaPagina}
              className="btn btn-secundario !px-3 !py-1.5"
              aria-label="Próxima página"
            >
              <ChevronRight size={16} aria-hidden />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
