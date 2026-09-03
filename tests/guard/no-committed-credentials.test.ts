import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// A real account password and the production hostname were once committed in
// tests/. This guard fails the moment either string comes back anywhere under
// tests/** or in a root playwright*.ts config. Credentials and targets belong
// in E2E_* environment variables (see tests/README.md).
const FORBIDDEN = ['riisemap.org', 'RiiseMap20'] as const;

const REPO_ROOT = fileURLToPath(new URL('../..', import.meta.url));
// This file names the forbidden strings, so it is excluded from its own scan.
const SELF = fileURLToPath(import.meta.url);

type Hit = { file: string; line: number; pattern: string };

function listFilesRecursively(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (entry === 'node_modules') return [];
    return statSync(full).isDirectory() ? listFilesRecursively(full) : [full];
  });
}

function scannedFiles(): string[] {
  const underTests = listFilesRecursively(join(REPO_ROOT, 'tests'));
  const playwrightConfigs = readdirSync(REPO_ROOT)
    .filter((name) => /^playwright.*\.ts$/.test(name))
    .map((name) => join(REPO_ROOT, name));
  return [...underTests, ...playwrightConfigs].filter((file) => file !== SELF);
}

export function findForbiddenStrings(
  files: ReadonlyArray<{ path: string; content: string }>,
  patterns: ReadonlyArray<string>,
): Hit[] {
  return files.flatMap(({ path, content }) =>
    content
      .split('\n')
      .flatMap((text, index) =>
        patterns
          .filter((pattern) => text.includes(pattern))
          .map((pattern) => ({ file: path, line: index + 1, pattern })),
      ),
  );
}

describe('no committed credentials or production targets', () => {
  it('scans tests/** and root playwright*.ts', () => {
    const files = scannedFiles();
    const names = files.map((file) => relative(REPO_ROOT, file));
    // Sanity check the scan actually covers the files it is meant to protect.
    expect(names).toContain('tests/api-direct.spec.ts');
    expect(names).toContain('playwright.config.ts');
    expect(names).toContain('playwright.local.config.ts');
  });

  it('finds none of the forbidden strings', () => {
    const files = scannedFiles().map((path) => ({
      path: relative(REPO_ROOT, path),
      content: readFileSync(path, 'utf8'),
    }));
    const hits = findForbiddenStrings(files, FORBIDDEN);
    const report = hits
      .map((hit) => `${hit.file}:${hit.line} contains "${hit.pattern}"`)
      .join('\n');
    expect(
      hits,
      `Forbidden string(s) found — move them to E2E_* env vars:\n${report}`,
    ).toEqual([]);
  });
});
