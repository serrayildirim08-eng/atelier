/**
 * Persistent per-matter manual overrides — matter display name, per-document
 * display name, per-document doc_type override.
 *
 * SAFETY: this store is metadata-only. It NEVER renames the source folder
 * or any file on disk; the underlying paths stay untouched. The only side
 * effect is a JSON sidecar at db/matter-overrides.json.
 *
 * Keyed by absolute matter_root path (collision-safe across same-basename
 * matters), so re-opening the same folder picks corrections back up.
 *
 * Sidecar shape:
 *   {
 *     "<absolute matter_root>": {
 *       "matter_root": "<absolute path>",
 *       "matter_display_name": "Smith — E2 renewal",
 *       "documents": {
 *         "<relative filename>": {
 *           "display_name": "John's passport",
 *           "doc_type_override": "passport",
 *           "updated_at": "2026-04-29T..."
 *         }
 *       }
 *     }
 *   }
 */

import { promises as fs } from 'node:fs';
import { dirname } from 'node:path';
import { DocTypeEnum, type DocType } from '@/ingest/typed-memory';

/** Resolved at call time so tests can override via env var per-suite. */
export function getOverridesPath(): string {
  return process.env.MATTER_OVERRIDES_PATH ?? 'db/matter-overrides.json';
}

export interface DocumentOverride {
  display_name?: string | null;
  doc_type_override?: DocType | null;
  updated_at?: string;
}

export interface MatterOverride {
  matter_root: string;
  matter_display_name?: string | null;
  documents: Record<string, DocumentOverride>;
}

export type OverridesFile = Record<string, MatterOverride>;

export function isDocType(value: unknown): value is DocType {
  return typeof value === 'string' && DocTypeEnum.safeParse(value).success;
}

export async function readOverridesFile(
  pathOverride?: string,
): Promise<OverridesFile> {
  const target = pathOverride ?? getOverridesPath();
  try {
    const raw = await fs.readFile(target, 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as OverridesFile;
    }
    return {};
  } catch (e: unknown) {
    if (e instanceof Error && (e as NodeJS.ErrnoException).code === 'ENOENT') {
      return {};
    }
    throw e;
  }
}

async function writeOverridesFile(
  data: OverridesFile,
  pathOverride?: string,
): Promise<void> {
  const target = pathOverride ?? getOverridesPath();
  await fs.mkdir(dirname(target), { recursive: true });
  await fs.writeFile(target, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

export async function getMatterOverride(
  matterRoot: string,
  pathOverride?: string,
): Promise<MatterOverride | null> {
  const data = await readOverridesFile(pathOverride);
  return data[matterRoot] ?? null;
}

export interface DocumentPatch {
  filename: string;
  display_name?: string | null;
  doc_type_override?: DocType | null;
}

export interface UpsertPatch {
  matter_root: string;
  matter_display_name?: string | null;
  document?: DocumentPatch;
}

/**
 * Apply a patch to the overrides file. Reads, mutates, writes.
 *
 *  - matter_display_name === null clears the matter display name
 *  - document.display_name === null clears the per-document display name
 *  - document.doc_type_override === null clears the per-document override
 *  - undefined fields are left untouched
 *  - empty matter entries (no display name and no documents) are pruned
 */
export async function applyOverridePatch(
  patch: UpsertPatch,
  pathOverride?: string,
): Promise<MatterOverride | null> {
  const data = await readOverridesFile(pathOverride);
  const now = new Date().toISOString();
  const existing: MatterOverride = data[patch.matter_root] ?? {
    matter_root: patch.matter_root,
    documents: {},
  };

  if (patch.matter_display_name !== undefined) {
    if (patch.matter_display_name === null) {
      delete existing.matter_display_name;
    } else {
      const trimmed = patch.matter_display_name.trim();
      if (trimmed.length === 0) {
        delete existing.matter_display_name;
      } else if (trimmed.length > 200) {
        throw new Error('matter_display_name exceeds 200 chars');
      } else {
        existing.matter_display_name = trimmed;
      }
    }
  }

  if (patch.document) {
    const docPatch = patch.document;
    const filename = docPatch.filename;
    if (!filename || filename.length === 0 || filename.length > 500) {
      throw new Error('document.filename must be non-empty and under 500 chars');
    }
    const docs = existing.documents ?? {};
    const current: DocumentOverride = docs[filename] ?? {};

    if (docPatch.display_name !== undefined) {
      if (docPatch.display_name === null) {
        delete current.display_name;
      } else {
        const trimmed = docPatch.display_name.trim();
        if (trimmed.length === 0) {
          delete current.display_name;
        } else if (trimmed.length > 200) {
          throw new Error('document.display_name exceeds 200 chars');
        } else {
          current.display_name = trimmed;
        }
      }
    }

    if (docPatch.doc_type_override !== undefined) {
      if (docPatch.doc_type_override === null) {
        delete current.doc_type_override;
      } else {
        if (!isDocType(docPatch.doc_type_override)) {
          throw new Error('document.doc_type_override must be a valid DocType');
        }
        current.doc_type_override = docPatch.doc_type_override;
      }
    }

    current.updated_at = now;

    if (
      current.display_name === undefined &&
      current.doc_type_override === undefined
    ) {
      delete docs[filename];
    } else {
      docs[filename] = current;
    }
    existing.documents = docs;
  }

  const docCount = Object.keys(existing.documents ?? {}).length;
  if (!existing.matter_display_name && docCount === 0) {
    delete data[patch.matter_root];
    await writeOverridesFile(data, pathOverride);
    return null;
  }

  data[patch.matter_root] = existing;
  await writeOverridesFile(data, pathOverride);
  return existing;
}
