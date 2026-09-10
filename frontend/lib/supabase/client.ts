// lib/supabase/client.ts
//
// Cliente Supabase para componentes client-side ('use client'). Usa a chave
// anon — todo o controle de acesso já é feito pelas policies de RLS do banco,
// então essa chave pode ficar exposta no frontend sem problema.
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}