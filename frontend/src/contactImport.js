export const contactImportFields = [
  { key: 'name', label: 'Nome' },
  { key: 'phone', label: 'Telefone' },
  { key: 'email', label: 'Email' },
  { key: 'tags', label: 'Tag' },
  { key: 'source', label: 'Origem' },
  { key: 'notes', label: 'Observacao' }
];

export function parseDelimitedText(text) {
  const rows = [];
  let field = '';
  let row = [];
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"' && quoted && next === '"') {
      field += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      quoted = !quoted;
      continue;
    }

    if (!quoted && (char === ',' || char === ';' || char === '\t')) {
      row.push(field.trim());
      field = '';
      continue;
    }

    if (!quoted && (char === '\n' || char === '\r')) {
      if (char === '\r' && next === '\n') index += 1;
      row.push(field.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      field = '';
      continue;
    }

    field += char;
  }

  row.push(field.trim());
  if (row.some(Boolean)) rows.push(row);

  if (!rows.length) return { headers: [], rows: [] };
  const headers = rows[0].map((header, index) => header || `Coluna ${index + 1}`);
  return {
    headers,
    rows: rows.slice(1).map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] || ''])))
  };
}

export function guessMapping(headers) {
  const normalized = headers.map((header) => normalizeHeader(header));

  function find(...needles) {
    const index = normalized.findIndex((header) => needles.some((needle) => header.includes(needle)));
    return index >= 0 ? headers[index] : '';
  }

  return {
    name: find('nome', 'name', 'cliente', 'contato'),
    phone: find('telefone', 'phone', 'whatsapp', 'celular', 'mobile'),
    email: find('email', 'e-mail', 'mail'),
    tags: find('tag', 'tags', 'segmento'),
    source: find('origem', 'source', 'canal'),
    notes: find('observacao', 'observacoes', 'nota', 'notes')
  };
}

export function mapImportRows(rows, mapping) {
  return rows.map((row, index) => {
    const mapped = {
      index: index + 2,
      name: valueFor(row, mapping.name),
      phone: normalizePhone(valueFor(row, mapping.phone)),
      email: valueFor(row, mapping.email),
      tags: splitTags(valueFor(row, mapping.tags)),
      source: valueFor(row, mapping.source),
      notes: valueFor(row, mapping.notes)
    };

    return {
      ...mapped,
      metadata: {
        source: mapped.source || 'importacao',
        notes: mapped.notes || undefined,
        importedAt: new Date().toISOString()
      }
    };
  });
}

export function validateImportRows(rows) {
  const phones = new Map();
  const validated = rows.map((row) => {
    const errors = [];

    if (!row.phone) errors.push('Telefone obrigatorio');
    if (row.phone && !isValidPhone(row.phone)) errors.push('Telefone invalido');
    if (row.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) errors.push('Email invalido');

    if (row.phone) {
      const count = phones.get(row.phone) || 0;
      phones.set(row.phone, count + 1);
    }

    return { ...row, errors };
  });

  return validated.map((row) => {
    if (row.phone && phones.get(row.phone) > 1) {
      return { ...row, errors: [...row.errors, 'Telefone duplicado no arquivo'] };
    }
    return row;
  });
}

export function summarizeImport(rows) {
  const valid = rows.filter((row) => row.errors.length === 0).length;
  const invalid = rows.length - valid;
  const duplicated = rows.filter((row) => row.errors.some((error) => error.includes('duplicado'))).length;

  return {
    total: rows.length,
    valid,
    invalid,
    duplicated
  };
}

export function rejectedRowsCsv(rows) {
  const rejected = rows.filter((row) => row.errors.length);
  const header = ['linha', 'nome', 'telefone', 'email', 'erros'];
  const lines = rejected.map((row) => [
    row.index,
    row.name,
    row.phone,
    row.email,
    row.errors.join(' | ')
  ]);

  return [header, ...lines].map((line) => line.map(csvCell).join(',')).join('\n');
}

function valueFor(row, key) {
  return key ? String(row[key] || '').trim() : '';
}

function splitTags(value) {
  return String(value || '')
    .split(/[;,|]/)
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function normalizePhone(value) {
  return String(value || '').replace(/[^\d+]/g, '').replace(/^\+/, '');
}

function isValidPhone(value) {
  const digits = normalizePhone(value);
  return digits.length >= 8 && digits.length <= 15;
}

function normalizeHeader(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function csvCell(value) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}
