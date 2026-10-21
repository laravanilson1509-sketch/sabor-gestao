import Logo from '@/components/Logo';

// Tela inicial: vazia por enquanto, só com a logo como marca d'água.
// Depois dá para colocar aqui contato de suporte, atalhos etc.
export default function Home() {
  return (
    <div className="min-h-[calc(100vh-3.5rem)] md:min-h-screen flex items-center justify-center overflow-hidden">
      <div aria-hidden className="opacity-[0.07] select-none pointer-events-none">
        <Logo tamanho={340} />
      </div>
    </div>
  );
}
