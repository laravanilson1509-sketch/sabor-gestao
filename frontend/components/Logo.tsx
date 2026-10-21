// Logo do sistema (SVG, sem arquivos de imagem). Para trocar a logo em todo o
// sistema, mude LOGO_PADRAO (1 a 4). Veja as opções em /logos.

export const LOGO_PADRAO: Variante = 1;

export type Variante = 1 | 2 | 3 | 4;

export const NOMES_LOGO: Record<Variante, { titulo: string; descricao: string }> = {
  1: { titulo: 'Coroa', descricao: 'Coroa dourada em quadrado azul-petróleo. Simples e forte.' },
  2: { titulo: 'Brasão', descricao: 'Escudo com a letra I e uma coroa. Passa tradição e solidez.' },
  3: { titulo: 'Talheres reais', descricao: 'Garfo e faca cruzados sob uma coroa. Fala de restaurante.' },
  4: { titulo: 'Monograma', descricao: 'Letra I elegante dentro de um anel dourado. Mais sofisticada.' },
};

const AZUL = '#0E6B7E';
const AZUL_ESCURO = '#0A4E5C';
const OURO = '#E3B341';

const COROA = 'M10 36 L8 16 L18 25 L24 10 L30 25 L40 16 L38 36 Z';

function Icone({ v }: { v: Variante }) {
  if (v === 1) {
    return (
      <>
        <rect width="48" height="48" rx="11" fill={AZUL} />
        <path d={COROA} transform="translate(0 1)" fill={OURO} />
        <rect x="10" y="38" width="28" height="4" rx="1.5" fill={OURO} />
        <circle cx="8" cy="16" r="2.2" fill={OURO} transform="translate(0 1)" />
        <circle cx="24" cy="10" r="2.2" fill={OURO} transform="translate(0 1)" />
        <circle cx="40" cy="16" r="2.2" fill={OURO} transform="translate(0 1)" />
      </>
    );
  }
  if (v === 2) {
    return (
      <>
        <path d="M24 3 L43 9 V24 C43 35 35 43 24 46 C13 43 5 35 5 24 V9 Z" fill={AZUL} stroke={OURO} strokeWidth="2.5" strokeLinejoin="round" />
        <path d="M15 17 L14 9 L19 13 L24 7 L29 13 L34 9 L33 17 Z" fill={OURO} />
        <text x="24" y="38" textAnchor="middle" fontFamily="Georgia, 'Times New Roman', serif" fontWeight="700" fontSize="22" fill="#fff">I</text>
      </>
    );
  }
  if (v === 3) {
    return (
      <>
        <circle cx="24" cy="24" r="23" fill={AZUL} />
        <path d="M14 14 L16 9 L19 12 L24 7 L29 12 L32 9 L34 14 Z" fill={OURO} />
        {/* garfo */}
        <g stroke={OURO} strokeWidth="2.4" strokeLinecap="round" fill="none">
          <path d="M15 40 L29 21" />
          <path d="M26 20 L24 24 M29 22 L27 26 M32 24 L30 28" strokeWidth="2" />
          {/* faca */}
          <path d="M33 40 L20 22" />
        </g>
        <path d="M20 21 C16 20 15 25 19 27 Z" fill={OURO} />
      </>
    );
  }
  return (
    <>
      <circle cx="24" cy="24" r="22" fill={AZUL_ESCURO} stroke={OURO} strokeWidth="2.5" />
      <circle cx="24" cy="24" r="17.5" fill="none" stroke={OURO} strokeWidth="0.8" opacity="0.7" />
      <path d="M17 15 L16 10 L20 13 L24 8.5 L28 13 L32 10 L31 15 Z" fill={OURO} />
      <text x="24" y="37" textAnchor="middle" fontFamily="Georgia, 'Times New Roman', serif" fontWeight="700" fontSize="24" fill="#fff">I</text>
    </>
  );
}

type Props = {
  variante?: Variante;
  tamanho?: number; // altura do ícone em px
  mostrarNome?: boolean;
  claro?: boolean; // nome em branco (fundo escuro)
  className?: string;
};

export default function Logo({ variante = LOGO_PADRAO, tamanho = 40, mostrarNome = true, claro = false, className = '' }: Props) {
  return (
    <span className={'inline-flex items-center gap-3 ' + className}>
      <svg width={tamanho} height={tamanho} viewBox="0 0 48 48" role="img" aria-label="Logo Império">
        <Icone v={variante} />
      </svg>
      {mostrarNome && (
        <span
          style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontSize: tamanho * 0.62, letterSpacing: '0.04em' }}
          className={'font-bold leading-none ' + (claro ? 'text-white' : 'text-[#16252B]')}
        >
          Império
        </span>
      )}
    </span>
  );
}
