import { existsSync } from 'node:fs';
import { stat, readdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const base = join(root, 'public', 'voice-assets');
const model = join(base, 'models', 'Xenova', 'whisper-base');
const files = ['ready.json', 'models/Xenova/whisper-base/config.json',
  'models/Xenova/whisper-base/tokenizer.json',
  'models/Xenova/whisper-base/onnx/encoder_model_quantized.onnx',
  'models/Xenova/whisper-base/onnx/decoder_model_merged_quantized.onnx'];
let error = false;
try {
  const marker = JSON.parse(await (await import('node:fs/promises')).readFile(join(base, 'ready.json'), 'utf8'));
  if (marker.model !== 'Xenova/whisper-base') { console.error('El modelo preparado es antiguo; ejecuta npm run voice:prepare para activar whisper-base.'); error = true; }
} catch { console.error('Falta ready.json de voz.'); error = true; }
for (const name of files) {
  const path = join(base, name);
  if (!existsSync(path) || (await stat(path)).size < (name.endsWith('.onnx') ? 1000000 : 2)) {
    console.error(`Falta el componente de voz: ${name}`);
    error = true;
  }
}
const runtimeDir = join(base, 'onnx');
if (!existsSync(runtimeDir) || !(await readdir(runtimeDir)).some(name => name.endsWith('.wasm'))) {
  console.error('Falta el motor de inferencia ONNX en voice-assets/onnx.');
  error = true;
}
if (error) {
  console.error('\nNO se creará un instalador incompleto. En tu computadora de desarrollo ejecuta: npm install; npm run voice:prepare');
  process.exitCode = 1;
} else console.log('✓ Modelo y motor de voz presentes: aptos para incluir en el instalador.');
