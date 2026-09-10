'use client';

import Link from 'next/link';
import './globals.css';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body className="bg-gray-900">
        <nav className="bg-gray-800 border-b border-gray-700">
          <div className="max-w-6xl mx-auto px-4 py-4 flex gap-6">
            <Link href="/whatsapp" className="text-white hover:text-blue-400 font-medium transition">
              💬 WhatsApp
            </Link>
            <Link href="/estoque" className="text-white hover:text-blue-400 font-medium transition">
              📦 Estoque
            </Link>
            <Link href="/cadastros" className="text-white hover:text-blue-400 font-medium transition">
  📋 Cadastros
</Link>
          </div>
        </nav>
        <main>{children}</main>
      </body>
    </html>
  );
}
