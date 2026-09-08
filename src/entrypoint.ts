import { realpathSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export function isMainModule(
  importMetaUrl: string,
  argvPath: string | undefined,
  canonicalize: (path: string) => string = realpathSync,
) {
  if (!argvPath) return false;
  return sameFile(fileURLToPath(importMetaUrl), resolve(argvPath), canonicalize);
}

export function sameFile(left: string, right: string, canonicalize: (path: string) => string = realpathSync) {
  try {
    return canonicalize(left) === canonicalize(right);
  } catch {
    return left === right;
  }
}
