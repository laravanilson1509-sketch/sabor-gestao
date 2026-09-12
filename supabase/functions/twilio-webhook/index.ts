import { createClient } from 'npm:@supabase/supabase-js@2';

export const config = { cors: true };

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const UNIDADE_ID = Deno.env.get('UNIDADE_ID_PADRAO')!;
const CHAVE_PIX = Deno.env.get('CHAVE_PIX') || 'chave-pix-nao-configurada';

function twiml(mensagem: string) {
  const escapada = mensagem
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escapada}</Message></Response>`,
    { status: 200, headers: { 'Content-Type': 'application/xml' } }
  );
}

export default async function handler(req: Request) {
  if (req.method !== 'POST') return new Response('Not allowed', { status: 405 });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const formData = await req.formData();
  const from = String(formData.get('From') || '');
  const body = String(formData.get('Body') || '').trim();

  // registra a mensagem recebida (mantém o inbox humano funcionando também)
  await supabase.from('mensagens_whatsapp').insert({
    telefone: from,
    mensagem: body,
    status: 'nao_atendido',
    unidade_id: UNIDADE_ID,
    recebido_em: new Date().toISOString(),
  });

  // busca ou cria a conversa desse telefone
  let { data: conversa } = await supabase
    .from('conversas_whatsapp')
    .select('*')
    .eq('telefone', from)
    .maybeSingle();

  if (!conversa) {
    const { data: nova } = await supabase
      .from('conversas_whatsapp')
      .insert({ telefone: from, unidade_id: UNIDADE_ID, estado: 'novo' })
      .select('*')
      .single();
    conversa = nova;
  }

  async function atualizarConversa(campos: Record<string, unknown>) {
    await supabase
      .from('conversas_whatsapp')
      .update({ ...campos, atualizado_em: new Date().toISOString() })
      .eq('id', conversa.id);
  }

  async function buscarCatalogo() {
    const { data } = await supabase
      .from('ingredientes')
      .select('id, nome, preco_venda')
      .eq('tipo_produto', 'acabado')
      .eq('ativo', true)
      .not('preco_venda', 'is', null)
      .order('nome');
    return data || [];
  }

  // ===== ESTADO: novo -> manda cardápio e pede itens =====
  if (conversa.estado === 'novo') {
    const catalogo = await buscarCatalogo();
    if (catalogo.length === 0) {
      return twiml('Olá! No momento não temos produtos disponíveis. Tente novamente mais tarde.');
    }
    const lista = catalogo
      .map((p: any, i: number) => `${i + 1}. ${p.nome} - R$ ${Number(p.preco_venda).toFixed(2)}`)
      .join('\n');

    await atualizarConversa({ estado: 'aguardando_itens', itens_pedido: catalogo });

    return twiml(
      `Olá! 🍕 Bem-vindo(a)! Aqui está nosso cardápio:\n\n${lista}\n\nMe diga os itens que deseja no formato:\nnúmero x quantidade, separados por vírgula.\n\nExemplo: 1x2, 3x1`
    );
  }

  // ===== ESTADO: aguardando_itens -> processa o pedido =====
  if (conversa.estado === 'aguardando_itens') {
    const catalogo = conversa.itens_pedido as any[];
    const partes = body.split(',').map((p) => p.trim());
    const itensSelecionados: { nome: string; quantidade: number; preco_unitario: number; ingrediente_id: string }[] = [];
    let erro = false;

    for (const parte of partes) {
      const match = parte.match(/^(\d+)\s*x\s*(\d+)$/i);
      if (!match) { erro = true; break; }
      const indice = parseInt(match[1], 10) - 1;
      const quantidade = parseInt(match[2], 10);
      const produto = catalogo[indice];
      if (!produto || quantidade <= 0) { erro = true; break; }
      itensSelecionados.push({
        nome: produto.nome,
        quantidade,
        preco_unitario: produto.preco_venda,
        ingrediente_id: produto.id,
      });
    }

    if (erro || itensSelecionados.length === 0) {
      return twiml('Não entendi 😕. Use o formato número x quantidade, separado por vírgula.\nExemplo: 1x2, 3x1');
    }

    const total = itensSelecionados.reduce((acc, i) => acc + i.quantidade * i.preco_unitario, 0);
    const resumo = itensSelecionados
      .map((i) => `${i.quantidade}x ${i.nome} - R$ ${(i.quantidade * i.preco_unitario).toFixed(2)}`)
      .join('\n');

    await atualizarConversa({
      estado: 'aguardando_confirmacao_itens',
      itens_pedido: itensSelecionados,
    });

    return twiml(`Seu pedido:\n\n${resumo}\n\nTotal: R$ ${total.toFixed(2)}\n\nConfirma? (sim/não)`);
  }

  // ===== ESTADO: aguardando_confirmacao_itens =====
  if (conversa.estado === 'aguardando_confirmacao_itens') {
    const resposta = body.toLowerCase();
    if (resposta.includes('sim')) {
      await atualizarConversa({ estado: 'aguardando_endereco' });
      return twiml('Perfeito! Qual o endereço de entrega? (rua, número, bairro)');
    }
    if (resposta.includes('não') || resposta.includes('nao')) {
      await atualizarConversa({ estado: 'novo', itens_pedido: [] });
      return twiml('Sem problemas! Envie qualquer mensagem para começar de novo. 😊');
    }
    return twiml('Só preciso que confirme: responda "sim" ou "não".');
  }

  // ===== ESTADO: aguardando_endereco =====
  if (conversa.estado === 'aguardando_endereco') {
    if (body.length < 5) {
      return twiml('Pode enviar o endereço completo, por favor? (rua, número, bairro)');
    }
    await atualizarConversa({ estado: 'aguardando_pagamento', endereco: body });
    return twiml('Show! Como vai pagar?\n\n1. Pix\n2. Dinheiro\n3. Cartão (na entrega)');
  }

  // ===== ESTADO: aguardando_pagamento =====
  if (conversa.estado === 'aguardando_pagamento') {
    const escolha = body.trim();
    let formaPagamento = '';
    if (escolha === '1' || body.toLowerCase().includes('pix')) formaPagamento = 'pix';
    else if (escolha === '2' || body.toLowerCase().includes('dinheiro')) formaPagamento = 'dinheiro';
    else if (escolha === '3' || body.toLowerCase().includes('cart')) formaPagamento = 'cartao';
    else return twiml('Escolha uma opção válida:\n\n1. Pix\n2. Dinheiro\n3. Cartão (na entrega)');

    if (formaPagamento === 'pix') {
      await atualizarConversa({ estado: 'aguardando_confirmacao_pix', forma_pagamento: 'pix' });
      return twiml(
        `Chave Pix: ${CHAVE_PIX}\n\nAssim que pagar, envie "paguei" aqui que já confirmamos seu pedido! 🙏`
      );
    }

    // dinheiro ou cartao -> finaliza direto (paga na entrega)
    await finalizarPedido(supabase, conversa, formaPagamento, 'pendente');
    return twiml('Pedido confirmado! ✅ Você paga na entrega. Já vamos preparar tudo. Obrigado! 🍕');
  }

  // ===== ESTADO: aguardando_confirmacao_pix =====
  if (conversa.estado === 'aguardando_confirmacao_pix') {
    if (body.toLowerCase().includes('pagu')) {
      await finalizarPedido(supabase, conversa, 'pix', 'informado');
      return twiml('Recebemos sua confirmação! ✅ Assim que o Pix cair vamos preparar seu pedido. Obrigado! 🍕');
    }
    return twiml(`Ainda aguardando o pagamento via Pix.\n\nChave: ${CHAVE_PIX}\n\nEnvie "paguei" assim que finalizar.`);
  }

  // ===== ESTADO: finalizado (conversa antiga, reinicia) =====
  await atualizarConversa({ estado: 'novo', itens_pedido: [], endereco: null, forma_pagamento: null });
  return twiml('Olá novamente! Envie qualquer mensagem para fazer um novo pedido. 😊');
}

async function finalizarPedido(
  supabase: any,
  conversa: any,
  formaPagamento: string,
  statusPagamento: string
) {
  const itens = conversa.itens_pedido as any[];
  const total = itens.reduce((acc, i) => acc + i.quantidade * i.preco_unitario, 0);

  await supabase.from('pedidos_delivery').insert({
    unidade_id: conversa.unidade_id,
    telefone_cliente: conversa.telefone,
    endereco_entrega: conversa.endereco,
    forma_pagamento: formaPagamento,
    status_pagamento: statusPagamento,
    itens,
    valor_total: total,
    status: 'novo',
  });

  await supabase
    .from('conversas_whatsapp')
    .update({
      estado: 'finalizado',
      atualizado_em: new Date().toISOString(),
    })
    .eq('id', conversa.id);
}