// Logo do sistema FoodFlow (SVG, sem arquivos de imagem).

const AZUL = 'var(--accent)';
const OURO = '#E3B341';

type Props = {
  tamanho?: number; // altura do ícone em px
  mostrarNome?: boolean;
  tagline?: boolean; // "Do pedido ao lucro" embaixo do nome
  claro?: boolean; // letras claras (fundo escuro)
  empilhado?: boolean; // nome embaixo do ícone
  className?: string;
};

export function Icone({ tamanho = 40, claro = false }: { tamanho?: number; claro?: boolean }) {
  const corDente = claro ? '#0e6b7e' : 'var(--accent-contrast)'; // dentes do garfo: recorte no "F"
  const corF = claro ? '#ffffff' : AZUL; // em fundo colorido (tela de abertura) o F fica branco
  return (
    <svg width={tamanho} height={tamanho} viewBox="0 0 48 48" role="img" aria-label="Logo FoodFlow">
      {/* "F" arredondado */}
      <rect x="6" y="4" width="13" height="40" rx="5" fill={corF} />
      <rect x="6" y="4" width="34" height="13" rx="5" fill={corF} />
      <rect x="6" y="22" width="25" height="11" rx="5" fill={corF} />
      {/* dentes do garfo na barra de cima */}
      <rect x="24" y="7" width="2.2" height="7" rx="1.1" fill={corDente} />
      <rect x="29" y="7" width="2.2" height="7" rx="1.1" fill={corDente} />
      <rect x="34" y="7" width="2.2" height="7" rx="1.1" fill={corDente} />
      {/* folha */}
      <path d="M26 45 C26 35 34 30 44 31 C44 39 38 45 26 45 Z" fill={OURO} />
      <path d="M29 42 C34 38 38 36 41 34" fill="none" stroke="#fff" strokeWidth="1.4" strokeLinecap="round" opacity="0.8" />
    </svg>
  );
}

export default function Logo({ tamanho = 40, mostrarNome = true, tagline = false, claro = false, empilhado = false, className = '' }: Props) {
  return (
    <span className={'inline-flex items-center ' + (empilhado ? 'flex-col gap-3 ' : 'gap-2.5 ') + className}>
      <Icone tamanho={tamanho} claro={claro} />
      {mostrarNome && (
        <span className={'flex flex-col ' + (empilhado ? 'items-center' : 'items-start')}>
          <span style={{ fontSize: tamanho * 0.62 }} className="font-extrabold leading-none tracking-tight">
            <span className={claro ? 'text-white' : 'text-ink'}>Food</span>
            <span className={claro ? 'text-gold' : 'text-accent'}>Flow</span>
          </span>
          {tagline && (
            <span
              style={{ fontSize: Math.max(tamanho * 0.2, 8) }}
              className={'mt-1 uppercase tracking-[0.22em] ' + (claro ? 'text-white/75' : 'text-ink-muted')}
            >
              Do pedido ao lucro
            </span>
          )}
        </span>
      )}
    </span>
  );
}
