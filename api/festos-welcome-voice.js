const clean = (value, fallback, max = 80) => {
  const text = String(value ?? '').replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim();
  return (text || fallback).slice(0, max);
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const openaiKey = process.env.OPENAI_API_KEY;
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseAnon = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!openaiKey || !supabaseUrl || !supabaseAnon) {
    return res.status(500).json({ error: 'Configuración de voz incompleta' });
  }

  const auth = String(req.headers.authorization || '');
  const token = auth.replace(/^Bearer\s+/i, '').trim();
  if (!token) return res.status(401).json({ error: 'Sesión requerida' });

  try {
    const authResponse = await fetch(`${supabaseUrl.replace(/\/$/, '')}/auth/v1/user`, {
      headers: {
        apikey: supabaseAnon,
        Authorization: `Bearer ${token}`,
      },
    });
    if (!authResponse.ok) return res.status(401).json({ error: 'Sesión inválida' });

    const saludo = clean(req.body?.saludo, 'Buenos días', 24);
    const nombre = clean(req.body?.nombre, 'usuario', 48);
    const cargo = clean(req.body?.cargo, 'usuario de FESTOS', 64);
    const input = `${saludo}, ${nombre}. Bienvenido a FESTOS Gestión. Tienes acceso como ${cargo}. Tu espacio de trabajo está listo.`;

    const speech = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini-tts-2025-12-15',
        voice: 'marin',
        input,
        instructions: 'Habla en español latino neutro, con una voz natural, cálida y profesional. Ritmo tranquilo, cercano y elegante, como un asistente empresarial moderno. Pronuncia FESTOS como FES-tos. Evita sonar como locutor o robot.',
        response_format: 'mp3',
        speed: 0.98,
      }),
    });

    if (!speech.ok) {
      const detail = await speech.text().catch(() => '');
      console.error('OpenAI TTS error', speech.status, detail.slice(0, 500));
      return res.status(502).json({ error: 'No se pudo generar la voz' });
    }

    const audio = Buffer.from(await speech.arrayBuffer());
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    return res.status(200).send(audio);
  } catch (error) {
    console.error('FESTOS welcome voice error', error);
    return res.status(500).json({ error: 'Error interno de voz' });
  }
}
