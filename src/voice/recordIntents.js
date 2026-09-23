import { cleanSpeech } from './commands.js';

const sanitize = text => String(text || '').trim().replace(/["'`]/g, '').slice(0, 100);
// Se responden únicamente consultas de lectura reconocidas. Nunca se traduce voz a SQL libre.
export function parseRecordQuestion(input) {
  const t = cleanSpeech(input);
  if (!t || !/\b(?:busca|buscar|encuentra|encuentrame|dime|muestra|mostrar|cual|cuanto|que|como|estado|detalle|informacion|telefono|ruc|condicion|precio|costo|utilidad|valor)\b/.test(t)) return null;
  const code = String(input).match(/\bPRY[- ]?\d{6}[- ]?\d{1,4}\b/i);
  const quoteCode = String(input).match(/\bCOT[-\w]{5,}\b/i);
  if (code || /\b(?:del|de este|de un|de mi) proyecto\b/.test(t)) {
    const target = code?.[0].replace(/\s/g, '-') || t.match(/\b(?:del|de este|de un|de mi) proyecto\s+(.+)$/)?.[1];
    return { kind: 'project', target: sanitize(target), byCode: !!code };
  }
  if (quoteCode || /\b(?:de la|de esta|de una) cotizacion\b/.test(t)) {
    const target = quoteCode?.[0] || t.match(/\b(?:de la|de esta|de una) cotizacion\s+(.+)$/)?.[1];
    return { kind: 'quote', target: sanitize(target), byCode: !!quoteCode };
  }
  const client = t.match(/\b(?:del|de la|de un|de una) cliente\s+(.+)$/);
  if (client) return { kind: 'client', target: sanitize(client[1]) };
  const provider = t.match(/\b(?:del|de la|de un|de una) proveedor(?:a)?\s+(.+)$/);
  if (provider) return { kind: 'provider', target: sanitize(provider[1]) };
  return null;
}
