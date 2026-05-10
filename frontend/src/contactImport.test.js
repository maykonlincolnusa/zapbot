import test from 'node:test';
import assert from 'node:assert/strict';
import {
  guessMapping,
  mapImportRows,
  parseDelimitedText,
  rejectedRowsCsv,
  summarizeImport,
  validateImportRows
} from './contactImport.js';

test('parseDelimitedText parses CSV with quoted commas', () => {
  const parsed = parseDelimitedText('nome,telefone,email\n"Maria, Silva",+55 11 99999-0000,maria@example.com\n');

  assert.deepEqual(parsed.headers, ['nome', 'telefone', 'email']);
  assert.equal(parsed.rows[0].nome, 'Maria, Silva');
  assert.equal(parsed.rows[0].telefone, '+55 11 99999-0000');
});

test('guessMapping maps common Portuguese headers', () => {
  const mapping = guessMapping(['Nome do cliente', 'WhatsApp', 'E-mail', 'Origem']);

  assert.equal(mapping.name, 'Nome do cliente');
  assert.equal(mapping.phone, 'WhatsApp');
  assert.equal(mapping.email, 'E-mail');
  assert.equal(mapping.source, 'Origem');
});

test('validateImportRows detects invalid and duplicate phones', () => {
  const parsed = parseDelimitedText('nome,telefone,email\nAna,11999999999,ana@example.com\nBia,11999999999,bia@example.com\nCaio,,caio\n');
  const mapping = guessMapping(parsed.headers);
  const rows = validateImportRows(mapImportRows(parsed.rows, mapping));
  const summary = summarizeImport(rows);

  assert.equal(summary.total, 3);
  assert.equal(summary.valid, 0);
  assert.equal(summary.duplicated, 2);
  assert.match(rows[2].errors.join(','), /Telefone obrigatorio/);
  assert.match(rows[2].errors.join(','), /Email invalido/);
});

test('rejectedRowsCsv exports validation errors', () => {
  const rows = validateImportRows([
    { index: 2, name: 'Ana', phone: '', email: 'ana', tags: [], errors: ['Telefone obrigatorio', 'Email invalido'] }
  ]);

  assert.match(rejectedRowsCsv(rows), /Telefone obrigatorio/);
  assert.match(rejectedRowsCsv(rows), /Email invalido/);
});
