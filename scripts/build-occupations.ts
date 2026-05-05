/**
 * Build data/occupations/{soc-codes,onet-titles,recognized-fields,
 * field-to-soc-map}.json from raw BLS + ONET sources.
 *
 * Sources land in data/occupations/_raw/:
 *   - soc-2018-definitions.xlsx — BLS SOC 2018 (867 detailed occupations)
 *   - onet-28-3/                — ONET 28.3 text database (1016 titles)
 *
 * Steps run by `npm run build:occupations`:
 *   1. soc-codes.json       — parse SOC xlsx → {soc_code, title,
 *                              major_group, description}
 *   2. onet-titles.json     — parse ONET Occupation Data + Sample of
 *                              Reported Titles → {onet_soc_code, title,
 *                              description, parent_soc, alt_titles[]}
 *   3. recognized-fields    — load skeleton, single Haiku 4.5 enrichment
 *      .json                 call (or 2 if too long), structured output
 *      [optional --enrich]
 *   4. field-to-soc-map     — pure derivation; walk recognized-fields,
 *      .json                 look up SOC titles + ONET sub-codes
 *
 * Run modes:
 *   tsx scripts/build-occupations.ts                 # 1 + 2 + 4
 *   tsx scripts/build-occupations.ts --enrich        # also runs 3
 *   tsx scripts/build-occupations.ts --only=soc      # just step 1
 *
 * --enrich is opt-in because it costs Anthropic tokens.
 */

import * as XLSX from 'xlsx';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { getAnthropic } from '@/lib/anthropic';

const REPO_ROOT = path.resolve(__dirname, '..');
const RAW_DIR = path.join(REPO_ROOT, 'data', 'occupations', '_raw');
const OUT_DIR = path.join(REPO_ROOT, 'data', 'occupations');

const args = new Set(process.argv.slice(2));
const onlyArg = process.argv.slice(2).find((a) => a.startsWith('--only='));
const ONLY = onlyArg?.split('=')[1] ?? null;

function shouldRun(step: string): boolean {
  if (!ONLY) return true;
  return ONLY === step;
}

/* -------------------------------------------------------------------- */
/* Step 1 — SOC                                                          */
/* -------------------------------------------------------------------- */

interface SocEntry {
  soc_code: string;
  title: string;
  major_group: string;
  description: string;
}

function buildSocCodes(): SocEntry[] {
  const wb = XLSX.read(
    require('node:fs').readFileSync(path.join(RAW_DIR, 'soc-2018-definitions.xlsx')),
    { type: 'buffer' },
  );
  const sheet = wb.Sheets[wb.SheetNames[0]!];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false }) as unknown[][];

  // BLS xlsx columns (after the four-row header preamble): SOC Group |
  // SOC Code | SOC Title | SOC Definition. Find the row whose first
  // cell == "SOC Group".
  let headerIdx = -1;
  for (let i = 0; i < Math.min(20, rows.length); i++) {
    const c0 = String((rows[i] ?? [])[0] ?? '').trim().toLowerCase();
    if (c0 === 'soc group') {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx === -1) throw new Error('SOC header row "SOC Group" not found in xlsx');

  const out: SocEntry[] = [];
  let majorGroup = '';
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const r = rows[i] ?? [];
    const group = String(r[0] ?? '').trim().toLowerCase();
    const code = String(r[1] ?? '').trim();
    const title = String(r[2] ?? '').trim();
    const def = String(r[3] ?? '').trim();

    if (group === 'major') {
      // Major-group rows carry "11-0000 / Management Occupations".
      majorGroup = `${code.slice(0, 2)} — ${title}`;
      continue;
    }
    if (group !== 'detailed') continue; // skip Minor + Broad umbrellas
    if (!/^\d{2}-\d{4}$/.test(code)) continue;

    out.push({ soc_code: code, title, major_group: majorGroup, description: def });
  }
  out.sort((a, b) => a.soc_code.localeCompare(b.soc_code));
  return out;
}

