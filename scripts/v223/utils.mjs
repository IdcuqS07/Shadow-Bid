import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

export function parseArgs(argv) {
  const args = {};

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (!token.startsWith('--')) {
      continue;
    }

    const key = token.slice(2);
    const next = argv[index + 1];

    if (!next || next.startsWith('--')) {
      args[key] = true;
      continue;
    }

    args[key] = next;
    index += 1;
  }

  return args;
}

export function repoRootFrom(importMetaUrl) {
  const here = path.dirname(fileURLToPath(importMetaUrl));
  return path.resolve(here, '..', '..');
}

export function nowIso() {
  return new Date().toISOString();
}

export function nowUnixSeconds() {
  return Math.floor(Date.now() / 1000);
}

export function timestampSlug() {
  return nowIso().replace(/[:.]/g, '-');
}

export function stableHex(seed) {
  return crypto.createHash('sha256').update(seed).digest('hex');
}

export function stableField(seed, bytes = 12) {
  const hex = stableHex(seed).slice(0, bytes * 2);
  return `${BigInt(`0x${hex}`)}field`;
}

export function literalU8(value) {
  return `${value}u8`;
}

export function literalU128(value) {
  return `${value}u128`;
}

export function literalI64(value) {
  return `${value}i64`;
}

export function leoRunTemplate({
  programDir,
  transition,
  inputs,
}) {
  return {
    program_dir: programDir,
    transition,
    inputs,
    example_cli: `cd ${programDir} && leo run ${transition} ${inputs.join(' ')}`,
  };
}

export async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

export async function writeJson(filePath, data) {
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

export async function readJsonFiles(dirPath) {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await readJsonFiles(fullPath)));
      continue;
    }

    if (!entry.name.endsWith('.json')) {
      continue;
    }

    const raw = await fs.readFile(fullPath, 'utf8');
    files.push({
      path: fullPath,
      data: JSON.parse(raw),
    });
  }

  return files;
}
