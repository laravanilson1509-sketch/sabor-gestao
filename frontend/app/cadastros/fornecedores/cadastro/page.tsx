import FormCadastro from '@/components/cadastros/FormCadastro';

export default function CadastroFornecedorPage() {
  return (
    <FormCadastro
      tabela="fornecedores"
      singular="fornecedor"
      rota="/cadastros/fornecedores"
      campos={[
        { chave: 'nome', rotulo: 'Nome', placeholder: 'Ex: Distribuidora São Paulo' },
        { chave: 'telefone', rotulo: 'Telefone', placeholder: '(44) 99999-9999', meia: true },
        { chave: 'cnpj_cpf', rotulo: 'CNPJ/CPF', placeholder: '00.000.000/0000-00', meia: true },
        { chave: 'email', rotulo: 'Email', tipo: 'email', placeholder: 'contato@fornecedor.com' },
        { chave: 'endereco', rotulo: 'Endereço', placeholder: 'Rua, número, bairro, cidade' },
        { chave: 'observacoes', rotulo: 'Observações', tipo: 'textarea', placeholder: 'Informações adicionais' },
      ]}
    />
  );
}