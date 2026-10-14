import Link from 'next/link';

const CARTOES = [
  {
    href: '/cadastros/pratos',
    titulo: 'Pratos',
    descricao: 'Pratos do cardápio, preço de venda e se vendem no WhatsApp.',
  },
  {
    href: '/cadastros/fichas-tecnicas',
    titulo: 'Fichas técnicas',
    descricao: 'Receitas, custo dos ingredientes e formação do preço.',
  },
  {
    href: '/cadastros/fornecedores',
    titulo: 'Fornecedores',
    descricao: 'Quem abastece o restaurante e os contatos para compras.',
  },
  {
    href: '/cadastros/clientes',
    titulo: 'Clientes',
    descricao: 'Dados e endereços de entrega dos clientes.',
  },
  {
    href: '/cadastros/funcionarios',
    titulo: 'Funcionários',
    descricao: 'Equipe do restaurante e suas funções.',
  },
  {
    href: '/cadastros/motoboys',
    titulo: 'Motoboys',
    descricao: 'Entregadores usados no delivery.',
  },
];

export default function CadastrosPage() {
  return (
    <div className="p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-[#16252B]">Cadastros</h1>
          <p className="text-sm text-[#5B6B73] mt-1">
            Escolha o que você quer cadastrar ou consultar
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {CARTOES.map((c) => (
            <Link
              key={c.href}
              href={c.href}
              className="group flex flex-col justify-between rounded-xl border border-[#DCE3E7] bg-white p-5 transition hover:border-[#0E6B7E] hover:shadow-sm"
            >
              <div>
                <h2 className="text-lg font-semibold text-[#16252B] group-hover:text-[#0E6B7E]">
                  {c.titulo}
                </h2>
                <p className="mt-1 text-sm text-[#5B6B73]">{c.descricao}</p>
              </div>
              <span className="mt-4 text-sm font-medium text-[#0E6B7E]">Abrir →</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}