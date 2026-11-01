// Conteúdo padrão dos botões "voltar": seta + a palavra Voltar.
// Use dentro de <Link> ou <button> com className="btn-voltar".

export function ConteudoVoltar() {
  return (
    <>
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M15 5 L8 12 L15 19" />
      </svg>
      <span>Voltar</span>
    </>
  );
}
