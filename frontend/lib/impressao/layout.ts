// lib/impressao/layout.ts — monta o ticket a partir do conteúdo salvo na fila
//
// O resultado é uma lista de "linhas" simples (texto, colunas, separador).
// A estação do navegador transforma em HTML; o futuro agente ESC/POS só
// precisa traduzir as mesmas linhas em comandos da impressora.

export type Documento =
  | 'producao'
  | 'cancelamento'
  | 'alteracao'
  | 'pre_conta'
  | 'comprovante'
  | 'via_estabelecimento';

export type Linha =
  | {
      t: 'texto';
      texto: string;
      alinhar?: 'esq' | 'centro' | 'dir';
      negrito?: boolean;
      grande?: boolean;
      inverso?: boolean; // fundo preto, letra branca: o que a cozinha não pode deixar passar
    }
  | { t: 'colunas'; esq: string; dir: string; negrito?: boolean; grande?: boolean }
  | { t: 'separador'; duplo?: boolean }
  | { t: 'espaco' };

export const NOME_DOCUMENTO: Record<Documento, string> = {
  producao: 'Ticket de produção',
  cancelamento: 'Cancelamento',
  alteracao: 'Alteração',
  pre_conta: 'Pré-conta',
  comprovante: 'Comprovante de pagamento',
  via_estabelecimento: 'Via do estabelecimento',
};

// caracteres por linha na fonte padrão das térmicas
export const COLUNAS = { 58: 32, 80: 48 } as const;

const ROTULO_FORMA: Record<string, string> = {
  dinheiro: 'Dinheiro',
  pix: 'Pix',
  cartao_credito: 'Cartão crédito',
  cartao_debito: 'Cartão débito',
  vale_refeicao: 'Vale refeição',
  outro: 'Outro',
  fiado: 'A receber (fiado)',
};

const moeda = (v: number) =>
  Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const qtd = (v: number) => Number(v || 0).toLocaleString('pt-BR', { maximumFractionDigits: 3 });

const dataHora = (iso?: string) =>
  iso
    ? new Date(iso).toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '';

function cabecalhoReimpressao(c: any): Linha[] {
  if (!c.reimpressao) return [];
  const r = c.reimpressao;
  return [
    { t: 'texto', texto: `REIMPRESSÃO · ${r.via}ª VIA`, alinhar: 'centro', negrito: true, inverso: true },
    { t: 'texto', texto: `Pedida por ${r.por || '-'} em ${dataHora(r.em)}`, alinhar: 'centro' },
    ...(r.motivo ? [{ t: 'texto', texto: 'Motivo: ' + r.motivo, alinhar: 'centro' } as Linha] : []),
    { t: 'separador' },
  ];
}

function identificacao(c: any, grande = true): Linha[] {
  const id = c.identificacao || {};
  const linhas: Linha[] = [{ t: 'texto', texto: id.rotulo || '', alinhar: 'centro', negrito: true, grande }];
  if (id.cliente) linhas.push({ t: 'texto', texto: 'Cliente: ' + id.cliente, alinhar: 'centro' });
  if (id.endereco) linhas.push({ t: 'texto', texto: 'Entrega: ' + id.endereco, alinhar: 'centro', negrito: true });
  if (id.pagamento) linhas.push({ t: 'texto', texto: 'Pagamento: ' + id.pagamento, alinhar: 'centro' });
  return linhas;
}

function rodapeOperador(c: any): Linha[] {
  const partes = [c.operador, c.terminal].filter(Boolean).join(' · ');
  return [
    { t: 'separador' },
    { t: 'texto', texto: dataHora(c.emitido_em) + (partes ? ' · ' + partes : ''), alinhar: 'centro' },
  ];
}

// ---------- produção, cancelamento e alteração ----------

