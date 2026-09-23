import { cleanSpeech } from './commands.js';

export function answerSmallTalk(utterance, name = '', now = new Date()) {
  const t = cleanSpeech(utterance).replace(/[¿?¡!.,;:]/g, '').trim();
  const firstName = String(name || 'equipo').trim().split(/\s+/)[0];
  const greeting = now.getHours() < 12 ? 'Buenos días' : now.getHours() < 19 ? 'Buenas tardes' : 'Buenas noches';
  if (/^(?:hola|holaa|hey|buenos dias|buenas tardes|buenas noches|que tal|hola festos|hola asistente)(?:\s+(?:festos|asistente|como estas|buen dia|que tal))?$/.test(t)) return `¡${greeting}, ${firstName}! Soy el asistente de FESTOS. ¿En qué puedo ayudarte?`;
  if (/\b(?:que hora es|cual es la hora|dime la hora|hora actual|me dices la hora|tienes la hora|que horas son)\b/.test(t)) return `Son las ${new Intl.DateTimeFormat('es-PE',{hour:'numeric',minute:'2-digit',hour12:true}).format(now)} según la hora de este equipo.`;
  if (/\b(?:que dia es(?: hoy)?|cual es el dia(?: de hoy)?|dime que dia es|que fecha es|cual es la fecha|fecha de hoy|en que dia estamos|que dia estamos|dime el dia|dime la fecha|en que fecha estamos)\b/.test(t)) return `Hoy es ${new Intl.DateTimeFormat('es-PE',{weekday:'long',day:'numeric',month:'long',year:'numeric'}).format(now)}, según el calendario de este equipo.`;
  if (/\b(?:como estas|como te va|que tal estas)\b/.test(t)) return `¡Muy bien, ${firstName}! Estoy aquí para ayudarte con FESTOS.`;
  if (/\b(?:quien eres|como te llamas|que eres)\b/.test(t)) return `Soy FESTOS AI, tu asistente de voz. Puedo abrir apartados y consultar los datos del Dashboard proyectos.`;
  if (/\b(?:gracias|muchas gracias|te agradezco)\b/.test(t)) return `¡Con gusto, ${firstName}! Puedes seguir hablando.`;
  if (/\b(?:que puedes hacer|en que puedes ayudarme|ayuda|ejemplos de preguntas)\b/.test(t)) return `Puedo abrir Clientes, Proveedores, Cotizaciones, Proyectos, Dashboard y Centro de trabajo; preparar formularios y responder preguntas sobre venta, utilidad, costos, estados, ejecutivos, clientes y proveedores. También puedo decirte la hora y la fecha.`;
  return null;
}