/* -------------------------------------------------------------------- */
/* Step 2 — ONET                                                         */
/* -------------------------------------------------------------------- */

interface OnetEntry {
  onet_soc_code: string;
  title: string;
  description: string;
  parent_soc: string;
  alt_titles: string[];
}

async function readTsv(filePath: string): Promise<string[][]> {
  const raw = await fs.readFile(filePath, 'utf-8');
  return raw
    .split(/\r?\n/)
    .filter((l) => l.length > 0)
    .map((l) => l.split('\t'));
}

async function buildOnetTitles(): Promise<OnetEntry[]> {
  const occRows = await readTsv(path.join(RAW_DIR, 'onet-28-3', 'Occupation Data.txt'));
  const sampleRows = await readTsv(path.join(RAW_DIR, 'onet-28-3', 'Sample of Reported Titles.txt'));

  const sampleHeader = sampleRows[0] ?? [];
  const sampleCodeCol = sampleHeader.findIndex((c) => c.toLowerCase().includes('o*net-soc code'));
  const sampleTitleCol = sampleHeader.findIndex((c) => c.toLowerCase().includes('reported job title'));

  const altByCode = new Map<string, string[]>();
  if (sampleCodeCol >= 0 && sampleTitleCol >= 0) {
    for (let i = 1; i < sampleRows.length; i++) {
      const r = sampleRows[i]!;
      const code = r[sampleCodeCol]?.trim();
      const title = r[sampleTitleCol]?.trim();
      if (!code || !title) continue;
      const arr = altByCode.get(code) ?? [];
      if (arr.length < 8 && !arr.includes(title)) arr.push(title);
      altByCode.set(code, arr);
    }
  }

  const out: OnetEntry[] = [];
  for (let i = 1; i < occRows.length; i++) {
    const [code, title, description] = occRows[i] ?? [];
    if (!code || !title) continue;
    const parent = code.split('.')[0]!;
    const alt = altByCode.get(code) ?? [];
    out.push({
      onet_soc_code: code.trim(),
      title: title.trim(),
      description: (description ?? '').trim(),
      parent_soc: parent,
      alt_titles: alt,
    });
  }
  out.sort((a, b) => a.onet_soc_code.localeCompare(b.onet_soc_code));
  return out;
}

/* -------------------------------------------------------------------- */
/* Step 3 — Haiku enrichment                                             */
/* -------------------------------------------------------------------- */

interface RecognizedField {
  field_label: string;
  domain: string;
  aliases: string[];
  typical_specializations: string[];
  representative_soc_codes: string[];
  goldilocks_specificity: 'broad_field' | 'specialty_within_field';
  notes: string | null;
}

interface SkeletonEntry {
  field_label: string;
  domain: string;
  representative_soc_codes: string[];
}

/**
 * Curated list of `field_label`s that are umbrella terms (broad_field).
 * Everything NOT in this set defaults to specialty_within_field — most
 * EB-1A petitioners stake out a narrowed specialty, so specialty is the
 * right default. Add to this list whenever a generic discipline name
 * sneaks in.
 */
const BROAD_FIELD_LABELS = new Set<string>([
  // Tech umbrella terms
  'software engineering',
  'data science',
  'database administration',
  'IT systems analysis',
  // Engineering disciplines
  'mechanical engineering', 'electrical engineering', 'civil engineering',
  'environmental engineering', 'biomedical engineering', 'aerospace engineering',
  'chemical engineering', 'industrial engineering', 'materials engineering',
  'nuclear engineering', 'mining engineering', 'petroleum engineering',
  'automotive engineering', 'marine engineering', 'agricultural engineering',
  'manufacturing engineering', 'electronics engineering', 'systems engineering',
  // Sciences
  'physics', 'chemistry', 'biology', 'mathematics', 'statistics',
  'geology', 'oceanography', 'astronomy', 'microbiology', 'genetics',
  'ecology', 'meteorology', 'environmental science', 'materials science',
  // Medicine umbrella professions
  'dentistry', 'pharmacy', 'physical therapy',
  // Arts umbrellas
  'fine art', 'architecture', 'graphic design', 'animation',
  'industrial design', 'fashion design', 'photography',
  // Business
  'marketing', 'accounting', 'auditing', 'human resources',
  // Education
  'higher education teaching', 'K-12 instruction', 'school administration',
  // Other
  'culinary arts', 'journalism', 'creative writing',
  'urban planning', 'agricultural management', 'public administration',
  'library science', 'religious leadership', 'sports coaching',
]);

