// middleware.ts
//
// Renova o token de sessão do Supabase a cada requisição e bloqueia acesso
// às páginas do sistema pra quem não estiver logado.
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

const ROTAS_PUBLICAS = ["/login"];

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  const rotaAtual = request.nextUrl.pathname;
  const ehRotaPublica = ROTAS_PUBLICAS.some((r) => rotaAtual.startsWith(r));

  // sem login e tentando acessar rota protegida -> manda pro login
  if (!user && !ehRotaPublica) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // já logado e tentando acessar /login -> manda pro sistema
  if (user && ehRotaPublica) {
    const url = request.nextUrl.clone();
    url.pathname = "/whatsapp";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};