/**
 * Generator dispatcher for the /approve endpoint.
 *
 * After attorney approval, this routes the (matter, generator) tuple
 * to the actual generator and returns its output. The preview's
 * facts_used + edits are applied to a clone of the matter's facts
 * before the generator runs — that's how attorney edits make it into
 * the produced cover letter / declaration / exhibit list.
 *
 * Implementation note: we do NOT split every existing generator into a
 * separate preview/execute pair (that would double the surface). The
 * existing draftCoverLetter / draftDeclaration / fillForm /
 * buildExhibitList already accept fact inputs cleanly, so we apply the
 * attorney edits to caseFacts and call them directly.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { draftCoverLetter } from '@/draft/cover-letter';
import { draftDeclaration } from '@/draft/declaration';
import { fillForm } from '@/draft/forms-filler';
import {
  buildExhibitList,
  renderExhibitListMarkdown,
  renderExhibitListCompact,
} from '@/draft/exhibit-list';
import { draftBusinessPlan } from '@/draft/business-plan-writer';
import type { CaseFacts, E2Facts } from '@/ingest/schema';
import type { TypedMemory } from '@/ingest/typed-memory';
import type { PreviewEdit, PreviewRecord } from '@/lib/preview-store';

export interface ExecuteResult {
  output_path: string | null;
  output_inline: string | null;
  usage: { input_tokens: number; output_tokens: number } | null;
}

/**
 * Persist an inline-text generator output to disk under db/drafts/. Without
 * this, approved cover letters / declarations / business plans only lived
 * in the API response and were lost when the user navigated away. Failures
 * are logged but do not break the approve flow — the inline text is still
 * returned to the UI.
 */
async function persistInlineDraft(
  matterId: string,
  generator: string,
  inline: string,
  approvedAt: string,
): Promise<string | null> {
  const safeMatter = matterId.replace(/[^a-zA-Z0-9._-]/g, '_');
  const stamp = approvedAt.replace(/[:.]/g, '-');
  const filename = `${generator}-${stamp}.md`;
  const dir = join(process.cwd(), 'db', 'drafts', safeMatter);
  const path = join(dir, filename);
  try {
    await mkdir(dir, { recursive: true });
    await writeFile(path, inline, 'utf8');
    return path;
  } catch (e: unknown) {
    console.warn(
      `[execute] Failed to persist draft ${generator} for matter ${matterId}: ${
        e instanceof Error ? e.message : String(e)
      }`,
    );
    return null;
  }
}

/**
 * Apply attorney edits to a clone of caseFacts. Edits target dotted
 * paths (e.g. `investor.full_name`); the matching Field<T> wrapper has
 * its `.value` overwritten and confidence stamped to 1.
 */
function applyEditsToCaseFacts(
  caseFacts: CaseFacts,
  edits: PreviewEdit[],
): CaseFacts {
  const cloned = JSON.parse(JSON.stringify(caseFacts)) as CaseFacts;
  for (const edit of edits) {
    // The preview-builder for the cover letter prefixes paths with '$'
    // (root). Strip that prefix when present.
    const path = edit.field_path.replace(/^\$\.?/, '');
    const parts = path.split(/\.(?![^[]*\])/);
    let cur: unknown = cloned.facts;
    for (let i = 0; i < parts.length - 1; i++) {
      if (cur === null || typeof cur !== 'object') return cloned;
      cur = (cur as Record<string, unknown>)[parts[i]];
    }
    if (cur === null || typeof cur !== 'object') continue;
    const last = parts[parts.length - 1];
    const target = (cur as Record<string, unknown>)[last];
    if (target && typeof target === 'object' && 'value' in target) {
      (target as { value: unknown }).value = edit.new_value;
      (target as { confidence?: unknown }).confidence = 1;
      (target as { source_quote?: unknown }).source_quote = '[attorney_edit]';
    } else {
      (cur as Record<string, unknown>)[last] = edit.new_value;
    }
  }
  return cloned;
}

