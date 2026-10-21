import Logo, { LOGO_PADRAO, NOMES_LOGO, type Variante } from '@/components/Logo';

const VARIANTES: Variante[] = [1, 2, 3, 4];

export default function LogosPage() {
  return (
    <div className="p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-2xl font-bold text-[#16252B]">Sugestões de logo</h1>
        <p className="text-sm text-[#5B6B73] mb-6">
          Escolha uma e me diga o número. Hoje o sistema usa a opção {LOGO_PADRAO}.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {VARIANTES.map((v) => (
            <div key={v} className="bg-white border border-[#DCE3E7] rounded-xl p-5">
              <p className="text-sm font-semibold text-[#16252B] mb-1">
                Opção {v} · {NOMES_LOGO[v].titulo}
              </p>
              <p className="text-xs text-[#5B6B73] mb-4">{NOMES_LOGO[v].descricao}</p>
              <div className="flex items-center gap-6 flex-wrap">
                <div className="bg-[#EEF2F4] rounded-lg p-4">
                  <Logo variante={v} tamanho={56} />
                </div>
                <div className="bg-gradient-to-br from-[#0A4E5C] to-[#0E6B7E] rounded-lg p-4">
                  <Logo variante={v} tamanho={56} claro />
                </div>
                <Logo variante={v} tamanho={28} mostrarNome={false} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
