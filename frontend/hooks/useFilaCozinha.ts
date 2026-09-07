"use client";

// hooks/useFilaCozinha.ts
//
// Mantém a fila da cozinha sincronizada em tempo real: qualquer mudança em
// pedidos ou pedido_itens (nova venda, item avançando de status) recarrega
// a view automaticamente — é o que faz o KDS atualizar sozinho, sem F5.

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { getFilaCozinha } from "@/lib/queries/cozinha";

export function useFilaCozinha(unidadeId: string) {
  const [fila, setFila] = useState<Awaited<ReturnType<typeof getFilaCozinha>>>([]);
  const [carregando, setCarregando] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    let ativo = true;

    async function carregar() {
      const dados = await getFilaCozinha(supabase, unidadeId);
      if (ativo) {
        setFila(dados);
        setCarregando(false);
      }
    }

    carregar();

    const canal = supabase
      .channel(`cozinha-${unidadeId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "pedido_itens" }, carregar)
      .on("postgres_changes", { event: "*", schema: "public", table: "pedidos" }, carregar)
      .subscribe();

    return () => {
      ativo = false;
      supabase.removeChannel(canal);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unidadeId]);

  return { fila, carregando };
}
