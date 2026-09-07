import InboxBoard from "@/components/whatsapp/InboxBoard";

// Por ora, uma única unidade fixa via variável de ambiente. Quando o login
// multiunidade estiver pronto, troque isso por unidadeId vindo da sessão do
// usuário (ex: supabase.auth.getUser() + profiles.unidade_id).
const UNIDADE_ID = process.env.NEXT_PUBLIC_UNIDADE_ID ?? "";

export default function WhatsAppPage() {
  if (!UNIDADE_ID) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ backgroundColor: "#111316" }}>
        <p className="font-body text-sm text-center max-w-sm" style={{ color: "#E5606A" }}>
          Falta configurar NEXT_PUBLIC_UNIDADE_ID no arquivo .env.local — veja o .env.local.example
        </p>
      </div>
    );
  }

  return (
    <main className="min-h-screen px-4 sm:px-6 py-6 max-w-6xl mx-auto" style={{ backgroundColor: "#111316" }}>
      <InboxBoard unidadeId={UNIDADE_ID} />
    </main>
  );
}