function ticketProducao(doc: Documento, c: any): Linha[] {
  const linhas: Linha[] = [...cabecalhoReimpressao(c)];
  linhas.push({ t: 'texto', texto: (c.setor || 'Produção').toUpperCase(), alinhar: 'centro', inverso: true, negrito: true });
  linhas.push(...identificacao(c));
  if (c.identificacao?.pedido) {
    linhas.push({ t: 'texto', texto: 'Pedido #' + c.identificacao.pedido, alinhar: 'centro' });
  }

  if (doc === 'cancelamento') {
    linhas.push({ t: 'texto', texto: '*** CANCELAMENTO ***', alinhar: 'centro', grande: true, inverso: true });
  } else if (doc === 'alteracao') {
    linhas.push({ t: 'texto', texto: '*** ALTERAÇÃO ***', alinhar: 'centro', grande: true, inverso: true });
  } else if (c.acrescimo) {
    linhas.push({ t: 'texto', texto: '+ ACRÉSCIMO +', alinhar: 'centro', grande: true, inverso: true });
  }
  linhas.push({ t: 'separador', duplo: true });

  for (const i of c.itens || []) {
    const prefixo = doc === 'cancelamento' ? 'NÃO FAZER ' : '';
    linhas.push({ t: 'texto', texto: `${prefixo}${qtd(i.quantidade)}x ${i.nome}`, grande: true, negrito: true });
    for (const a of i.adicionais || []) {
      linhas.push({ t: 'texto', texto: '   + ' + a.nome, negrito: true });
    }
    if (i.restricao) {
      linhas.push({ t: 'texto', texto: ' ! RESTRIÇÃO: ' + i.restricao.toUpperCase(), inverso: true, negrito: true });
    }
    if (i.observacao) linhas.push({ t: 'texto', texto: '   OBS: ' + i.observacao, negrito: true });
    if (i.antes) {
      const antes = [i.antes.restricao && 'Restrição: ' + i.antes.restricao, i.antes.observacao && 'Obs: ' + i.antes.observacao]
        .filter(Boolean)
        .join(' · ');
      linhas.push({ t: 'texto', texto: '   Antes: ' + (antes || 'sem observação') });
    }
    if (i.sem_estoque) linhas.push({ t: 'texto', texto: '   CONFERIR ESTOQUE', negrito: true });
    linhas.push({ t: 'espaco' });
  }

  if (c.motivo) linhas.push({ t: 'texto', texto: 'Motivo: ' + c.motivo, negrito: true });
  if (c.autorizado_por) linhas.push({ t: 'texto', texto: 'Autorizado por: ' + c.autorizado_por });
  linhas.push(...rodapeOperador(c));
  return linhas;
}

// ---------- pré-conta, comprovante e via do estabelecimento ----------

