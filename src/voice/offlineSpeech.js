// Transcripción LOCAL. No envía audio ni cifras al servidor de un proveedor.
// El instalador sólo queda completo después de npm run voice:prepare.
let transcriberPromise;

export async function transcribeOffline(blob, onProgress = () => {}) {
  const checkUrl = new URL(`${import.meta.env.BASE_URL}voice-assets/ready.json`, document.baseURI);
  const check = await fetch(checkUrl.href).catch(() => null);
  if (!check?.ok || (await check.json()).model !== 'Xenova/whisper-base') throw new Error('Falta el nuevo modelo de voz. Ejecuta npm run voice:prepare antes de iniciar FESTOS.');
  if (!transcriberPromise) {
    transcriberPromise = (async () => {
      onProgress('Preparando reconocimiento local (primera vez puede tardar)…');
      const { pipeline, env } = await import('@huggingface/transformers');
      env.allowLocalModels = true;
      env.allowRemoteModels = false;
      env.localModelPath = new URL(`${import.meta.env.BASE_URL}voice-assets/models/`, document.baseURI).href;
      env.backends.onnx.wasm.wasmPaths = new URL(`${import.meta.env.BASE_URL}voice-assets/onnx/`, document.baseURI).href;
      env.backends.onnx.wasm.numThreads = 1;
      return pipeline('automatic-speech-recognition', 'Xenova/whisper-base', { device: 'wasm', dtype: 'q8' });
    })().catch(error => { transcriberPromise = null; throw error; });
  }
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  try {
    const decoded = await ctx.decodeAudioData(await blob.arrayBuffer());
    const offline = new OfflineAudioContext(1, Math.ceil(decoded.duration * 16000), 16000);
    const source = offline.createBufferSource();
    source.buffer = decoded;
    source.connect(offline.destination);
    source.start();
    const mono = (await offline.startRendering()).getChannelData(0);
    onProgress('Reconociendo tu voz dentro de FESTOS…');
    const transcriber = await transcriberPromise;
    const result = await transcriber(mono, { language: 'spanish', task: 'transcribe', max_new_tokens: 128, return_timestamps: false });
    return String(result?.text || '').trim();
  } finally { await ctx.close().catch(() => {}); }
}

export function speakLocally(text) {
  if (!('speechSynthesis' in window)) return Promise.resolve();
  window.speechSynthesis.cancel();
  return new Promise(resolve => {
    const utterance = new SpeechSynthesisUtterance(String(text).slice(0, 950));
    utterance.lang = 'es-PE';
    utterance.rate = 0.97;
    const voices = window.speechSynthesis.getVoices();
    utterance.voice = voices.find(v => v.lang.toLowerCase().startsWith('es-pe')) || voices.find(v => v.lang.toLowerCase().startsWith('es')) || null;
    let finished = false;
    const done = () => { if (finished) return; finished = true; clearTimeout(timeout); resolve(); };
    const timeout = setTimeout(done, 24000);
    utterance.onend = done;
    utterance.onerror = done;
    try { window.speechSynthesis.speak(utterance); } catch { done(); }
  });
}
