import { AlertTriangle, CheckCircle2, Clipboard, Info, Loader2, ShieldAlert } from 'lucide-react';
import { canPerform } from '../../permissions';

export function EmptyState({ title = 'Nada para mostrar', description, action }) {
  return (
    <div className="empty-state">
      <Info size={20} />
      <div>
        <strong>{title}</strong>
        {description && <p>{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function LoadingState({ label = 'Carregando...' }) {
  return (
    <div className="loading-state" role="status" aria-live="polite">
      <Loader2 size={18} className="spin" />
      <span>{label}</span>
    </div>
  );
}

export function UserFriendlyError({ message = 'Nao foi possivel concluir a acao. Tente novamente.', retry }) {
  return (
    <div className="error-state" role="alert">
      <AlertTriangle size={19} />
      <div>
        <strong>Algo nao saiu como esperado</strong>
        <p>{message}</p>
      </div>
      {retry && (
        <button type="button" className="secondary-action" onClick={retry}>
          Tentar novamente
        </button>
      )}
    </div>
  );
}

export function TechnicalDetailsForAdmin({ session, details, title = 'Detalhes tecnicos' }) {
  if (!details || !canPerform(session, 'viewTechnicalDetails')) return null;

  const text = typeof details === 'string' ? details : JSON.stringify(details, null, 2);

  return (
    <details className="technical-details">
      <summary>
        <ShieldAlert size={16} />
        {title}
      </summary>
      <pre>{maskSecrets(text)}</pre>
    </details>
  );
}

export function CopyableCodeBlock({ session, value, label = 'Codigo' }) {
  if (!canPerform(session, 'viewTechnicalDetails')) return null;

  async function copy() {
    await navigator.clipboard?.writeText(maskSecrets(value));
  }

  return (
    <div className="copyable-code">
      <div>
        <strong>{label}</strong>
        <button type="button" className="secondary-action" onClick={copy}>
          <Clipboard size={15} />
          Copiar
        </button>
      </div>
      <pre>{maskSecrets(value)}</pre>
    </div>
  );
}

export function StatusBadge({ status, children }) {
  const normalized = String(status || '').toLowerCase();
  const tone =
    ['active', 'ready', 'operational', 'connected', 'success', 'ok'].includes(normalized)
      ? 'success'
      : ['pending', 'degraded', 'draft', 'warning'].includes(normalized)
        ? 'warning'
        : ['failed', 'error', 'inactive', 'disconnected'].includes(normalized)
          ? 'danger'
          : 'neutral';

  return <span className={`status-badge ${tone}`}>{children || status || 'Indefinido'}</span>;
}

export function Toast({ status, onDismiss }) {
  if (!status) return null;

  const type = status.type || 'info';
  const Icon = type === 'success' ? CheckCircle2 : type === 'error' ? AlertTriangle : Info;

  return (
    <div className={`toast ${type}`} role="status" aria-live="polite">
      <Icon size={18} />
      <span>{status.message || status}</span>
      {onDismiss && (
        <button type="button" className="icon-button" onClick={onDismiss} aria-label="Fechar aviso">
          x
        </button>
      )}
    </div>
  );
}

export function maskSecrets(value = '') {
  return String(value)
    .replace(/(token|secret|api[_-]?key|authorization|password)(["'\s:=]+)([^"',\s}]+)/gi, '$1$2********')
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/g, 'Bearer ********')
    .replace(/(sk|or)-[A-Za-z0-9_-]{12,}/g, '$1-********');
}