export async function executeApprovedPreview(
  record: PreviewRecord,
  caseFacts: CaseFacts,
  memory: TypedMemory,
  edits: PreviewEdit[],
): Promise<ExecuteResult> {
  const editedFacts = applyEditsToCaseFacts(caseFacts, edits);
  const approvedAt = new Date().toISOString();

  switch (record.generator) {
    case 'cover_letter': {
      const result = await draftCoverLetter(editedFacts);
      const path = await persistInlineDraft(
        record.matter_id,
        'cover_letter',
        result.letter,
        approvedAt,
      );
      return {
        output_path: path,
        output_inline: result.letter,
        usage: result.usage,
      };
    }
    case 'declaration_beneficiary':
    case 'declaration_spouse':
    case 'declaration_enterprise_rep': {
      const declarant =
        record.generator === 'declaration_beneficiary'
          ? 'beneficiary'
          : record.generator === 'declaration_spouse'
            ? 'spouse'
            : 'enterprise_representative';
      if (editedFacts.case_type !== 'E2') {
        throw new Error('Declaration drafter is wired for E-2 only');
      }
      const result = await draftDeclaration({
        caseFacts: editedFacts as { case_type: 'E2'; facts: E2Facts },
        declarant,
      });
      const path = await persistInlineDraft(
        record.matter_id,
        record.generator,
        result.rendered_text,
        approvedAt,
      );
      return {
        output_path: path,
        output_inline: result.rendered_text,
        usage: result.usage,
      };
    }
    case 'forms_i129':
    case 'forms_i129e':
    case 'forms_g28':
    case 'forms_i539':
    case 'forms_i539a': {
      const formId = record.generator
        .replace(/^forms_/, '')
        .replace(/^i129(e?)$/, 'i-129$1')
        .replace(/^g28$/, 'g-28')
        .replace(/^i539(a?)$/, 'i-539$1');
      const filled = await fillForm({
        formId,
        matterId: record.matter_id,
        data: { facts: editedFacts.facts, context: {} },
      });
      return {
        output_path: filled.output_path,
        output_inline: null,
        usage: null,
      };
    }
    case 'exhibit_list': {
      const list = buildExhibitList({ memory });
      const md = renderExhibitListMarkdown(list);
      const compact = renderExhibitListCompact(list);
      const inline = `${md}\n\n---\n\n${compact}`;
      const path = await persistInlineDraft(
        record.matter_id,
        'exhibit_list',
        inline,
        approvedAt,
      );
      return {
        output_path: path,
        output_inline: inline,
        usage: null,
      };
    }
    case 'business_plan': {
      if (editedFacts.case_type !== 'E2') {
        throw new Error('Business-plan generator is wired for E-2 only.');
      }
      const result = await draftBusinessPlan({
        caseFacts: editedFacts.facts as E2Facts,
      });
      const path = await persistInlineDraft(
        record.matter_id,
        'business_plan',
        result.rendered_markdown,
        approvedAt,
      );
      return {
        output_path: path,
        output_inline: result.rendered_markdown,
        usage: result.usage,
      };
    }
    case 'noid_principal':
    case 'noid_dependent': {
      // NoID generator is a thin attestation; the draft layer doesn't
      // ship a dedicated module yet. Stub the executor: render a
      // markdown attestation from the preview's facts_used. When the
      // full NoID drafter ships it slots in here without changing the
      // route.
      const inline = renderNoidAttestation(record);
      const path = await persistInlineDraft(
        record.matter_id,
        record.generator,
        inline,
        approvedAt,
      );
      return {
        output_path: path,
        output_inline: inline,
        usage: null,
      };
    }
    default: {
      // Exhaustiveness guard — adding a new PreviewGenerator member without
      // wiring it here will fail compilation on the `never` assignment.
      const _exhaustive: never = record.generator;
      throw new Error(`Unhandled generator: ${String(_exhaustive)}`);
    }
  }
}

function renderNoidAttestation(record: PreviewRecord): string {
  const decl = record.generator === 'noid_principal' ? 'Principal Beneficiary' : 'Dependent';
  const lines: string[] = [];
  lines.push(`# Notice of Intent to Depart — ${decl}`);
  lines.push('');
  for (const f of record.facts_used) {
    lines.push(`- **${f.field_path}**: ${String(f.value ?? '[MISSING]')}`);
  }
  lines.push('');
  lines.push(
    'I declare under penalty of perjury under the laws of the United States of America (28 U.S.C. § 1746) that I intend to depart the United States upon the termination of my E-2 status, and that the foregoing is true and correct.',
  );
  lines.push('');
  lines.push('Executed on [DATE].');
  lines.push('');
  lines.push('— '.repeat(20));
  lines.push('Signature');
  return lines.join('\n');
}
