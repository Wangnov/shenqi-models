import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, prune, weld, simplify, textureCompress, meshopt } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder, MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';
import { mkdir, stat, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
await Promise.all([MeshoptEncoder.ready, MeshoptDecoder.ready, MeshoptSimplifier.ready]);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder,
});
await mkdir(path.join(root, 'public/models'), { recursive: true });
const report = [];
for (const slug of ['wild-dog-milk', 'chrysanthemum-drink', 'chunqiu-sausage']) {
  const source = path.join(root, '../models', slug, 'model.glb');
  const output = path.join(root, 'public/models', slug + '.glb');
  const document = await io.read(source);
  await document.transform(
    dedup(), prune(), weld(),
    simplify({ simplifier: MeshoptSimplifier, ratio: 0.3, error: 0.0005 }),
    textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [2048, 2048], quality: 88 }),
    meshopt({ encoder: MeshoptEncoder, level: 'medium' }),
  );
  await io.write(output, document);
  report.push({ model: slug, sourceBytes: (await stat(source)).size, webBytes: (await stat(output)).size });
  console.log(report.at(-1));
}
await writeFile(path.join(root, 'public/models/manifest.json'), JSON.stringify(report, null, 2) + '\n');
