import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

export type Trilha = { rotulo: string; href?: string };

// Início › Cadastros › Clientes — o último item é a página atual
export default function Breadcrumbs({ itens }: { itens: Trilha[] }) {
  return (
    <nav aria-label="Onde você está" className="mb-2">
      <ol className="flex flex-wrap items-center gap-1 text-xs text-ink-muted">
        {itens.map((item, k) => {
          const ultimo = k === itens.length - 1;
          return (
            <li key={item.rotulo + k} className="flex items-center gap-1">
              {item.href && !ultimo ? (
                <Link href={item.href} className="ui-focus rounded-sm hover:text-accent hover:underline">
                  {item.rotulo}
                </Link>
              ) : (
                <span aria-current={ultimo ? 'page' : undefined} className={ultimo ? 'text-ink font-medium' : ''}>
                  {item.rotulo}
                </span>
              )}
              {!ultimo && <ChevronRight size={12} strokeWidth={2} aria-hidden className="text-ink-subtle" />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
