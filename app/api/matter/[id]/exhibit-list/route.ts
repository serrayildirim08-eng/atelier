/**
 * GET /api/matter/[id]/exhibit-list
 *
 * Returns the matter's exhibit-index in three forms so the dashboard
 * can pick what it needs:
 *   - exhibit_list: structured JSON (tabs[] with items[])
 *   - markdown: full markdown index for display / export
 *   - compact: one-line-per-tab string for embedding in the cover letter
 *
 * Today reads from the mock matter store. Replace getMockTypedMemory
 * with the real per-matter typed-memory loader once persistence ships.
 * The pure logic in draft/exhibit-list.ts is store-agnostic — it
 * accepts a TypedMemory + optional alias map and produces the index.
 */

import { promises as fs } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import {
  buildExhibitList,
  renderExhibitListCompact,
  renderExhibitListMarkdown,
} from '@/draft/exhibit-list';
import { getMockTypedMemory } from '../mock-data';

export const runtime = 'nodejs';

const ALIAS_MAP_PATH =
  process.env.FILENAME_ALIAS_MAP_PATH ?? 'db/filename-aliases.json';

interface AliasEntry {
  alias?: string;
}

async function loadAliasesForMatter(matterId: string): Promise<Record<string, string>> {
  try {
    const raw = await fs.readFile(
      join(process.cwd(), ALIAS_MAP_PATH),
      'utf8',
    );
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return {};
    const matterMap = (parsed as Record<string, Record<string, AliasEntry>>)[
      matterId
    ];
    if (typeof matterMap !== 'object' || matterMap === null) return {};
    const out: Record<string, string> = {};
    for (const [pdfPath, entry] of Object.entries(matterMap)) {
      if (entry && typeof entry.alias === 'string' && entry.alias.length > 0) {
        out[pdfPath] = entry.alias;
      }
    }
    return out;
  } catch {
    return {};
  }
}

export async function GET(
  _request: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await ctx.params;

  // Reserve homedir() for future per-matter typed-memory persistence
  // under ~/akalan-context/<matter>/typed-memory.json. Today the mock
  // is the source of truth.
  void homedir;

  const memory = getMockTypedMemory(id);
  const aliases = await loadAliasesForMatter(id);

  const list = buildExhibitList({ memory, aliases });
  const markdown = renderExhibitListMarkdown(list);
  const compact = renderExhibitListCompact(list);

  return Response.json({ exhibit_list: list, markdown, compact });
}
