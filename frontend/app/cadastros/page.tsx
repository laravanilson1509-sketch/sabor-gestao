'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { createBrowserClient } from '@supabase/ssr';
import { Bike, ClipboardList, Plus, Truck, UserCog, Users, UtensilsCrossed, type LucideIcon } from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';

type Cartao = {
  href: string;
  novo?: string; // atalho para criar direto
  titulo: string;
  descricao: string;
  icone: LucideIcon;
  contar?: { tabela: string; tipoProduto?: string }; // de onde vem o número do cartão
};

const CARTOES: Cartao[] = [
  {
    href: '/cadastros/pratos',
    titulo: 'Pratos',
    descricao: 'Pratos do cardápio, preço de venda e se vendem no WhatsApp.',
    icone: UtensilsCrossed,
    contar: { tabela: 'ingredientes', tipoProduto: 'prato' },
  },
  {
    href: '/cadastros/fichas-tecnicas',
    titulo: 'Fichas técnicas',
    descricao: 'Receitas, custo dos ingredientes e formação do preço.',
    icone: ClipboardList,
  },
  {
    href: '/cadastros/fornecedores',
    novo: '/cadastros/fornecedores/cadastro',
    titulo: 'Fornecedores',
    descricao: 'Quem abastece o restaurante e os contatos para compras.',
    icone: Truck,
    contar: { tabela: 'fornecedores' },
  },
  {
    href: '/cadastros/clientes',
    novo: '/cadastros/clientes/cadastro',
    titulo: 'Clientes',
    descricao: 'Dados, endereços de entrega e aniversários dos clientes.',
    icone: Users,
    contar: { tabela: 'clientes' },
  },
  {
    href: '/cadastros/funcionarios',
    novo: '/cadastros/funcionarios/cadastro',
    titulo: 'Funcionários',
    descricao: 'Equipe do restaurante e suas funções.',
    icone: UserCog,
    contar: { tabela: 'funcionarios' },
  },
  {
    href: '/cadastros/motoboys',
    novo: '/cadastros/motoboys/cadastro',
    titulo: 'Motoboys',
    descricao: 'Entregadores usados no delivery.',
    icone: Bike,
    contar: { tabela: 'motoboys' },
  },
];

export default function CadastrosPage() {
  const supabase = useMemo(
    () => createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!),
    []
  );
  const unidadeId = process.env.NEXT_PUBLIC_UNIDADE_ID!;

  // quantos registros cada cadastro tem (só a contagem, sem baixar as linhas)
  const [contagens, setContagens] = useState<Record<string, number | null>>({});
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let cancelado = false;
    Promise.all(
      CARTOES.filter((c) => c.contar).map(async (c) => {
        let consulta = supabase.from(c.contar!.tabela).select('id', { count: 'exact', head: true }).eq('unidade_id', unidadeId);
        // pratos ficam na mesma tabela dos ingredientes: filtra pelo tipo
        if (c.contar!.tipoProduto) consulta = supabase.from(c.contar!.tabela).select('id', { count: 'exact', head: true }).eq('tipo_produto', c.contar!.tipoProduto);
        const { count, error } = await consulta;
        return [c.href, error ? null : count ?? 0] as const;
      })
    ).then((pares) => {
      if (cancelado) return;
      setContagens(Object.fromEntries(pares));
      setCarregando(false);
    });
    return () => {
      cancelado = true;
    };
  }, [supabase, unidadeId]);

  return (
    <div className="p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <PageHeader
          trilha={[{ rotulo: 'Início', href: '/' }, { rotulo: 'Cadastros' }]}
          titulo="Cadastros"
          descricao="Escolha o que você quer cadastrar ou consultar"
        />

        <ul className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {CARTOES.map((c) => {
            const Icone = c.icone;
            const quantidade = contagens[c.href];
            return (
              <li key={c.href} className="group relative flex flex-col rounded-card border border-line bg-surface p-5 shadow-token-sm transition-colors hover:border-accent">
                <div className="flex items-start gap-4">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-token bg-accent-soft text-accent">
                    <Icone size={22} strokeWidth={1.75} aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <h2 className="text-base font-semibold text-ink">
                      {/* o link cobre o cartão inteiro, então o clique em qualquer parte abre a lista */}
                      <Link href={c.href} className="ui-focus rounded-sm after:absolute after:inset-0 after:content-[''] group-hover:text-accent">
                        {c.titulo}
                      </Link>
                    </h2>
                    <p className="mt-1 text-sm text-ink-muted">{c.descricao}</p>
                  </div>
                </div>

                <div className="mt-5 flex items-center justify-between border-t border-line pt-3">
                  {c.contar ? (
                    carregando ? (
                      <span className="ui-skeleton h-4 w-16" aria-hidden />
                    ) : quantidade === null || quantidade === undefined ? (
                      <span className="text-xs text-ink-subtle">—</span>
                    ) : (
                      <span className="text-sm text-ink-muted tabular-nums">
                        <strong className="font-semibold text-ink">{quantidade}</strong> {quantidade === 1 ? 'cadastrado' : 'cadastrados'}
                      </span>
                    )
                  ) : (
                    <span className="text-xs text-ink-subtle">Receitas dos pratos</span>
                  )}
                  {c.novo && (
                    <Link
                      href={c.novo}
                      className="ui-focus relative z-10 inline-flex items-center gap-1 rounded-token px-2 py-1 text-sm font-medium text-accent hover:bg-accent-soft"
                    >
                      <Plus size={14} strokeWidth={2} aria-hidden /> Novo
                    </Link>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
