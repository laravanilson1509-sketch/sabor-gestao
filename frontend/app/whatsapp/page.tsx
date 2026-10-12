import InboxBoard from '@/components/whatsapp/InboxBoard';

export default function WhatsAppPage() {
  const unidadeId = process.env.NEXT_PUBLIC_UNIDADE_ID!;
  return (
    <div className="p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <InboxBoard unidadeId={unidadeId} />
      </div>
    </div>
  );
}