/**
 * Deterministically enrich the skeleton from ONET + curated rules.
 * Returns:
 *   - the full array of recognized fields
 *   - the indices of any entries whose alias / specialization slots
 *     came up empty (these are the candidates for a Haiku gap-fill).
 */
function enrichDeterministically(
  skeleton: SkeletonEntry[],
  onet: OnetEntry[],
): { fields: RecognizedField[]; gapIndices: number[] } {
  // Index ONET: by parent SOC, accumulate alt_titles + sub-titles.
  const altByParent = new Map<string, string[]>();
  const subTitlesByParent = new Map<string, string[]>();
  for (const o of onet) {
    const arr = altByParent.get(o.parent_soc) ?? [];
    for (const t of o.alt_titles) {
      if (!arr.includes(t)) arr.push(t);
    }
    altByParent.set(o.parent_soc, arr);

    // Sub-titles (.01, .02, ...) are good specialization seeds. Skip the
    // .00 umbrella entry — that's the parent occupation itself.
    if (!o.onet_soc_code.endsWith('.00')) {
      const subs = subTitlesByParent.get(o.parent_soc) ?? [];
      if (!subs.includes(o.title)) subs.push(o.title);
      subTitlesByParent.set(o.parent_soc, subs);
    }
  }

  const norm = (s: string): string => s.toLowerCase().trim();

  const fields: RecognizedField[] = [];
  const gapIndices: number[] = [];

  for (let idx = 0; idx < skeleton.length; idx++) {
    const s = skeleton[idx]!;
    const labelLower = norm(s.field_label);
    const allParents = s.representative_soc_codes.map((c) => c.split('.')[0]!);

    // Union over ALL representative SOC parents — wider net than primary
    // alone. AI engineering, for example, maps to 15-1252 + 15-1221, and
    // 15-1252 has no ONET sub-codes while 15-1221 does.
    const aliasPool: string[] = [];
    const specPool: string[] = [];
    for (const parent of allParents) {
      for (const t of altByParent.get(parent) ?? []) {
        if (!aliasPool.includes(t)) aliasPool.push(t);
      }
      for (const t of subTitlesByParent.get(parent) ?? []) {
        if (!specPool.includes(t)) specPool.push(t);
      }
    }

    const aliases = aliasPool
      .filter((t) => norm(t) !== labelLower)
      .filter((t) => !labelLower.includes(norm(t)) && !norm(t).includes(labelLower))
      .slice(0, 3);

    const typical_specializations = specPool
      .filter((t) => norm(t) !== labelLower)
      .slice(0, 4);

    const goldilocks_specificity: 'broad_field' | 'specialty_within_field' =
      BROAD_FIELD_LABELS.has(s.field_label) ? 'broad_field' : 'specialty_within_field';

    const notes =
      s.representative_soc_codes.length > 1
        ? `Multi-SOC mapping (${s.representative_soc_codes.join(', ')}); attorney picks the closest fit per beneficiary.`
        : null;

    // Trigger Haiku when EITHER slot is below 2 entries — better to fill
    // proactively than ship a thin field that downstream prompts can't
    // benchmark against.
    if (aliases.length < 2 || typical_specializations.length < 2) {
      gapIndices.push(idx);
    }

    fields.push({
      field_label: s.field_label,
      domain: s.domain,
      aliases,
      typical_specializations,
      representative_soc_codes: s.representative_soc_codes,
      goldilocks_specificity,
      notes,
    });
  }

  return { fields, gapIndices };
}

