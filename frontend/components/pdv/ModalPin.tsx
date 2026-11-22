'use client';

// Janela para ações que precisam de autorização: pede motivo e o PIN de quem
// autoriza. Quem confere o PIN é o banco; aqui só mostramos o erro dele.

import { useState } from 'react';
import { BTN_PRIMARY, BTN_SECONDARY, INPUT, LABEL } from './estilos';

type Props = {
  titulo: string;
  descricao?: string;
  pedirPin?: boolean;
  pedirMotivo?: boolean;
  motivoObrigatorio?: boolean;
  sugestoesMotivo?: string[];
  textoConfirmar?: string;
  perigo?: boolean;
  children?: React.ReactNode; // campos extras (quantidade, valor...)
  onConfirmar: (dados: { pin: string; motivo: string }) => Promise<void>;
  onFechar: () => void;
};

export default function ModalPin({
  titulo,
  descricao,
  pedirPin = true,
  pedirMotivo = true,
  motivoObrigatorio = true,
  sugestoesMotivo = [],
  textoConfirmar = 'Confirmar',
  perigo = false,
  children,
  onConfirmar,
  onFechar,
}: Props) {
  const [pin, setPin] = useState('');
  const [motivo, setMotivo] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function confirmar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    if (pedirMotivo && motivoObrigatorio && !motivo.trim()) {
      setErro('Informe o motivo.');
      return;
    }
    if (pedirPin && !pin.trim()) {
      setErro('Digite o PIN de quem autoriza.');
      return;
    }
    setEnviando(true);
    try {
      await onConfirmar({ pin: pin.trim(), motivo: motivo.trim() });
    } catch (err: any) {
      setErro(err?.message || 'Não foi possível concluir.');
      setPin('');
    }
    setEnviando(false);
  }

  return (
    <div className="fixed inset-0 ui-modal-overlay flex items-center justify-center z-[60] p-4">
      <form
        onSubmit={confirmar}
        role="dialog"
        aria-label={titulo}
        className="ui-modal-panel p-6 w-full max-w-md space-y-4 max-h-[90vh] overflow-y-auto"
      >
        <div>
          <h2 className="text-lg font-bold text-ink">{titulo}</h2>
          {descricao && <p className="text-sm text-ink-muted mt-1">{descricao}</p>}
        </div>

        {children}

        {pedirMotivo && (
          <div>
            <label className={LABEL}>
              Motivo {motivoObrigatorio && <span className="text-danger">*</span>}
            </label>
            <input
              type="text"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              className={INPUT + ' w-full'}
              autoFocus
            />
            {sugestoesMotivo.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {sugestoesMotivo.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setMotivo(s)}
                    className="text-xs px-2.5 py-1 rounded-full border border-line text-ink-soft hover:bg-surface-hover"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {pedirPin && (
          <div>
            <label className={LABEL}>PIN de quem autoriza</label>
            <input
              type="password"
              inputMode="numeric"
              autoComplete="off"
              maxLength={6}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
              className={INPUT + ' w-full tracking-[0.5em] text-center text-lg'}
              autoFocus={!pedirMotivo}
            />
            <p className="text-xs text-ink-subtle mt-1">O nome de quem autorizou fica registrado.</p>
          </div>
        )}

        {erro && (
          <div role="alert" className="text-sm text-danger bg-danger-soft rounded-lg px-3 py-2">
            {erro}
          </div>
        )}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={enviando}
            className={
              perigo
                ? 'flex-1 bg-danger-solid hover:bg-danger-solid-hover disabled:opacity-50 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition'
                : BTN_PRIMARY + ' flex-1'
            }
          >
            {enviando ? 'Enviando...' : textoConfirmar}
          </button>
          <button type="button" onClick={onFechar} className={BTN_SECONDARY + ' flex-1'}>
            Voltar
          </button>
        </div>
      </form>
    </div>
  );
}
