// lib/queries/aniversarios.ts — clientes que fazem aniversário hoje e nos próximos dias

import type { SupabaseClient } from '@supabase/supabase-js';

export type Aniversariante = {
  id: string;
  nome: string;
  telefone: string | null;
  dia: number;
  mes: number;
  idade: number; // idade que vai completar
  faltam: number; // dias até o aniversário (0 = hoje)
};

const DIA_MS = 86400000;

// data AAAA-MM-DD -> {ano, mes, dia}, sem passar por fuso horário
function partes(data: string) {
  const [ano, mes, dia] = data.split('-').map(Number);
  return { ano, mes, dia };
}

// quantos dias faltam para o próximo aniversário e a idade que o cliente completa
export function proximoAniversario(dataNascimento: string, hoje = new Date()) {
  const { ano, mes, dia } = partes(dataNascimento);
  const base = Date.UTC(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  // quem nasceu em 29/02 comemora em 28/02 nos anos não bissextos
  const data = (a: number) => {
    const bissexto = new Date(a, 1, 29).getDate() === 29;
    return Date.UTC(a, mes - 1, mes === 2 && dia === 29 && !bissexto ? 28 : dia);
  };
  let anoAniv = hoje.getFullYear();
  if (data(anoAniv) < base) anoAniv += 1;
  return { faltam: Math.round((data(anoAniv) - base) / DIA_MS), idade: anoAniv - ano };
}

export const diaMes = (dataNascimento: string) => {
  const { mes, dia } = partes(dataNascimento);
  return String(dia).padStart(2, '0') + '/' + String(mes).padStart(2, '0');
};

export const textoFaltam = (faltam: number) =>
  faltam === 0 ? 'Hoje' : faltam === 1 ? 'Amanhã' : 'Em ' + faltam + ' dias';

export async function listarAniversariantes(
  supabase: SupabaseClient,
  unidadeId: string,
  diasAFrente = 7
) {
  const { data, error } = await supabase
    .from('clientes')
    .select('id, nome, telefone, data_nascimento, ativo')
    .eq('unidade_id', unidadeId)
    .not('data_nascimento', 'is', null);
  // coluna ainda não criada (SQL 0019 não rodado): sem aviso, sem erro na tela
  if (error) return [] as Aniversariante[];

  return (data || [])
    .filter((c) => c.ativo !== false)
    .map((c) => {
      const { faltam, idade } = proximoAniversario(c.data_nascimento);
      const { mes, dia } = partes(c.data_nascimento);
      return { id: c.id, nome: c.nome, telefone: c.telefone, dia, mes, idade, faltam } as Aniversariante;
    })
    .filter((a) => a.faltam <= diasAFrente)
    .sort((a, b) => a.faltam - b.faltam || a.nome.localeCompare(b.nome));
}

// link do WhatsApp com a mensagem de parabéns (só números do telefone, com DDI 55)
export function linkParabens(a: Pick<Aniversariante, 'nome' | 'telefone'>) {
  const numeros = (a.telefone || '').replace(/\D/g, '');
  if (numeros.length < 10) return null;
  const completo = numeros.startsWith('55') && numeros.length >= 12 ? numeros : '55' + numeros;
  const primeiro = a.nome.trim().split(/\s+/)[0];
  const texto = `Parabéns, ${primeiro}! 🎉 Todo o nosso time deseja um feliz aniversário! Venha comemorar com a gente.`;
  return 'https://wa.me/' + completo + '?text=' + encodeURIComponent(texto);
}
