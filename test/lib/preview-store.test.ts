/**
 * preview-store tests — pure filesystem, no Anthropic / network.
 *
 * Pinned behavior:
 *   - newPreviewId() is unique under tight loops (no collisions in 1k draws)
 *   - newPreviewId() is 26 chars Crockford-base32
 *   - writePreview → readPreview round-trips the full payload
 *   - listPreviews returns most-recent-first
 *   - recordApproval flips status + stamps initials/timestamps
 *   - recordRejection flips status + stamps reason
 *   - second approval/rejection on same preview is a no-op (status guard)
 *   - audit log appends one line per state transition
 *   - applyEdits mutates touched fields and tags source_quote='[attorney_edit]'
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  applyEdits,
  listPreviews,
  newPreviewId,
  readPreview,
  recordApproval,
  recordRejection,
  writePreview,
  type PreviewPayload,
} from '@/lib/preview-store';

let tmpDir: string;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'preview-store-test-'));
  process.env.PREVIEW_STORE_DIR = join(tmpDir, 'previews');
  process.env.PREVIEW_AUDIT_LOG_PATH = join(tmpDir, 'audit', 'preview-approvals.jsonl');
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
  delete process.env.PREVIEW_STORE_DIR;
  delete process.env.PREVIEW_AUDIT_LOG_PATH;
});

function samplePayload(matter = 'M-001', generator = 'cover_letter' as const): PreviewPayload {
  return {
    preview_id: newPreviewId(),
    generator,
    matter_id: matter,
    facts_used: [
      {
        field_path: 'investor.full_name',
        value: 'Mehmet Demir',
        source_doc: 'passport.pdf',
        source_page: 1,
        source_quote: 'Mehmet Demir',
        confidence: 0.99,
      },
    ],
    defensive_paragraphs_required: ['tapu_explanation'],
    authorities_to_cite: ['8 CFR 214.2(e)', '9 FAM 402.9-7(1)'],
    conflicts_to_flag_in_output: [],
    structural_outline: [
      { roman: 'I', heading: 'Introduction', one_line_summary: 'identify investor + petition' },
    ],
    estimated_output_length_tokens: 12000,
    estimated_cost_usd: 0.45,
    args: null,
    created_at: new Date().toISOString(),
  };
}

describe('newPreviewId', () => {
  it('produces a 26-char Crockford-base32 identifier', () => {
    const id = newPreviewId();
    expect(id).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
  });

  it('does not collide across 1000 tight draws', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 1000; i++) seen.add(newPreviewId());
    expect(seen.size).toBe(1000);
  });
});

describe('writePreview / readPreview round-trip', () => {
  it('persists the full payload and reads it back identically', async () => {
    const payload = samplePayload();
    const written = await writePreview(payload);
    const read = await readPreview(payload.matter_id, payload.preview_id);
    expect(read).not.toBeNull();
    expect(read?.preview_id).toBe(payload.preview_id);
    expect(read?.status).toBe('pending');
    expect(read?.facts_used).toEqual(written.facts_used);
  });

  it('returns null when the preview does not exist', async () => {
    const r = await readPreview('M-001', 'NONEXISTENT');
    expect(r).toBeNull();
  });
});

describe('listPreviews', () => {
  it('returns previews most-recent first', async () => {
    const p1 = samplePayload();
    p1.created_at = '2026-04-27T10:00:00.000Z';
    p1.preview_id = newPreviewId();
    await writePreview(p1);
    // Slight delay to keep filesystem mtimes distinct on some filesystems.
    await new Promise((res) => setTimeout(res, 5));
    const p2 = samplePayload();
    p2.created_at = '2026-04-28T10:00:00.000Z';
    p2.preview_id = newPreviewId();
    await writePreview(p2);
    const list = await listPreviews(p1.matter_id);
    expect(list[0].preview_id).toBe(p2.preview_id);
    expect(list[1].preview_id).toBe(p1.preview_id);
  });

  it('returns an empty array for matters with no previews', async () => {
    const list = await listPreviews('UNKNOWN-MATTER');
    expect(list).toEqual([]);
  });
});

describe('recordApproval', () => {
  it("flips status to 'approved' and stamps attorney + timestamps", async () => {
    const payload = samplePayload();
    await writePreview(payload);
    const updated = await recordApproval(payload.matter_id, payload.preview_id, {
      attorney_initials: 'S.Y.',
      edits: [],
      output_path: '/tmp/cover-letter.md',
    });
    expect(updated?.status).toBe('approved');
    expect(updated?.attorney_initials).toBe('S.Y.');
    expect(updated?.approved_at).toMatch(/^20\d{2}-/);
    expect(updated?.output_path).toBe('/tmp/cover-letter.md');
  });

  it('is a no-op when called a second time (status guard)', async () => {
    const payload = samplePayload();
    await writePreview(payload);
    await recordApproval(payload.matter_id, payload.preview_id, {
      attorney_initials: 'S.Y.',
      edits: [],
      output_path: '/tmp/a.md',
    });
    const second = await recordApproval(payload.matter_id, payload.preview_id, {
      attorney_initials: 'X.X.',
      edits: [],
      output_path: '/tmp/different.md',
    });
    expect(second?.attorney_initials).toBe('S.Y.');
    expect(second?.output_path).toBe('/tmp/a.md');
  });

  it('returns null when the preview does not exist', async () => {
    const r = await recordApproval('M-001', 'NONE', {
      attorney_initials: 'S.Y.',
      edits: [],
      output_path: null,
    });
    expect(r).toBeNull();
  });
});

describe('recordRejection', () => {
  it("flips status to 'rejected' and stamps reason", async () => {
    const payload = samplePayload();
    await writePreview(payload);
    const updated = await recordRejection(payload.matter_id, payload.preview_id, {
      attorney_initials: 'S.Y.',
      rejection_reason: 'investor name spelling wrong',
    });
    expect(updated?.status).toBe('rejected');
    expect(updated?.rejected_at).toMatch(/^20\d{2}-/);
    expect(updated?.rejection_reason).toBe('investor name spelling wrong');
  });
});

describe('audit log', () => {
  it('appends one line per state transition', async () => {
    const payload = samplePayload();
    await writePreview(payload);
    await recordApproval(payload.matter_id, payload.preview_id, {
      attorney_initials: 'S.Y.',
      edits: [],
      output_path: '/tmp/x.md',
    });
    const auditPath = process.env.PREVIEW_AUDIT_LOG_PATH!;
    expect(existsSync(auditPath)).toBe(true);
    const lines = readFileSync(auditPath, 'utf8').trim().split('\n');
    expect(lines).toHaveLength(2);
    const [created, approved] = lines.map((l) => JSON.parse(l));
    expect(created.action).toBe('preview_created');
    expect(approved.action).toBe('approved');
    expect(approved.attorney_initials).toBe('S.Y.');
  });
});

describe('applyEdits', () => {
  it("touches existing field rows and tags source_quote='[attorney_edit]'", () => {
    const facts = [
      {
        field_path: 'investor.full_name',
        value: 'Mehmet Demir',
        source_doc: 'passport.pdf',
        source_page: 1,
        source_quote: 'extracted',
        confidence: 0.92,
      },
    ];
    const edited = applyEdits(facts, [
      { field_path: 'investor.full_name', new_value: 'Mehmet Demir Şirket' },
    ]);
    expect(edited[0].value).toBe('Mehmet Demir Şirket');
    expect(edited[0].source_quote).toBe('[attorney_edit]');
    expect(edited[0].confidence).toBe(1);
  });

  it('adds new field rows when path does not exist in facts_used', () => {
    const facts: never[] = [];
    const edited = applyEdits(facts, [
      { field_path: 'investor.a_number', new_value: 'A123456789' },
    ]);
    expect(edited).toHaveLength(1);
    expect(edited[0].field_path).toBe('investor.a_number');
    expect(edited[0].source_quote).toBe('[attorney_edit]');
  });
});
