import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const UNIDADE_ID = '0f40dc91-5882-4340-a7b6-927b70a1e556';
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

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return new Response('Not allowed', { status: 405 });

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const formData = await req.formData();
    const from = String(formData.get('From') || '');
    const body = String(formData.get('Body') || '').trim();

    // Palavras-chave que transferem pro atendente humano
    const palavrasHumano = ['atendente', 'humano', 'ajuda', 'suporte', 'cancelar'];
    if (palavrasHumano.some((p: string) => body.toLowerCase().includes(p))) {
      await supabase
        .from('conversas_whatsapp')
        .update({ estado: 'novo', itens_pedido: [], endereco: null, forma_pagamento: null, atualizado_em: new Date().toISOString() })
        .eq('telefone', from);
      await supabase.from('mensagens_whatsapp').insert({
        telefone: from,
        mensagem: body,
        status: 'nao_atendido',
        unidade_id: UNIDADE_ID,
        recebido_em: new Date().toISOString(),
      });
      return twiml('Transferindo para um atendente humano! 👨‍💼\n\nEm breve alguém vai te responder por aqui!');
    }

    await supabase.from('mensagens_whatsapp').insert({
      telefone: from,
      mensagem: body,
      status: 'nao_atendido',
      unidade_id: UNIDADE_ID,
      recebido_em: new Date().toISOString(),
    });

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

    if (conversa.estado === 'novo' || conversa.estado === 'finalizado') {
      const catalogo = await buscarCatalogo();
      if (catalogo.length === 0) {
        return twiml('Olá! No momento não temos produtos disponíveis. Tente novamente mais tarde.');
      }
      const lista = catalogo
        .map((p: any, i: number) => `${i + 1}. ${p.nome} - R$ ${Number(p.preco_venda).toFixed(2)}`)
        .join('\n');

      await atualizarConversa({ estado: 'aguardando_itens', itens_pedido: catalogo });

      return twiml(
        `Olá! 🍕 Bem-vindo(a)! Aqui está nosso cardápio:\n\n${lista}\n\nMe diga os itens que deseja no formato:\nnúmero x quantidade, separados por vírgula.\n\nExemplo: 1x2, 3x1\n\nDigite "atendente" para falar com um humano.`
      );
    }

    if (conversa.estado === 'aguardando_itens') {
      const catalogo = conversa.itens_pedido as any[];
      const partes = body.split(',').map((p: string) => p.trim());
      const itensSelecionados: any[] = [];
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
        return twiml('Não entendi 😕. Use o formato número x quantidade.\nExemplo: 1x2, 3x1\n\nDigite "atendente" para falar com um humano.');
      }

      const total = itensSelecionados.reduce((acc: number, i: any) => acc + i.quantidade * i.preco_unitario, 0);
      const resumo = itensSelecionados
        .map((i: any) => `${i.quantidade}x ${i.nome} - R$ ${(i.quantidade * i.preco_unitario).toFixed(2)}`)
        .join('\n');

      await atualizarConversa({ estado: 'aguardando_confirmacao_itens', itens_pedido: itensSelecionados });

      return twiml(`Seu pedido:\n\n${resumo}\n\nTotal: R$ ${total.toFixed(2)}\n\nConfirma? (sim/não)`);
    }

    if (conversa.estado === 'aguardando_confirmacao_itens') {
      const resposta = body.toLowerCase();
      if (resposta.includes('sim')) {
        await atualizarConversa({ estado: