import InboxBoard from '@/components/whatsapp/InboxBoard';

export default function WhatsAppPage() {
  const unidadeId = process.env.NEXT_PUBLIC_UNIDADE_ID!;
  return <InboxBoard unidadeId={unidadeId} />;
}
