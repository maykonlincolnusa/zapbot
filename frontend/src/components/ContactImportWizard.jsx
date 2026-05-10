import { useMemo, useState } from 'react';
import { Download, FileSpreadsheet, Upload } from 'lucide-react';
import { api } from '../api';
import {
  contactImportFields,
  guessMapping,
  mapImportRows,
  parseDelimitedText,
  rejectedRowsCsv,
  summarizeImport,
  validateImportRows
} from '../contactImport';
import { EmptyState, StatusBadge } from './ui/Feedback';

const steps = ['Upload', 'Preview', 'Mapeamento', 'Validacao', 'Importar', 'Resultado'];

function fileKind(file) {
  const name = file?.name?.toLowerCase() || '';
  if (name.endsWith('.csv') || name.endsWith('.txt')) return 'csv';
  if (name.endsWith('.xlsx') || name.endsWith('.xls')) return 'xlsx';
  if (name.endsWith('.pdf')) return 'pdf';
  return 'unknown';
}

export default function ContactImportWizard({ open, onClose, onImported, setStatus }) {
  const [step, setStep] = useState(0);
  const [file, setFile] = useState(null);
  const [headers, setHeaders] = useState([]);
  const [rawRows, setRawRows] = useState([]);
  const [mapping, setMapping] = useState({});
  const [validatedRows, setValidatedRows] = useState([]);
  const [progress, setProgress] = useState({ status: 'pending', done: 0, total: 0, failed: 0 });

  const summary = useMemo(() => summarizeImport(validatedRows), [validatedRows]);
  const validRows = validatedRows.filter((row) => row.errors.length === 0);
  const unsupported = file && fileKind(file) !== 'csv';

  if (!open) return null;

  async function loadFile(nextFile) {
    setFile(nextFile);
    setHeaders([]);
    setRawRows([]);
    setValidatedRows([]);
    setProgress({ status: 'pending', done: 0, total: 0, failed: 0 });

    if (!nextFile) return;

    const kind = fileKind(nextFile);
    if (kind !== 'csv') {
      setStep(0);
      return;
    }

    const text = await nextFile.text();
    const parsed = parseDelimitedText(text);
    setHeaders(parsed.headers);
    setRawRows(parsed.rows);
    setMapping(guessMapping(parsed.headers));
    setStep(1);
  }

  function runValidation() {
    const mappedRows = mapImportRows(rawRows, mapping);
    const validated = validateImportRows(mappedRows);
    setValidatedRows(validated);
    setStep(3);
  }

  async function importContacts() {
    if (!validRows.length) {
      setStatus('Nao ha contatos validos para importar.', 'error');
      return;
    }

    setStep(4);
    setProgress({ status: 'processing', done: 0, total: validRows.length, failed: 0 });

    let failed = 0;
    for (let index = 0; index < validRows.length; index += 1) {
      const row = validRows[index];
      try {
        await api('/api/contacts', {
          method: 'POST',
          body: JSON.stringify({
            name: row.name,
            phone: row.phone,
            email: row.email,
            tags: row.tags,
            metadata: row.metadata
          })
        });
      } catch {
        failed += 1;
      }

      setProgress({ status: failed ? 'partial' : 'processing', done: index + 1, total: validRows.length, failed });
    }

    setProgress({ status: failed ? 'partial' : 'completed', done: validRows.length, total: validRows.length, failed });
    setStep(5);
    await onImported?.();
    setStatus(failed ? 'Importacao concluida com alguns erros.' : 'Contatos importados com sucesso.', failed ? 'error' : 'success');
  }

  function downloadRejected() {
    const blob = new Blob([rejectedRowsCsv(validatedRows)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'contatos-rejeitados.csv';
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="modal-overlay" role="presentation" onMouseDown={onClose}>
      <section className="modal-panel import-wizard" role="dialog" aria-label="Importar contatos" onMouseDown={(event) => event.stopPropagation()}>
        <header className="modal-header">
          <div>
            <h3>Importar contatos</h3>
            <p>Revise, mapeie e valide a planilha antes de gravar na base.</p>
          </div>
          <button type="button" className="secondary-action" onClick={onClose}>Fechar</button>
        </header>

        <div className="stepper" aria-label="Etapas da importacao">
          {steps.map((item, index) => (
            <span key={item} className={index === step ? 'active' : ''}>{index + 1}. {item}</span>
          ))}
        </div>

        {step === 0 && (
          <div className="import-drop">
            <Upload size={26} />
            <strong>Envie um arquivo CSV</strong>
            <p>CSV e TXT separados por virgula, ponto e virgula ou tabulacao funcionam agora. XLSX e PDF aparecem como formatos planejados e dependem de parser dedicado.</p>
            <input type="file" accept=".csv,.txt,.xlsx,.xls,.pdf" onChange={(event) => loadFile(event.target.files?.[0])} />
            {unsupported && (
              <div className="warning-note">
                {fileKind(file).toUpperCase()} ainda nao tem parser no front-end. Exporte a planilha como CSV para importar com seguranca nesta etapa.
              </div>
            )}
          </div>
        )}

        {step === 1 && (
          <div className="wizard-section">
            <div className="panel-title">
              <div>
                <h3>Preview</h3>
                <p>{rawRows.length} linhas encontradas. Confira a amostra antes do mapeamento.</p>
              </div>
              <FileSpreadsheet size={20} />
            </div>
            <div className="table import-table">
              <div className="table-row table-head" style={{ gridTemplateColumns: `repeat(${Math.max(headers.length, 1)}, minmax(140px, 1fr))` }}>
                {headers.map((header) => <span key={header}>{header}</span>)}
              </div>
              {rawRows.slice(0, 5).map((row, index) => (
                <div className="table-row" key={index} style={{ gridTemplateColumns: `repeat(${Math.max(headers.length, 1)}, minmax(140px, 1fr))` }}>
                  {headers.map((header) => <span key={header}>{row[header] || '-'}</span>)}
                </div>
              ))}
            </div>
            <div className="button-row">
              <button type="button" className="secondary-action" onClick={() => setStep(0)}>Voltar</button>
              <button type="button" onClick={() => setStep(2)}>Continuar</button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="form-grid">
            {contactImportFields.map((field) => (
              <label key={field.key}>
                {field.label}
                <select value={mapping[field.key] || ''} onChange={(event) => setMapping({ ...mapping, [field.key]: event.target.value })}>
                  <option value="">Nao importar</option>
                  {headers.map((header) => <option key={header} value={header}>{header}</option>)}
                </select>
              </label>
            ))}
            <div className="button-row">
              <button type="button" className="secondary-action" onClick={() => setStep(1)}>Voltar</button>
              <button type="button" onClick={runValidation}>Validar dados</button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="wizard-section">
            <div className="import-summary">
              <article><strong>{summary.total}</strong><span>Total</span></article>
              <article><strong>{summary.valid}</strong><span>Validos</span></article>
              <article><strong>{summary.invalid}</strong><span>Invalidos</span></article>
              <article><strong>{summary.duplicated}</strong><span>Duplicados</span></article>
            </div>
            <div className="stack-list">
              {validatedRows.filter((row) => row.errors.length).slice(0, 6).map((row) => (
                <article key={row.index}>
                  <strong>Linha {row.index}</strong>
                  <span>{row.name || row.phone || 'Contato sem identificacao'}</span>
                  <small>{row.errors.join(', ')}</small>
                </article>
              ))}
              {!summary.invalid && <EmptyState title="Dados prontos para importar" description="Nenhum problema encontrado nas linhas validadas." />}
            </div>
            <div className="button-row">
              <button type="button" className="secondary-action" onClick={() => setStep(2)}>Voltar</button>
              {summary.invalid > 0 && (
                <button type="button" className="secondary-action" onClick={downloadRejected}>
                  <Download size={16} />
                  Baixar rejeitados
                </button>
              )}
              <button type="button" onClick={importContacts} disabled={!summary.valid}>Importar {summary.valid} contatos</button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="wizard-section">
            <StatusBadge status={progress.status}>{progress.status === 'partial' ? 'Concluido com erros' : 'Processando'}</StatusBadge>
            <progress value={progress.done} max={progress.total || 1} />
            <p>{progress.done} de {progress.total} processados. {progress.failed ? `${progress.failed} falharam.` : ''}</p>
          </div>
        )}

        {step === 5 && (
          <div className="wizard-section">
            <StatusBadge status={progress.status === 'completed' ? 'success' : 'warning'}>
              {progress.status === 'completed' ? 'Concluido' : 'Concluido com erros'}
            </StatusBadge>
            <p>{progress.done - progress.failed} importados, {summary.invalid + progress.failed} rejeitados ou com erro.</p>
            <div className="button-row">
              {(summary.invalid > 0 || progress.failed > 0) && (
                <button type="button" className="secondary-action" onClick={downloadRejected}>
                  <Download size={16} />
                  Baixar rejeitados
                </button>
              )}
              <button type="button" onClick={onClose}>Finalizar</button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
