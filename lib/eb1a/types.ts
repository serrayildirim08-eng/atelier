/**
 * EB-1A type re-exports from the canonical Zod schema in ingest/schema.ts.
 * Anything case-shape-related lives there; this file is a stable import
 * surface for app/ and lib/eb1a/ internals.
 */

import type { z } from 'zod';
import type { EB1AFacts } from '@/ingest/schema';

export type { EB1AFacts };

// Sub-shape extractions for code that only touches one tier.
export type EB1AFilingMetadata = EB1AFacts['filing_metadata'];
export type EB1AEducationEntry = EB1AFacts['education_history'][number];
export type EB1ATenureEntry = EB1AFacts['tenure_table'][number];
export type EB1AFieldClassification = EB1AFacts['field_classification'];

export type TenureType = NonNullable<EB1ATenureEntry['tenure_type']['value']>;
export type FilingRoute = NonNullable<EB1AFilingMetadata['filing_route']['value']>;
export type FieldSpecificity = NonNullable<
  EB1AFieldClassification['specificity']['value']
>;

// Convenience guard for "this z type is the same as the Field<T> shape".
export type FieldOf<T> = {
  value: T | null;
  source_page: number | null;
  source_quote: string | null;
  confidence: number | null;
};

// Make z usable downstream without re-importing.
export type { z };
