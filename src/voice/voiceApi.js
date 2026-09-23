import { supabase } from '../supabaseClient';

// Nunca guardar una clave privada del proveedor de IA en la app distribuida.
export async function festosAssistant(mode, payload) {
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !session?.access_token) throw new Error('Inicia sesión para utilizar FESTOS Voz.');
  const url = `${supabase.supabaseUrl}/functions/v1/festos-assistant`;
  const isForm = payload instanceof FormData;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      apikey: supabase.supabaseKey,
      ...(isForm ? {} : { 'Content-Type': 'application/json' }),
    },
    body: isForm ? payload : JSON.stringify({ mode, ...payload }),
  });
  if (mode === 'speak' && response.ok) return response.blob();
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body.ok) throw new Error(body.error || `El servicio de voz respondió ${response.status}.`);
  return body;
}
