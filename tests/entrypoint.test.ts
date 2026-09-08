import { describe, expect, it } from 'vitest';
import { sameFile } from '../src/entrypoint.js';

describe('main module detection', () => {
  it('recognizes equivalent macOS /var and /private/var paths', () => {
    const canonicalize = (path: string) => path.startsWith('/var/') ? `/private${path}` : path;
    expect(sameFile(
      '/private/var/folders/package/dist/server.js',
      '/var/folders/package/dist/server.js',
      canonicalize,
    )).toBe(true);
  });

  it('does not start when a different module imports the server', () => {
    expect(sameFile('/project/dist/server.js', '/project/tests/client.js', value => value)).toBe(false);
  });
});
