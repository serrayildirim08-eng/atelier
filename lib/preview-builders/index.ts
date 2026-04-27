/**
 * Preview-builder dispatcher. Each generator name maps to a builder
 * that returns the preview payload — facts_used, defensives,
 * authorities, conflicts to flag, structural outline, cost estimate —
 * WITHOUT calling the Anthropic API.
 *
 * The actual generation (cover letter, declaration, forms fill,
 * exhibit list) is invoked by the /approve endpoint AFTER attorney
 * sign-off. Builders are pure: they read the matter's CaseFacts +
 * typed memory and produce a preview payload. The /preview endpoint
 * persists that payload via lib/preview-store.
 */

import type { CaseFacts } from '@/ingest/schema';
import type { TypedMemory } from '@/ingest/typed-memory';
import { newPreviewId, type PreviewGenerator, type PreviewPayload } from '@/lib/preview-store';
import { buildCoverLetterPreview } from './cover-letter';
import { buildDeclarationPreview } from './declaration';
import { buildExhibitListPreview } from './exhibit-list';
import { buildFormsPreview } from './forms';
import { buildNoidPreview } from './noid';

export interface BuildPreviewInputs {
  matterId: string;
  generator: PreviewGenerator;
  caseFacts: CaseFacts;
  memory: TypedMemory;
  args?: Record<string, unknown>;
}

/**
 * Dispatch a buildXxxPreview call based on the generator name. Throws
 * if the generator isn't wired or the case_type is incompatible (e.g.
 * an EB-1A case can't generate an E-2 cover letter).
 */
export async function buildPreview(
  inputs: BuildPreviewInputs,
): Promise<PreviewPayload> {
  const created_at = new Date().toISOString();
  const preview_id = newPreviewId();
  const baseShape = {
    preview_id,
    generator: inputs.generator,
    matter_id: inputs.matterId,
    args: inputs.args ?? null,
    created_at,
  };

  switch (inputs.generator) {
    case 'cover_letter':
      return { ...baseShape, ...buildCoverLetterPreview(inputs.caseFacts, inputs.memory) };
    case 'noid_principal':
      return {
        ...baseShape,
        ...buildNoidPreview(inputs.caseFacts, inputs.memory, 'principal'),
      };
    case 'noid_dependent':
      return {
        ...baseShape,
        ...buildNoidPreview(inputs.caseFacts, inputs.memory, 'dependent'),
      };
    case 'forms_i129':
    case 'forms_i129e':
    case 'forms_g28':
    case 'forms_i539':
    case 'forms_i539a': {
      const formId = inputs.generator.replace(/^forms_/, '').replace('i129', 'i-129').replace('-e', 'e').replace('g28', 'g-28').replace('i539a', 'i-539a').replace(/i539(?!a)/, 'i-539');
      return { ...baseShape, ...(await buildFormsPreview(inputs.caseFacts, formId)) };
    }
    case 'declaration_beneficiary':
      return {
        ...baseShape,
        ...buildDeclarationPreview(inputs.caseFacts, 'beneficiary'),
      };
    case 'declaration_spouse':
      return {
        ...baseShape,
        ...buildDeclarationPreview(inputs.caseFacts, 'spouse'),
      };
    case 'declaration_enterprise_rep':
      return {
        ...baseShape,
        ...buildDeclarationPreview(inputs.caseFacts, 'enterprise_representative'),
      };
    case 'exhibit_list':
      return {
        ...baseShape,
        ...buildExhibitListPreview(inputs.memory),
      };
  }
}

export {
  buildCoverLetterPreview,
  buildDeclarationPreview,
  buildExhibitListPreview,
  buildFormsPreview,
  buildNoidPreview,
};
