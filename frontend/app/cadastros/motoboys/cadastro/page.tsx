import FormCadastro from '@/components/cadastros/FormCadastro';

export default function CadastroMotoboyPage() {
  return (
    <FormCadastro
      tabela="motoboys"
      singular="motoboy"
      rota="/cadastros/motoboys"
      campos={[
        { chave: 'nome', rotulo: 'Nome', placeholder: 'Ex: João Silva' },
        { chave: 'telefone', rotulo: 'Telefone', placeholder: '(44) 99999-9999', meia: true },
        { chave: 'placa_veiculo', rotulo: 'Placa do veículo', placeholder: 'ABC-1234', maiusculo: true, meia: true },
      ]}
    />
  );
}