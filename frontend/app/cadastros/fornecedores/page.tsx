import ListaCadastro from '@/components/cadastros/ListaCadastro';

export default function FornecedoresPage() {
  return (
    <ListaCadastro
      tabela="fornecedores"
      titulo="Fornecedores"
      singular="fornecedor"
      rota="/cadastros/fornecedores"
      colunas={[
        { chave: 'telefone', rotulo: 'Telefone' },
        { chave: 'cnpj_cpf', rotulo: 'CNPJ/CPF' },
      ]}
    />
  );
}