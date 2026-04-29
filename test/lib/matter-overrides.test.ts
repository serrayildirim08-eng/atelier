/**
 * lib/matter-overrides — persistent per-matter manual override store.
 *
 * Validates: CRUD on the JSON sidecar, validation rules, prune-on-empty.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  applyOverridePatch,
  getMatterOverride,
  readOverridesFile,
  isDocType,
} from '@/lib/matter-overrides';

let tmpDir: string;
let storePath: string;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'matter-overrides-'));
  storePath = join(tmpDir, 'overrides.json');
  process.env.MATTER_OVERRIDES_PATH = storePath;
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
  delete process.env.MATTER_OVERRIDES_PATH;
});

describe('isDocType', () => {
  it('accepts every enum value', () => {
    expect(isDocType('passport')).toBe(true);
    expect(isDocType('bank_statement')).toBe(true);
    expect(isDocType('other')).toBe(true);
  });
  it('rejects unknown values', () => {
    expect(isDocType('not-a-type')).toBe(false);
    expect(isDocType('')).toBe(false);
    expect(isDocType(42)).toBe(false);
    expect(isDocType(null)).toBe(false);
  });
});

describe('readOverridesFile', () => {
  it('returns empty object when file does not exist', async () => {
    const data = await readOverridesFile(storePath);
    expect(data).toEqual({});
  });

  it('returns empty object when file content is malformed', async () => {
    // Write bogus JSON and confirm we don't crash. Throws if the JSON itself
    // is invalid (caller should handle); empty object on shape mismatch.
    const fs = await import('node:fs/promises');
    await fs.writeFile(storePath, '[]', 'utf8');
    const data = await readOverridesFile(storePath);
    expect(data).toEqual({});
  });
});

describe('applyOverridePatch — matter display name', () => {
  it('writes a matter display name and persists to disk', async () => {
    await applyOverridePatch(
      {
        matter_root: '/abs/path/to/case-a',
        matter_display_name: 'Case A — Smith',
      },
      storePath,
    );
    const onDisk = JSON.parse(readFileSync(storePath, 'utf8'));
    expect(onDisk['/abs/path/to/case-a'].matter_display_name).toBe('Case A — Smith');
  });

  it('clears matter display name when set to null', async () => {
    await applyOverridePatch(
      { matter_root: '/abs/m', matter_display_name: 'Case M' },
      storePath,
    );
    await applyOverridePatch(
      { matter_root: '/abs/m', matter_display_name: null },
      storePath,
    );
    const ov = await getMatterOverride('/abs/m', storePath);
    // The matter is pruned because no documents and no display name remain.
    expect(ov).toBeNull();
  });

  it('rejects display names over 200 chars', async () => {
    await expect(
      applyOverridePatch(
        {
          matter_root: '/abs/m',
          matter_display_name: 'x'.repeat(201),
        },
        storePath,
      ),
    ).rejects.toThrow(/exceeds 200/);
  });

  it('trims whitespace and treats empty/whitespace as a clear', async () => {
    await applyOverridePatch(
      { matter_root: '/abs/m', matter_display_name: '  Spaced  ' },
      storePath,
    );
    let ov = await getMatterOverride('/abs/m', storePath);
    expect(ov?.matter_display_name).toBe('Spaced');

    await applyOverridePatch(
      { matter_root: '/abs/m', matter_display_name: '   ' },
      storePath,
    );
    ov = await getMatterOverride('/abs/m', storePath);
    expect(ov).toBeNull();
  });
});

describe('applyOverridePatch — document overrides', () => {
  it('writes a per-document display_name and doc_type_override', async () => {
    await applyOverridePatch(
      {
        matter_root: '/abs/m',
        document: {
          filename: 'Folder/passport.pdf',
          display_name: "John's passport",
          doc_type_override: 'passport',
        },
      },
      storePath,
    );
    const ov = await getMatterOverride('/abs/m', storePath);
    expect(ov?.documents['Folder/passport.pdf']).toMatchObject({
      display_name: "John's passport",
      doc_type_override: 'passport',
    });
    expect(ov?.documents['Folder/passport.pdf'].updated_at).toMatch(
      /^\d{4}-\d{2}-\d{2}T/,
    );
  });

  it('clears just the display_name when set to null', async () => {
    await applyOverridePatch(
      {
        matter_root: '/abs/m',
        document: {
          filename: 'a.pdf',
          display_name: 'Foo',
          doc_type_override: 'bank_statement',
        },
      },
      storePath,
    );
    await applyOverridePatch(
      { matter_root: '/abs/m', document: { filename: 'a.pdf', display_name: null } },
      storePath,
    );
    const ov = await getMatterOverride('/abs/m', storePath);
    expect(ov?.documents['a.pdf'].display_name).toBeUndefined();
    expect(ov?.documents['a.pdf'].doc_type_override).toBe('bank_statement');
  });

  it('clears just the doc_type_override when set to null', async () => {
    await applyOverridePatch(
      {
        matter_root: '/abs/m',
        document: {
          filename: 'a.pdf',
          display_name: 'Foo',
          doc_type_override: 'lease_or_property',
        },
      },
      storePath,
    );
    await applyOverridePatch(
      {
        matter_root: '/abs/m',
        document: { filename: 'a.pdf', doc_type_override: null },
      },
      storePath,
    );
    const ov = await getMatterOverride('/abs/m', storePath);
    expect(ov?.documents['a.pdf'].doc_type_override).toBeUndefined();
    expect(ov?.documents['a.pdf'].display_name).toBe('Foo');
  });

  it('removes the document entry when both fields are cleared', async () => {
    await applyOverridePatch(
      {
        matter_root: '/abs/m',
        matter_display_name: 'Keep me',
        document: {
          filename: 'a.pdf',
          display_name: 'Foo',
          doc_type_override: 'passport',
        },
      },
      storePath,
    );
    await applyOverridePatch(
      {
        matter_root: '/abs/m',
        document: {
          filename: 'a.pdf',
          display_name: null,
          doc_type_override: null,
        },
      },
      storePath,
    );
    const ov = await getMatterOverride('/abs/m', storePath);
    expect(ov?.documents['a.pdf']).toBeUndefined();
    // Matter survives because matter_display_name still set.
    expect(ov?.matter_display_name).toBe('Keep me');
  });

  it('rejects an invalid doc_type_override value', async () => {
    await expect(
      applyOverridePatch(
        {
          matter_root: '/abs/m',
          document: {
            filename: 'a.pdf',
            doc_type_override: 'not_a_doc_type' as never,
          },
        },
        storePath,
      ),
    ).rejects.toThrow(/valid DocType/);
  });

  it('does NOT touch the underlying file path on disk', async () => {
    // Applying the patch must only write the JSON sidecar; nothing else.
    await applyOverridePatch(
      {
        matter_root: '/abs/m',
        document: {
          filename: 'C - Applicant Information/passport.pdf',
          display_name: "John's passport",
        },
      },
      storePath,
    );
    expect(existsSync(storePath)).toBe(true);
    // No phantom matter directory was created.
    expect(existsSync('/abs/m')).toBe(false);
  });
});

describe('applyOverridePatch — matter prune semantics', () => {
  it('prunes the matter entry when no overrides remain', async () => {
    await applyOverridePatch(
      {
        matter_root: '/abs/m',
        matter_display_name: 'X',
        document: {
          filename: 'a.pdf',
          display_name: 'Foo',
        },
      },
      storePath,
    );
    await applyOverridePatch(
      {
        matter_root: '/abs/m',
        matter_display_name: null,
        document: { filename: 'a.pdf', display_name: null },
      },
      storePath,
    );
    const file = await readOverridesFile(storePath);
    expect(file['/abs/m']).toBeUndefined();
  });

  it('keeps unrelated matters untouched when one is patched', async () => {
    await applyOverridePatch(
      { matter_root: '/abs/m1', matter_display_name: 'M1' },
      storePath,
    );
    await applyOverridePatch(
      { matter_root: '/abs/m2', matter_display_name: 'M2' },
      storePath,
    );
    await applyOverridePatch(
      { matter_root: '/abs/m1', matter_display_name: 'M1 renamed' },
      storePath,
    );
    const file = await readOverridesFile(storePath);
    expect(file['/abs/m1'].matter_display_name).toBe('M1 renamed');
    expect(file['/abs/m2'].matter_display_name).toBe('M2');
  });
});
