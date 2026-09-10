'use client';

import Link from 'next/link';

const CADASTROS = [
  {
    href: '/estoque',
    emoji: '📦',
    titulo: 'Estoque / Produtos',
    descricao: 'Ingredientes, produtos acabados, quantidades e custos',
  },
  {
    href: '/cadastros/fornecedores',
    emoji: '🚚',
    titulo: 'Fornecedores',
    descricao: 'Quem fornece os insumos do restaurante',
  },
  {
    href: '/cadastros/clientes',
    emoji: '👥',
    titulo: 'Clientes',
    descricao: 'Cadastro de clientes para vendas e delivery',
  },
  {
    href: '/cadastros/funcionarios',
    emoji: '👨‍🍳',
    titulo: 'Funcionários',
    descricao: 'Equipe, cargos e dados de contato',
  },
];

export default function CadastrosPage() {
  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">📋 Cadastros</h1>
        <p className="text-gray-600 mb-6">Escolha o tipo de cadastro que quer gerenciar</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {CADASTROS.map((c) => (
            <Link
              key={c.href}
              href={c.href}
              className="bg-white rounded-lg shadow p-5 hover:shadow-md hover:-translate-y-0.5 transition flex items-start gap-4"
            >
              <span className="text-3xl">{c.emoji}</span>
              <div>
                <h2 className="font-semibold text-gray-900">{c.titulo}</h2>
                <p className="text-sm text-gray-500 mt-1">{c.descricao}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}