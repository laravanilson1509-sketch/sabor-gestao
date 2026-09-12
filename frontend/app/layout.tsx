'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import './globals.css';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  async function handleSair() {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  return (
    <html lang="pt-BR">
      <body className="bg-gray-900">
        <nav className="bg-gray-800 border-b border-gray-700">
          <div className="max-w-6xl mx-auto px-4 py-4 flex items-center gap-6">
            <Link href="/whatsapp" className="text-white hover:text-blue-400 font-medium transition">
              💬 WhatsApp
            </Link>
            <Link href="/estoque" className="text-white hover:text-blue-400 font-medium transition">
              📦 Estoque
            </Link>
            <Link href="/cadastros" className="text-white hover:text-blue-400 font-medium transition">
              📋 Cadastros
            </Link>
            <Link href="/delivery" className="text-white hover:text-blue-400 font-medium transition">
  🛵 Delivery
</Link>
            <button
              onClick={handleSair}
              className="ml-auto text-sm text-gray-400 hover:text-red-400 transition"
            >
              Sair
            </button>
          </div>
        </nav>
        <main>{children}</main>
      </body>
    </html>
  );
}