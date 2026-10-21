'use client';

// Campo de busca padrão das listas do sistema.

type Props = {
  valor: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
};

export default function BarraBusca({ valor, onChange, placeholder = 'Buscar...', className = '' }: Props) {
  return (
    <div className={'relative ' + className}>
      <svg
        viewBox="0 0 24 24"
        width="18"
        height="18"
        aria-hidden
        className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8FA0A8] pointer-events-none"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      >
        <circle cx="11" cy="11" r="6.5" />
        <path d="M16 16 L21 21" />
      </svg>
      <input
        type="search"
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="w-full border border-[#C9D3D8] rounded-lg pl-10 pr-9 py-2.5 text-sm text-[#16252B] bg-white placeholder:text-[#8FA0A8] focus:outline-none focus:ring-2 focus:ring-[#0E6B7E] [&::-webkit-search-cancel-button]:hidden"
      />
      {valor && (
        <button
          type="button"
          onClick={() => onChange('')}
          className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 rounded-full text-[#8FA0A8] hover:text-[#16252B] hover:bg-[#F1F5F7]"
          aria-label="Limpar busca"
        >
          ✕
        </button>
      )}
    </div>
  );
}

export function NadaEncontrado({ busca }: { busca: string }) {
  return (
    <div className="bg-white border border-[#DCE3E7] rounded-xl p-8 text-center">
      <p className="text-[#16252B]">Nada encontrado para “{busca}”</p>
      <p className="text-sm text-[#5B6B73] mt-1">Confira a escrita ou tente outra palavra.</p>
    </div>
  );
}
