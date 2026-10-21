import ListaCadastro from '@/components/cadastros/ListaCadastro';

export default function ClientesPage() {
  return (
    <ListaCadastro
      tabela="clientes"
      titulo="Clientes"
      singular="cliente"
      rota="/cadastros/clientes"
      colunas={[
        { chave: 'telefone', rotulo: 'Telefone' },
        { chave: 'email', rotulo: 'Email' },
        { chave: 'data_nascimento', rotulo: 'Aniversário', tipo: 'aniversario' as const },
      ]}
    />
  );
}