/**
 * Per-PDF visa-stamp / I-797 extractor schema (rich second-pass).
 *
 * Covers two related artifacts the firm keeps in Tab C.1 (manual §3.2):
 *   - Consular visa stamp (foil affixed to a passport page)
 *   - USCIS I-797 approval notice (paper notice issued for change of
 *     status / extension granted from inside the US)
 *
 * Both anchor "prior status" for renewals (manual §3.2) and feed E5
 * develop-and-direct continuity arguments. The schema captures one
 * primary stamp + an optional list of prior_admissions[] when the source
 * is a multi-stamp page.
 *
 * Provenance: every leaf carries {value, source_page, source_quote,
 * confidence}, mirroring contract.schema.ts.
 */

import { z } from 'zod';

const Field = <T extends z.ZodTypeAny>(value: T) =>
  z.object({
    value: value.nullable(),
    source_page: z.number().int().nullable(),
    source_quote: z.string().nullable(),
    confidence: z.number().min(0).max(1).nullable(),
  });

const PriorAdmissionSchema = z.object({
  port_of_entry: Field(z.string()),
  admission_date: Field(z.string()),
  classification: Field(z.string()),
});

export const VisaStampFactsSchema = z.object({
  visa_number: Field(z.string()),
  classification: Field(z.string()),
  validity_start_date: Field(z.string()),
  validity_end_date: Field(z.string()),
  port_of_issue: Field(z.string()),
  issuing_consulate: Field(z.string()),
  /**
   * Holder name as printed on the foil / notice (ASCII — visa stamps and
   * I-797s are issued by US authorities and use ASCII transliteration).
   */
  holder_name_ascii: Field(z.string()),
  /**
   * Number of entries authorized by the visa: 'M' (multiple), '1', '2', etc.
   */
  entries: Field(z.string()),
  /**
   * I-797 specific — receipt number on the approval notice. Null for
   * consular stamps.
   */
  i797_receipt_number: Field(z.string()),
  /**
   * Free-form list of prior admissions visible on the same page (entry
   * stamps ranked behind the foil). Empty array when not visible.
   */
  prior_admissions: z.array(PriorAdmissionSchema),
});

export type VisaStampFacts = z.infer<typeof VisaStampFactsSchema>;
