type Status = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

const ESTILO: Record<Status, string> = {
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning',
  danger: 'bg-danger-soft text-danger',
  info: 'bg-info-soft text-info',
  neutral: 'bg-surface-hover text-ink-muted',
};

// Etiqueta de situação: ponto + texto (nunca só cor)
export default function StatusBadge({ status, children }: { status: Status; children: React.ReactNode }) {
  return (
    <span className={'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ' + ESTILO[status]}>
      <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current" />
      {children}
    </span>
  );
}
