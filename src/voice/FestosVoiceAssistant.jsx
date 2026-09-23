import React, { useEffect, useRef, useState } from 'react';
import { FestosIcon } from '../FestosIcon';
import { speakLocally, transcribeOffline } from './offlineSpeech';
import { wakeIntent, sleepIntent } from './wakeWord.js';

const MAX_SEGMENT_MS = 22000;
const SILENCE_MS = 1750; // Evitar cortar «Hola Festos» antes de terminar de hablar.
const MAX_AUDIO_BYTES = 10 * 1024 * 1024;

/** Escucha de espera automática al entrar en una sesión autenticada.
 * Los comandos solo se atienden después de reconocer «Hola Festos».
 * La escucha se pausa durante la transcripción y la respuesta hablada.
 */
export function FestosVoiceAssistant({ onCommand, latestFeedback, accountKey = '' }) {
  const session = useRef(false);
  const generation = useRef(0);
  const recorder = useRef(null);
  const stream = useRef(null);
  const recognizer = useRef(null);
  const timeout = useRef(null);
  const monitor = useRef(null);
  const audioCtx = useRef(null);
  const chunks = useRef([]);
  const transcriptHandled = useRef(false);
  const onCommandRef = useRef(onCommand);
  const speakRef = useRef(true);
  const wakeStorageKey = `festos_wake_enabled:${accountKey}`;
  const [wakeEnabled, setWakeEnabled] = useState(() => localStorage.getItem(wakeStorageKey) !== '0');
  const wakeEnabledRef = useRef(wakeEnabled);
  wakeEnabledRef.current = wakeEnabled;
  const [active, setActive] = useState(false);
  const activeRef = useRef(false);
  const setConversationActive = (enabled) => { activeRef.current = enabled; setActive(enabled); };
  const [listening, setListening] = useState(false);
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [draft, setDraft] = useState('');
  const [lastUtterance, setLastUtterance] = useState('');
  const [feedback, setFeedback] = useState('FESTOS iniciará la escucha automática. Di «Hola Festos» cuando esté en espera.');
  const [speakEnabled, setSpeakEnabled] = useState(true);
  const [micError, setMicError] = useState(false);
  const isDesktop = !!window.festosDesktop?.isDesktop;
  onCommandRef.current = onCommand;
  speakRef.current = speakEnabled;

  useEffect(() => { if (latestFeedback?.text) setFeedback(latestFeedback.text); }, [latestFeedback]);

  function releaseCapture({ finish = false } = {}) {
    clearTimeout(timeout.current);
    clearInterval(monitor.current);
    timeout.current = null;
    monitor.current = null;
    const speech = recognizer.current;
    recognizer.current = null;
    if (speech) {
      speech.onend = null;
      speech.onresult = null;
      speech.onerror = null;
      try { finish ? speech.stop() : speech.abort(); } catch { /* ya finalizó */ }
    }
    const recording = recorder.current;
    recorder.current = null;
    if (recording && recording.state === 'recording') {
      if (!finish) recording.onstop = null;
      try { recording.stop(); } catch { /* ya finalizó */ }
    }
    stream.current?.getTracks().forEach(track => track.stop());
    stream.current = null;
    if (audioCtx.current) { void audioCtx.current.close().catch(() => {}); audioCtx.current = null; }
    setListening(false);
  }

  function halt() {
    session.current = false;
    generation.current += 1;
    setConversationActive(false);
    setBusy(false);
    releaseCapture();
    window.speechSynthesis?.cancel();
    setFeedback('Micrófono apagado.');
  }

  useEffect(() => {
    if (!wakeEnabled) {
      if (session.current) {
        session.current = false;
        generation.current += 1;
        setConversationActive(false);
        releaseCapture();
        window.speechSynthesis?.cancel();
      }
      return;
    }
    if (!session.current) {
      session.current = true;
      generation.current += 1;
      const token = generation.current;
      setConversationActive(false);
      setFeedback('Preparando el micrófono. Cuando esté en espera, di «Hola Festos».');
      setMicError(false);
      void startListening(token);
    }
    // El apagado explícito se realiza al desmarcar la opción de voz.
  }, [wakeEnabled]);

  useEffect(() => () => {
    session.current = false;
    generation.current += 1;
    clearTimeout(timeout.current);
    clearInterval(monitor.current);
    try { recognizer.current?.abort(); } catch { /* salir */ }
    if (recorder.current?.state === 'recording') { recorder.current.onstop = null; recorder.current.stop(); }
    stream.current?.getTracks().forEach(track => track.stop());
    if (audioCtx.current) void audioCtx.current.close().catch(() => {});
    window.speechSynthesis?.cancel();
  }, []);

  async function processUtterance(input, token, { resume = true } = {}) {
    let text = String(input || '').trim();
    if (wakeEnabledRef.current) {
      if (!activeRef.current) {
        const wake = wakeIntent(text);
        if (!wake.wake) {
          // En espera: no mostrar, guardar ni responder a conversaciones ajenas a FESTOS.
          if (resume && session.current && token === generation.current) void startListening(token);
          return;
        }
        setConversationActive(true);
        if (!wake.command) {
          setFeedback('Hola, te escucho. ¿En qué puedo ayudarte?');
          if (speakRef.current) await speakLocally('Hola, te escucho. ¿En qué puedo ayudarte?');
          if (resume && session.current && token === generation.current) void startListening(token);
          return;
        }
        text = wake.command;
      } else if (sleepIntent(text)) {
        setConversationActive(false);
        setFeedback('FESTOS está en espera. Di «Hola Festos» para volver a hablar.');
        if (resume && session.current && token === generation.current) void startListening(token);
        return;
      }
    }

    if (!text) {
      setFeedback('No reconocí palabras; sigo escuchando.');
      if (resume && session.current && token === generation.current) void startListening(token);
      return;
    }
    setLastUtterance(text);
    setBusy(true);
    setFeedback('FESTOS está preparando su respuesta…');
    try {
      const reply = await onCommandRef.current(text);
      if (token !== generation.current) return;
      if (typeof reply === 'string') {
        setFeedback(reply);
        if (speakRef.current) {
          try { await speakLocally(reply); } catch { /* El texto sigue visible */ }
        }
      }
    } catch (error) {
      if (token === generation.current) { setFeedback(error?.message || 'No pude atender la solicitud.'); setExpanded(true); }
    } finally {
      if (token === generation.current) {
        setBusy(false);
        if (resume && session.current) {
          setFeedback(current => current || 'Te sigo escuchando…');
          // Breve pausa tras responder: evita capturar la cola de la propia voz.
          timeout.current = setTimeout(() => { if (session.current && token === generation.current) void startListening(token); }, 380);
        }
      }
    }
  }

  async function startListening(token) {
    if (!session.current || generation.current !== token) return;
    releaseCapture();
    setMicError(false);
    setFeedback(wakeEnabledRef.current && !activeRef.current ? 'Esperando «Hola Festos»…' : 'Te escucho. Puedes decir «Hasta luego Festos» para volver al modo espera.');
    const BrowserRecognition = !isDesktop && (window.SpeechRecognition || window.webkitSpeechRecognition);
    if (BrowserRecognition) {
      try {
        const recognition = new BrowserRecognition();
        recognizer.current = recognition;
        transcriptHandled.current = false;
        recognition.lang = 'es-PE';
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;
        recognition.continuous = false;
        recognition.onresult = event => {
          if (!session.current || token !== generation.current || transcriptHandled.current) return;
          transcriptHandled.current = true;
          const utterance = event.results?.[event.resultIndex || 0]?.[0]?.transcript || '';
          recognizer.current = null;
          clearTimeout(timeout.current);
          setListening(false);
          try { recognition.abort(); } catch { /* ya terminó */ }
          void processUtterance(utterance, token);
        };
        recognition.onerror = event => {
          if (!session.current || token !== generation.current || transcriptHandled.current) return;
          recognizer.current = null;
          recognition.onend = null;
          setListening(false);
          clearTimeout(timeout.current);
          if (['not-allowed', 'service-not-allowed', 'audio-capture'].includes(event.error)) {
            session.current = false; setConversationActive(false); setMicError(true); setFeedback(`El navegador no permite usar el micrófono: ${event.error}. Revisa el permiso y desactiva/reactiva la escucha en Opciones.`); setExpanded(true);
          } else {
            setFeedback('No detecté palabras; sigo escuchando…');
            timeout.current = setTimeout(() => { if (session.current && token === generation.current) void startListening(token); }, 550);
          }
        };
        recognition.onend = () => {
          if (!session.current || token !== generation.current || transcriptHandled.current) return;
          recognizer.current = null;
          setListening(false);
          clearTimeout(timeout.current);
          timeout.current = setTimeout(() => { if (session.current && token === generation.current) void startListening(token); }, 550);
        };
        recognition.start();
        setListening(true);
        timeout.current = setTimeout(() => { try { recognition.stop(); } catch { /* ya finalizó */ } }, MAX_SEGMENT_MS);
      } catch (error) { session.current = false; setConversationActive(false); setMicError(true); setFeedback(`No pude iniciar el reconocimiento: ${error.message}. Revisa el micrófono y reactiva la escucha en Opciones.`); setExpanded(true); }
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder || !window.AudioContext) {
      session.current = false; setConversationActive(false); setMicError(true);
      setFeedback('Este navegador no admite el micrófono o el reconocimiento local de voz. Puedes escribir aquí.'); setExpanded(true); return;
    }
    try {
      const mic = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: false });
      if (!session.current || token !== generation.current) { mic.getTracks().forEach(t => t.stop()); return; }
      stream.current = mic;
      const ctx = new AudioContext();
      audioCtx.current = ctx;
      const source = ctx.createMediaStreamSource(mic);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      source.connect(analyser); // Nunca conectar el micrófono a los altavoces.
      const samples = new Float32Array(analyser.fftSize);
      const type = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find(t => MediaRecorder.isTypeSupported(t));
      const recording = new MediaRecorder(mic, type ? { mimeType: type } : undefined);
      recorder.current = recording;
      chunks.current = [];
      const started = Date.now();
      let voiceStarted = false;
      let spokenSince = 0;
      let lastVoice = started;
      let noise = 0;
      let samplesCount = 0;
      let finishing = false;
      const finishSegment = (force = false) => {
        if (finishing || recorder.current !== recording) return;
        finishing = true;
        clearTimeout(timeout.current);
        clearInterval(monitor.current);
        setListening(false);
        if (!voiceStarted && !force) {
          recording.onstop = null;
          releaseCapture();
          if (session.current && token === generation.current) void startListening(token);
          return;
        }
        try { recording.stop(); } catch { releaseCapture(); }
      };
      recording.ondataavailable = event => { if (event.data?.size) chunks.current.push(event.data); };
      recording.onstop = async () => {
        clearTimeout(timeout.current);
        clearInterval(monitor.current);
        const blob = new Blob(chunks.current, { type: recording.mimeType || 'audio/webm' });
        mic.getTracks().forEach(t => t.stop());
        if (stream.current === mic) stream.current = null;
        if (audioCtx.current === ctx) { audioCtx.current = null; void ctx.close().catch(() => {}); }
        if (recorder.current === recording) recorder.current = null;
        if (!session.current || token !== generation.current) return;
        if (blob.size < 300 || blob.size > MAX_AUDIO_BYTES) {
          setFeedback('No pude procesar esta frase; sigo escuchando.');
          void startListening(token); return;
        }
        setBusy(true);
        setFeedback('Transcribiendo tu frase en este equipo…');
        try {
          const utterance = await transcribeOffline(blob, message => {
            if (session.current && token === generation.current) setFeedback(message);
          });
          if (!session.current || token !== generation.current) return;
          setBusy(false);
          await processUtterance(utterance, token);
        } catch (error) {
          if (!session.current || token !== generation.current) return;
          setBusy(false);
          setFeedback(`No pude reconocer esta frase: ${error?.message || 'error de audio'}. Sigo escuchando.`);
          setExpanded(true);
          timeout.current = setTimeout(() => { if (session.current && token === generation.current) void startListening(token); }, 600);
        }
      };
      recording.start(350);
      setListening(true);
      // Detectar fin de frase por silencio; no cerrar la conversación.
      monitor.current = setInterval(() => {
        if (!session.current || token !== generation.current || recorder.current !== recording) return;
        analyser.getFloatTimeDomainData(samples);
        let energy = 0;
        for (let i = 0; i < samples.length; i++) energy += samples[i] * samples[i];
        const rms = Math.sqrt(energy / samples.length);
        if (samplesCount < 10) { noise += rms; samplesCount++; }
        const baseline = samplesCount ? noise / samplesCount : 0;
        const audible = rms > Math.max(0.0075, Math.min(0.0135, baseline * 1.8));
        const now = Date.now();
        if (audible) {
          if (!spokenSince) spokenSince = now;
          if (now - spokenSince >= 220) { voiceStarted = true; lastVoice = now; }
        } else spokenSince = 0;
        if (voiceStarted && now - lastVoice >= SILENCE_MS && now - started >= 1100) finishSegment();
      }, 100);
      timeout.current = setTimeout(() => finishSegment(), MAX_SEGMENT_MS);
    } catch (error) {
      if (!session.current || token !== generation.current) return;
      session.current = false; setConversationActive(false); setListening(false); setMicError(true);
      releaseCapture(); setExpanded(true);
      setFeedback(error?.name === 'NotAllowedError' ? 'Autoriza el micrófono para FESTOS en Windows o en tu navegador.' : `No pude activar el micrófono: ${error.message}`);
    }
  }

  function setWakeMode(enabled) {
    localStorage.setItem(wakeStorageKey, enabled ? '1' : '0');
    setWakeEnabled(enabled);
    if (!enabled) { setMicError(false); setFeedback('Escucha desactivada en este equipo.'); }
    else setFeedback('Activando escucha automática; di «Hola Festos» cuando esté en espera.');
  }

  function sendTyped(event) {
    event.preventDefault();
    if (!draft.trim() || busy) return;
    const value = draft.trim();
    setDraft('');
    // El texto también puede usarse mientras la sesión de voz permanece activa.
    const wasActive = session.current;
    if (wasActive) releaseCapture();
    void processUtterance(wakeEnabledRef.current && !activeRef.current ? `Hola Festos ${value}` : value, generation.current, { resume: wasActive });
  }

  return <div className={`festos-voice-dock ${expanded ? 'is-expanded' : ''}`} aria-label="Asistente de FESTOS">
    {expanded && <div className="festos-voice-panel" role="status" aria-live="polite">
      <div className="festos-voice-head"><strong><FestosIcon name="AudioLines" size={19}/> FESTOS · Conversación continua</strong><button type="button" onClick={() => setExpanded(false)} aria-label="Cerrar detalles">×</button></div>
      {lastUtterance && <p className="festos-voice-said"><span>Escuché</span> «{lastUtterance}»</p>}
      <p>{feedback}</p>
      <form onSubmit={sendTyped}><input value={draft} onChange={event => setDraft(event.target.value)} placeholder="Pregunta por el Dashboard, la fecha o la hora…" aria-label="Pregunta para FESTOS"/><button type="submit" disabled={!draft.trim() || busy} aria-label="Enviar pregunta"><FestosIcon name="Send" size={17}/></button></form>
      <label className="festos-voice-audio-option"><input type="checkbox" checked={wakeEnabled} onChange={event => setWakeMode(event.target.checked)}/> Escuchar «Hola Festos» automáticamente (desactiva aquí por privacidad)</label>
      <label className="festos-voice-audio-option"><input type="checkbox" checked={speakEnabled} onChange={event => { setSpeakEnabled(event.target.checked); if (!event.target.checked) window.speechSynthesis?.cancel(); }}/> Responder con voz</label>
      <small>{wakeEnabled ? 'La escucha empieza automáticamente al entrar. Puede necesitar permiso inicial del sistema/navegador y consume CPU. Para dejar de escuchar, desactiva la opción de arriba.' : 'El micrófono está desactivado. Puedes escribir consultas sin activarlo.'} Las consultas empresariales por voz solo se atienden tras decir «Hola Festos», con los permisos de tu cuenta.</small>
    </div>}
    <div className="festos-voice-bar festos-voice-handsfree" role="status" aria-live="polite">
      <span className={`festos-voice-indicator ${active ? 'is-active' : listening && wakeEnabled ? 'is-ready' : micError ? 'is-error' : ''}`} aria-hidden="true" />
      <span title={feedback}>{micError ? 'Micrófono no disponible' : !wakeEnabled ? 'FESTOS · Escucha apagada' : active ? busy ? 'FESTOS · Respondiendo…' : 'FESTOS · Te escucho' : listening ? 'FESTOS · Di «Hola Festos»' : 'FESTOS · Preparando escucha…'}</span>
      <button type="button" className="festos-voice-expand" onClick={() => setExpanded(v => !v)} aria-label={expanded ? 'Cerrar opciones de FESTOS' : 'Ver estado y opciones de FESTOS'} title="Estado y opciones; no necesitas pulsar para hablar"><FestosIcon name="MessageSquare" size={17}/></button>
    </div>
  </div>;
}