const GapFillSchema = z.object({
  field_label: z.string(),
  aliases: z.array(z.string()),
  typical_specializations: z.array(z.string()),
});
const GapFillBatchSchema = z.object({ fills: z.array(GapFillSchema) });

const GAP_FILL_SYSTEM = `Fill aliases + typical_specializations for occupation labels that have no good ONET match yet (e.g., "AI engineering", "DevOps engineering"). Output structure: { fills: [{ field_label, aliases, typical_specializations }] }.

aliases: 2-3 LinkedIn-style alternate names. Drop the field_label itself. Do not invent acronyms.
typical_specializations: 3 narrower sub-areas an EB-1A beneficiary plausibly claims.

Keep both arrays terse. Order in your output must match input order.`;

async function fillGapsWithHaiku(
  fields: RecognizedField[],
  gapIndices: number[],
): Promise<void> {
  if (gapIndices.length === 0) return;
  const FORMAT = zodOutputFormat(GapFillBatchSchema);

  // ~80-100 output tokens per entry × N entries; cap each batch at 40
  // entries so output fits comfortably in 4K tokens with cache hits.
  const BATCH_SIZE = 40;
  const fillByLabel = new Map<string, z.infer<typeof GapFillSchema>>();

  for (let start = 0; start < gapIndices.length; start += BATCH_SIZE) {
    const slice = gapIndices.slice(start, start + BATCH_SIZE);
    const inputs = slice.map((i) => ({ field_label: fields[i]!.field_label }));
    const userMessage = JSON.stringify(inputs, null, 2);

    const response = await getAnthropic().messages.parse({
      model: 'claude-haiku-4-5',
      max_tokens: 4000,
      system: [
        { type: 'text', text: GAP_FILL_SYSTEM, cache_control: { type: 'ephemeral', ttl: '1h' } },
      ],
      messages: [{ role: 'user', content: userMessage }],
      output_config: { format: FORMAT },
    });
    if (!response.parsed_output) {
      throw new Error(`Gap-fill batch starting at ${start} did not return structured output`);
    }
    for (const fill of response.parsed_output.fills) {
      fillByLabel.set(fill.field_label, fill);
    }
    console.log(
      `[enrich] gap-fill batch ${Math.floor(start / BATCH_SIZE) + 1}: ${response.parsed_output.fills.length} entries, usage=${JSON.stringify(response.usage)}`,
    );
  }
  for (const idx of gapIndices) {
    const f = fields[idx]!;
    const fill = fillByLabel.get(f.field_label);
    if (!fill) continue;
    // Only overwrite slots that are below the deterministic threshold;
    // keep ONET-derived content when it's already strong.
    if (f.aliases.length < 2) f.aliases = fill.aliases.slice(0, 3);
    if (f.typical_specializations.length < 2) {
      f.typical_specializations = fill.typical_specializations.slice(0, 4);
    }
  }
}

async function enrichSkeleton(
  skeleton: SkeletonEntry[],
  onet: OnetEntry[],
): Promise<RecognizedField[]> {
  const { fields, gapIndices } = enrichDeterministically(skeleton, onet);
  console.log(
    `[enrich] deterministic: ${fields.length - gapIndices.length}/${fields.length} filled from ONET; ${gapIndices.length} gaps need Haiku`,
  );
  await fillGapsWithHaiku(fields, gapIndices);
  return fields;
}

/* -------------------------------------------------------------------- */
/* Step 4 — field → SOC map                                              */
/* -------------------------------------------------------------------- */

interface FieldToSocEntry {
  field_label: string;
  primary_soc: string;
  primary_soc_title: string;
  alternate_socs: Array<{ soc_code: string; title: string; rationale: string }>;
  closest_onet_codes: string[];
}

