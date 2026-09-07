// lib/supabase/server.ts
//
// Cliente Supabase para Server Components e Server Actions. Lê/escreve os
// cookies de sessão do Next.js para saber quem é o usuário logado — é isso
// que faz auth.uid() funcionar dentro das policies de RLS no banco.

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/types/database";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // chamado a partir de um Server Component — o middleware
            // (veja middleware.ts) já cuida de renovar a sessão nesse caso
          }
        },
      },
    }
  );
}
