import FormCadastro from '@/components/cadastros/FormCadastro';

export default function CadastroClientePage() {
  return (
    <FormCadastro
      tabela="clientes"
      singular="cliente"
      rota="/cadastros/clientes"
      campos={[
        { chave: 'nome', rotulo: 'Nome', placeholder: 'Ex: Maria Silva' },
        { chave: 'telefone', rotulo: 'Telefone', placeholder: '(44) 99999-9999', meia: true },
        { chave: 'email', rotulo: 'Email', tipo: 'email', placeholder: 'cliente@email.com', meia: true },
        { chave: 'data_nascimento', rotulo: 'Data de nascimento', tipo: 'date', meia: true },
        { chave: 'endereco', rotulo: 'Endereço', placeholder: 'Rua, número, bairro, cidade (útil para delivery)' },
        { chave: 'observacoes', rotulo: 'Observações', tipo: 'textarea', placeholder: 'Preferências, restrições, notas' },
      ]}
    />
  );
}