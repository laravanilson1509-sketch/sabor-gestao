import { useId } from 'react';

type CamposAcessiveis = {
  id: string;
  'aria-describedby'?: string;
  'aria-invalid'?: true;
  'aria-required'?: true;
};

type Props = {
  label: string;
  erro?: string | null;
  dica?: string;
  obrigatorio?: boolean;
  children: (campo: CamposAcessiveis) => React.ReactNode;
};

// Rótulo + campo + dica/erro, já ligados para leitores de tela.
// Uso: <FormField label="Nome">{(c) => <input {...c} />}</FormField>
export default function FormField({ label, erro, dica, obrigatorio, children }: Props) {
  const id = useId();
  const idMensagem = id + '-msg';
  const mensagem = erro || dica;

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-ink mb-1">
        {label}
        {obrigatorio && <span className="text-danger" aria-hidden> *</span>}
      </label>
      {children({
        id,
        'aria-describedby': mensagem ? idMensagem : undefined,
        'aria-invalid': erro ? true : undefined,
        'aria-required': obrigatorio ? true : undefined,
      })}
      {mensagem && (
        <p id={idMensagem} role={erro ? 'alert' : undefined} className={'mt-1 text-xs ' + (erro ? 'text-danger' : 'text-ink-subtle')}>
          {mensagem}
        </p>
      )}
    </div>
  );
}

// classes padrão dos campos de texto
export const CAMPO =
  'w-full border border-line-strong rounded-token px-3 py-2.5 text-sm text-ink bg-surface placeholder:text-ink-subtle focus:outline-none focus:ring-2 focus:ring-accent aria-[invalid=true]:border-danger aria-[invalid=true]:focus:ring-danger';
