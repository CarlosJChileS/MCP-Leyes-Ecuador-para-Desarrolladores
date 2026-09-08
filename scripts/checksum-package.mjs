import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';

const archive = process.argv[2];
if (!archive) throw new Error('Uso: node scripts/checksum-package.mjs archivo.tgz');
const bytes = await readFile(resolve(archive));
const digest = createHash('sha512').update(bytes).digest('hex');
const output = `${resolve(archive)}.sha512`;
await writeFile(output, `${digest}  ${basename(archive)}\n`, 'utf8');
console.log(JSON.stringify({ archive: resolve(archive), algorithm: 'sha512', digest, checksum: output }, null, 2));
