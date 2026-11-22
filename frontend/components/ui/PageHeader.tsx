import Link from 'next/link';
import { ConteudoVoltar } from '@/components/BotaoVoltar';
import Breadcrumbs, { type Trilha } from './Breadcrumbs';

type Props = {
  titulo: string;
  descricao?: React.ReactNode;
  trilha?: Trilha[];
  voltarHref?: string;
  acoes?: React.ReactNode;
};

// Cabeçalho padrão das telas: trilha, título, descrição e ações à direita
export default function PageHeader({ titulo, descricao, trilha, voltarHref, acoes }: Props) {
  return (
    <header className="mb-6">
      {trilha && <Breadcrumbs itens={trilha} />}
      <div className="flex flex-wrap items-start gap-x-4 gap-y-3">
        {voltarHref && (
          <Link href={voltarHref} className="btn-voltar">
            <ConteudoVoltar />
          </Link>
        )}
        <div className="flex-1 min-w-[12rem]">
          <h1 className="text-2xl font-semibold tracking-[-0.02em] text-ink">{titulo}</h1>
          {descricao && <p className="text-sm text-ink-muted mt-1">{descricao}</p>}
        </div>
        {acoes && <div className="flex flex-wrap items-center gap-2">{acoes}</div>}
      </div>
    </header>
  );
}
