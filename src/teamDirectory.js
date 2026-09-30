export const FESTOS_TEAM = [
  { usuario: 'GONZALO', nombre: 'GONZALO VILLAVICENCIO' },
  { usuario: 'MAR', nombre: 'MARJORIE MUÑOZ' },
  { usuario: 'RODRIGO', nombre: 'RODRIGO ZEVALLOS' },
  { usuario: 'JESUS', nombre: 'JESUS JORGE' },
];

const TEAM_BY_CODE = Object.fromEntries(FESTOS_TEAM.map(member => [member.usuario, member.nombre]));
const CODE_BY_NAME = Object.fromEntries(FESTOS_TEAM.map(member => [member.nombre, member.usuario]));

export function codigoUsuario(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const upper = raw.toUpperCase();
  if (TEAM_BY_CODE[upper]) return upper;
  if (CODE_BY_NAME[upper]) return CODE_BY_NAME[upper];
  if (upper === 'MARJORIE') return 'MAR';
  if (upper === 'GONZALO VILLAVICENCIO') return 'GONZALO';
  if (upper === 'MARJORIE MUÑOZ') return 'MAR';
  if (upper === 'RODRIGO ZEVALLOS') return 'RODRIGO';
  if (upper === 'JESUS JORGE' || upper === 'JESÚS JORGE') return 'JESUS';
  return upper;
}

export function nombreCompletoUsuario(value, fallback = '') {
  const raw = String(value || '').trim();
  if (!raw) return fallback;
  const code = codigoUsuario(raw);
  return TEAM_BY_CODE[code] || raw;
}

export function opcionesEquipo(codes = null) {
  if (!Array.isArray(codes) || !codes.length) return FESTOS_TEAM;
  const allowed = new Set(codes.map(codigoUsuario));
  return FESTOS_TEAM.filter(member => allowed.has(member.usuario));
}
