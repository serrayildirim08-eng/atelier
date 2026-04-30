/**
 * Per-matter typedMemory snapshot — disk-backed cache that survives
 * Electron restarts and page reloads without hitting localStorage's
 * ~5MB quota.
 *
 * Why disk: a 1000+ page matter with rich extractions can easily blow
 * past localStorage's per-origin quota. The browser silently fails the
 * write, the next reload reads empty, and the user thinks the matter
 * "got deleted." Storing the snapshot under db/matter-snapshot/<hash>
 * gives us O(disk) headroom and clean rehydration.
 *
 * Each snapshot is keyed by a sha256 of the absolute matter_root, so
 * two matters with the same basename in different folders don't
 * collide. The store sits next to db/matter-overrides.json and follows
 * the same fail-soft conventions.
 */

import { promises as fs } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';

function getStoreDir(): string {
  return process.env.MATTER_SNAPSHOT_DIR ?? 'db/matter-snapshot';
}

function snapshotPath(matterRoot: string): string {
  const hash = createHash('sha256').update(matterRoot).digest('hex');
  return join(getStoreDir(), `${hash}.json`);
}

export interface MatterSnapshot {
  matter_root: string;
  written_at: string;
  /** Opaque to this layer — page.tsx defines the TypedMemory shape. */
  typed_memory: unknown;
  /** Optional: filename → result.filename if multi-matter rehydrate is wanted. */
  matter_filename?: string;
}

export async function readMatterSnapshot(
  matterRoot: string,
): Promise<MatterSnapshot | null> {
  const path = snapshotPath(matterRoot);
  try {
    const raw = await fs.readFile(path, 'utf8');
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed === 'object' &&
      typeof parsed.matter_root === 'string' &&
      'typed_memory' in parsed
    ) {
      return parsed as MatterSnapshot;
    }
    return null;
  } catch (e: unknown) {
    if (e instanceof Error && (e as NodeJS.ErrnoException).code === 'ENOENT') {
      return null;
    }
    throw e;
  }
}

export async function writeMatterSnapshot(
  matterRoot: string,
  typedMemory: unknown,
  matterFilename?: string,
): Promise<void> {
  const dir = getStoreDir();
  await fs.mkdir(dir, { recursive: true });
  const target = snapshotPath(matterRoot);
  const payload: MatterSnapshot = {
    matter_root: matterRoot,
    written_at: new Date().toISOString(),
    typed_memory: typedMemory,
    matter_filename: matterFilename,
  };
  // Write to a tmp file then rename so partial writes don't corrupt
  // the snapshot on power loss / Electron crash.
  const tmp = `${target}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(payload), 'utf8');
  await fs.rename(tmp, target);
}

export async function deleteMatterSnapshot(matterRoot: string): Promise<void> {
  try {
    await fs.unlink(snapshotPath(matterRoot));
  } catch (e: unknown) {
    if (e instanceof Error && (e as NodeJS.ErrnoException).code === 'ENOENT') {
      return;
    }
    throw e;
  }
}
