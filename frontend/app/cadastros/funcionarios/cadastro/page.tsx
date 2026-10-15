import FormCadastro from '@/components/cadastros/FormCadastro';

export default function CadastroFuncionarioPage() {
  return (
    <FormCadastro
      tabela="funcionarios"
      singular="funcionário"
      rota="/cadastros/funcionarios"
      campos={[
        { chave: 'nome', rotulo: 'Nome', placeholder: 'Ex: João Pereira' },
        { chave: 'cargo', rotulo: 'Cargo', placeholder: 'Ex: Cozinheiro, Garçom', meia: true },
        { chave: 'data_admissao', rotulo: 'Data de admissão', tipo: 'date', meia: true },
        { chave: 'telefone', rotulo: 'Telefone', placeholder: '(44) 99999-9999', meia: true },
        { chave: 'email', rotulo: 'Email', tipo: 'email', placeholder: 'funcionario@email.com', meia: true },
      ]}
    />
  );
}