// Sólo el desarrollador ejecuta este paso ANTES de distribuir FESTOS.
// Ninguno de los usuarios finales necesita instalar programas, modelos ni claves.
import { createWriteStream, existsSync } from 'node:fs';
import { mkdir, readdir, rename, rm, stat, copyFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { pipeline as streamPipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const assets = join(root, 'public', 'voice-assets');
const repo = 'Xenova/whisper-base';
const modelDir = join(assets, 'models', ...repo.split('/'));
const required = [
  'config.json', 'generation_config.json', 'preprocessor_config.json',
  'tokenizer.json', 'tokenizer_config.json',
  'onnx/encoder_model_quantized.onnx',
  'onnx/decoder_model_merged_quantized.onnx',
];
const optional = ['special_tokens_map.json', 'LICENSE'];

async function download(file, optionalFile = false) {
  const target = join(modelDir, file);
  await mkdir(dirname(target), { recursive: true });
  const minimum = file.endsWith('.onnx') ? 1_000_000 : 2;
  if (existsSync(target) && (await stat(target)).size >= minimum) {
    console.log(`✓ ${file} disponible`);
    return;
  }
  const url = `https://huggingface.co/${repo}/resolve/main/${file}`;
  console.log(`↓ Modelo de voz: ${file}`);
  const response = await fetch(url, { signal: AbortSignal.timeout(900000) });
  if (optionalFile && response.status === 404) return;
  if (!response.ok || !response.body || /text\/html/i.test(response.headers.get('content-type') || '')) {
    throw new Error(`No se pudo descargar ${file}: HTTP ${response.status}`);
  }
  const part = `${target}.part`;
  try {
    await streamPipeline(Readable.fromWeb(response.body), createWriteStream(part));
    if ((await stat(part)).size < minimum) throw new Error(`Descarga incompleta: ${file}`);
    await rename(part, target);
  } catch (error) { await rm(part, { force: true }); throw error; }
}

await rm(join(assets, 'ready.json'), { force: true });
for (const file of required) await download(file);
for (const file of optional) await download(file, true);

// Copiar runtime WASM instalado por npm: ninguna descarga en equipos finales.
const choices = [
  join(root, 'node_modules', 'onnxruntime-web', 'dist'),
  join(root, 'node_modules', '@huggingface', 'transformers', 'node_modules', 'onnxruntime-web', 'dist'),
];
let wasmSource;
for (const choice of choices) {
  if (existsSync(choice) && (await readdir(choice)).some(name => name.endsWith('.wasm'))) {
    wasmSource = choice;
    break;
  }
}
if (!wasmSource) throw new Error('Falta onnxruntime-web. Ejecuta npm install antes de voice:prepare.');
const wasmDest = join(assets, 'onnx');
await mkdir(wasmDest, { recursive: true });
let runtimeFiles = 0;
for (const name of await readdir(wasmSource)) {
  if (/^ort-wasm.*\.(?:wasm|mjs|js)$/.test(name)) {
    await copyFile(join(wasmSource, name), join(wasmDest, name));
    runtimeFiles += 1;
  }
}
if (runtimeFiles < 2) throw new Error('No se pudieron empaquetar los archivos del motor WASM.');
await writeFile(join(assets, 'ready.json'), JSON.stringify({ model: repo, bundled: true, runtimeFiles }, null, 2) + '\n');
console.log('✓ Modelo y motor de voz empaquetados para el proyecto. Ya puedes compilar FESTOS.');
