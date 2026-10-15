import ListaCadastro from '@/components/cadastros/ListaCadastro';

export default function MotoboysPage() {
  return (
    <ListaCadastro
      tabela="motoboys"
      titulo="Motoboys"
      singular="motoboy"
      rota="/cadastros/motoboys"
      colunas={[
        { chave: 'telefone', rotulo: 'Telefone' },
        { chave: 'placa_veiculo', rotulo: 'Placa' },
      ]}
    />
  );
}