function ticketConta(doc: Documento, c: any): Linha[] {
  const loja = c.loja || {};
  const linhas: Linha[] = [...cabecalhoReimpressao(c)];
  if (loja.nome) linhas.push({ t: 'texto', texto: loja.nome, alinhar: 'centro', negrito: true, grande: true });
  if (loja.documento) linhas.push({ t: 'texto', texto: 'CNPJ/CPF ' + loja.documento, alinhar: 'centro' });
  if (loja.endereco) linhas.push({ t: 'texto', texto: loja.endereco, alinhar: 'centro' });
  if (loja.telefone) linhas.push({ t: 'texto', texto: loja.telefone, alinhar: 'centro' });
  if (loja.nome || loja.documento || loja.endereco || loja.telefone) linhas.push({ t: 'separador' });

  const titulo =
    doc === 'pre_conta' ? 'PRÉ-CONTA' : doc === 'comprovante' ? 'COMPROVANTE DE PAGAMENTO' : 'VIA DO ESTABELECIMENTO';
  linhas.push({ t: 'texto', texto: titulo, alinhar: 'centro', negrito: true, inverso: doc !== 'pre_conta' });
  linhas.push(...identificacao(c, false));
  linhas.push({
    t: 'texto',
    texto: `Pedido #${c.identificacao?.pedido ?? ''} · aberto ${dataHora(c.aberto_em)}`,
    alinhar: 'centro',
  });
  linhas.push({ t: 'separador' });

  const mostrarCancelados = doc === 'via_estabelecimento';
  for (const i of c.itens || []) {
    if (i.cancelado && !mostrarCancelados) continue;
    const direita = i.cancelado ? 'CANCELADO' : i.cortesia ? 'CORTESIA' : moeda(i.valor);
    linhas.push({ t: 'colunas', esq: `${qtd(i.quantidade)}x ${i.nome}`, dir: direita });
    for (const a of i.adicionais || []) {
      linhas.push({ t: 'texto', texto: `   + ${a.nome}${Number(a.valor) > 0 ? ' (' + moeda(a.valor) + ')' : ''}` });
    }
  }
  linhas.push({ t: 'separador' });

  linhas.push({ t: 'colunas', esq: 'Subtotal', dir: moeda(c.subtotal) });
  if (Number(c.desconto) > 0) {
    linhas.push({ t: 'colunas', esq: 'Desconto' + (c.desconto_motivo ? ' (' + c.desconto_motivo + ')' : ''), dir: '-' + moeda(c.desconto) });
  }
  if (Number(c.taxa_servico) > 0) {
    linhas.push({
      t: 'colunas',
      esq: `Taxa de serviço ${qtd(c.taxa_servico_pct)}% (opcional)`,
      dir: moeda(c.taxa_servico),
    });
  }
  linhas.push({ t: 'colunas', esq: 'TOTAL', dir: 'R$ ' + moeda(c.total), negrito: true, grande: true });

  if (doc === 'pre_conta') {
    const pessoas = Number(c.pessoas) || 1;
    if (pessoas > 1) {
      linhas.push({ t: 'colunas', esq: `Dividido por ${pessoas} pessoas`, dir: 'R$ ' + moeda(Number(c.total) / pessoas) });
    }
    if (Number(c.pago) > 0) {
      linhas.push({ t: 'colunas', esq: 'Já pago', dir: moeda(c.pago) });
      linhas.push({ t: 'colunas', esq: 'Falta pagar', dir: moeda(c.restante), negrito: true });
    }
    linhas.push({ t: 'espaco' });
    linhas.push({ t: 'texto', texto: 'CONFIRA OS ITENS ANTES DE PAGAR', alinhar: 'centro', negrito: true });
  } else {
    linhas.push({ t: 'separador' });
    linhas.push({ t: 'texto', texto: 'PAGAMENTOS', negrito: true });
    for (const g of c.pagamentos || []) {
      const nome = (ROTULO_FORMA[g.forma] || g.forma) + (g.pagador ? ' · ' + g.pagador : '');
      linhas.push({ t: 'colunas', esq: nome, dir: moeda(g.valor) });
      if (g.recebido && Number(g.troco) > 0) {
        linhas.push({ t: 'colunas', esq: '   Recebido', dir: moeda(g.recebido) });
      }
      if (g.transacao) linhas.push({ t: 'texto', texto: '   Transação: ' + g.transacao });
    }
    if (Number(c.troco) > 0) {
      linhas.push({ t: 'colunas', esq: 'TROCO', dir: 'R$ ' + moeda(c.troco), negrito: true, grande: true });
    }
  }

  linhas.push({ t: 'separador' });
  linhas.push({ t: 'texto', texto: 'NÃO É DOCUMENTO FISCAL', alinhar: 'centro', negrito: true });
  if (loja.rodape && doc !== 'via_estabelecimento') {
    linhas.push({ t: 'texto', texto: loja.rodape, alinhar: 'centro' });
  }
  linhas.push(...rodapeOperador(c));
  return linhas;
}

export function montarTicket(documento: Documento, conteudo: any): Linha[] {
  if (documento === 'producao' || documento === 'cancelamento' || documento === 'alteracao') {
    return ticketProducao(documento, conteudo);
  }
  return ticketConta(documento, conteudo);
}