function buildFieldSocMap(
  fields: Array<{ field_label: string; representative_soc_codes: string[] }>,
  socCodes: SocEntry[],
  onet: OnetEntry[],
): FieldToSocEntry[] {
  const socByCode = new Map(socCodes.map((s) => [s.soc_code, s]));
  const onetByParent = new Map<string, OnetEntry[]>();
  for (const o of onet) {
    const arr = onetByParent.get(o.parent_soc) ?? [];
    arr.push(o);
    onetByParent.set(o.parent_soc, arr);
  }

  // Skeleton entries occasionally carry ONET-format codes ("15-2099.01")
  // in representative_soc_codes. The map output normalizes to SOC parents
  // for primary_soc + alternate_socs and surfaces the original .NN codes
  // via closest_onet_codes.
  const toParentSoc = (c: string): string => c.split('.')[0]!;

  const out: FieldToSocEntry[] = [];
  for (const f of fields) {
    const codes = f.representative_soc_codes;
    if (codes.length === 0) continue;
    const primary = toParentSoc(codes[0]!);
    const primarySoc = socByCode.get(primary);
    const alternates = codes.slice(1).map((c) => {
      const parent = toParentSoc(c);
      const soc = socByCode.get(parent);
      return {
        soc_code: parent,
        title: soc?.title ?? `(SOC ${parent} not found in BLS list)`,
        rationale: `secondary mapping for "${f.field_label}"`,
      };
    });
    const onetCodes = new Set<string>();
    for (const c of codes) {
      // If the skeleton supplied an ONET sub-code directly, surface it.
      if (/\.\d{2}$/.test(c)) onetCodes.add(c);
      const matches = onetByParent.get(toParentSoc(c)) ?? [];
      for (const m of matches.slice(0, 3)) onetCodes.add(m.onet_soc_code);
    }
    out.push({
      field_label: f.field_label,
      primary_soc: primary,
      primary_soc_title: primarySoc?.title ?? `(SOC ${primary} not found in BLS list)`,
      alternate_socs: alternates,
      closest_onet_codes: [...onetCodes].sort(),
    });
  }
  out.sort((a, b) => a.field_label.localeCompare(b.field_label));
  return out;
}

/* -------------------------------------------------------------------- */
/* Main                                                                  */
/* -------------------------------------------------------------------- */

async function writeJson(filename: string, data: unknown): Promise<void> {
  const filePath = path.join(OUT_DIR, filename);
  await fs.writeFile(filePath, JSON.stringify(data, null, 2) + '\n');
  console.log(`[write] ${path.relative(REPO_ROOT, filePath)} (${Array.isArray(data) ? data.length : '?'} entries)`);
}

async function main(): Promise<void> {
  let socCodes: SocEntry[] = [];
  let onet: OnetEntry[] = [];

  if (shouldRun('soc')) {
    socCodes = buildSocCodes();
    await writeJson('soc-codes.json', socCodes);
  } else {
    socCodes = JSON.parse(await fs.readFile(path.join(OUT_DIR, 'soc-codes.json'), 'utf-8'));
  }

  if (shouldRun('onet')) {
    onet = await buildOnetTitles();
    await writeJson('onet-titles.json', onet);
  } else {
    onet = JSON.parse(await fs.readFile(path.join(OUT_DIR, 'onet-titles.json'), 'utf-8'));
  }

  const skeleton: SkeletonEntry[] = JSON.parse(
    await fs.readFile(path.join(OUT_DIR, '_recognized-fields-skeleton.json'), 'utf-8'),
  );

  let recognized: unknown[];
  if (args.has('--enrich') && shouldRun('enrich')) {
    recognized = await enrichSkeleton(skeleton, onet);
    await writeJson('recognized-fields.json', recognized);
  } else {
    try {
      recognized = JSON.parse(await fs.readFile(path.join(OUT_DIR, 'recognized-fields.json'), 'utf-8'));
    } catch {
      // Use skeleton as a placeholder when no enriched file exists yet.
      recognized = skeleton.map((s) => ({
        ...s,
        aliases: [],
        typical_specializations: [],
        goldilocks_specificity: 'broad_field' as const,
        notes: null,
      }));
    }
  }

  if (shouldRun('map')) {
    const map = buildFieldSocMap(
      recognized as Array<{ field_label: string; representative_soc_codes: string[] }>,
      socCodes,
      onet,
    );
    await writeJson('field-to-soc-map.json', map);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
