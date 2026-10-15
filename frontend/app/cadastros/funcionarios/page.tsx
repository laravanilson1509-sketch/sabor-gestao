import ListaCadastro from '@/components/cadastros/ListaCadastro';

export default function FuncionariosPage() {
  return (
    <ListaCadastro
      tabela="funcionarios"
      titulo="Funcionários"
      singular="funcionário"
      rota="/cadastros/funcionarios"
      colunas={[
        { chave: 'cargo', rotulo: 'Cargo' },
        { chave: 'telefone', rotulo: 'Telefone' },
      ]}
    />
  );
}