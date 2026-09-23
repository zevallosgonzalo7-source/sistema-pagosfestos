import { cleanSpeech } from './commands.js';

// Solo actúa ante una coincidencia explícita, no por palabras aproximadas de una conversación.
// Variantes comunes de «Festos» en Whisper Base; no se activa por «hola» a secas.
const WAKE = /\b(?:hola|ola)\s+(?:a\s+)?(?:festos?|festus|festoz|pestos?|fextos)\b/;
const SLEEP = /\b(?:adios|hasta luego|descansa|duerme|deja de escuchar|modo espera)\s+(?:festos?|asistente)\b/;

export function wakeIntent(speech) {
  const normalized = cleanSpeech(speech).replace(/[.,;:!?¿¡]+/g, ' ').replace(/\s+/g, ' ').trim();
  const wake = WAKE.exec(normalized);
  if (!wake) return { wake: false, command: '' };
  return { wake: true, command: normalized.slice(wake.index + wake[0].length).replace(/^[\s,.;:!?-]+/, '').trim() };
}

export function sleepIntent(speech) {
  return SLEEP.test(cleanSpeech(speech));
}
