/**
 * EB-1A document framework — public surface.
 *
 * Authority: INA § 203(b)(1)(A); 8 CFR § 204.5(h); Kazarian v. USCIS,
 * 596 F.3d 1115 (9th Cir. 2010). Self-petition; no employer sponsorship.
 * Need 3+ of 10 criteria, then survive Kazarian step 2 (final merits).
 *
 * Current scope (Tier 1 / 2 / 3 only):
 *   - filing metadata (consular vs CoS, consulate post, addresses)
 *   - identity (passport, visa, I-797)
 *   - academic record + master tenure table
 *   - field-of-endeavor classification
 *
 * Criteria gates ((h)(3)(i)–(x)) come later, one at a time, with their
 * own evidence schemas. They do not live in this file yet.
 */

export type * from './types';

export {
  buildTenureTable,
  isAcademicTenure,
  type TenureBuilderInput,
} from './tenure-table';

export {
  defaultFilingMetadata,
  applyFilingMetadataOverrides,
  type FilingMetadataOverride,
} from './filing-metadata';

export {
  classifyFieldOfEndeavor,
  type FieldClassificationInput,
} from './field-of-endeavor';
