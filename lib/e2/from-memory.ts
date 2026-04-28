/**
 * Adapter: TypedMemory → AuditInput.
 *
 * The existing typed extractor pipeline (ingest/typed-memory.ts) classifies
 * each PDF into a coarse-grained `doc_type` (passport, status_doc, i94,
 * bank_statement, tax_doc, money_movement, source_of_funds, formation_doc,
 * ownership_evidence, business_contract, lease_or_property, image,
 * government_id, vital_records, payroll, financial_statement, job_offer,
 * service_record, cv, credential, recommendation_letter, foreign_corporate,
 * customer_contract, real_estate_purchase, translation_certification, other).
 *
 * The audit framework uses fine-grained doc-type ids from doc-taxonomy.ts.
 * This adapter walks each PerPdfResult, looks at attached rich-extraction
 * subtypes (formation_doc_subtype, contract_subtype, etc.), and returns the
 * best-fit fine-grained id for each PDF.
 *
 * Mapping precedence: rich extractor subtype > coarse doc_type > 'other'.
 */

import type { CaseProfile, FilledExhibit } from './types';
import { DOC_TYPES_BY_ID } from './doc-taxonomy';
import { auditDocuments, type AuditInput } from './document-audit';
import type { MissingnessReport } from './types';

/**
 * Minimal shape of a per-pdf entry — the parts of TypedMemory's PerPdfResult
 * we actually read here. Defined locally to avoid pulling the whole memory
 * type graph into the e2 framework.
 */
export interface MemoryPdfEntry {
  filename: string;
  pageCount?: number;
  facts?: { doc_type?: string };
  contract?: { contract_subtype?: string };
  bankReceipt?: { receipt_subtype?: string };
  wireConfirmation?: { wire_subtype?: string };
  governmentDoc?: { government_doc_subtype?: string };
  passport?: unknown;
  i94?: unknown;
  visaStamp?: unknown;
  vitalRecords?: { vital_record_subtype?: string };
  payroll?: { payroll_subtype?: string };
  taxReturn?: { tax_return_subtype?: string };
  financialStatement?: { statement_subtype?: string };
  jobOffer?: unknown;
  serviceRecord?: unknown;
  cv?: unknown;
  credential?: { credential_subtype?: string };
  recommendationLetter?: unknown;
  corporateFormation?: { formation_doc_subtype?: string };
  foreignCorporate?: { foreign_doc_subtype?: string };
  imagePhoto?: unknown;
  customerContract?: unknown;
  realEstatePurchase?: unknown;
}

// ───────────────────────────────────────────────────────────────────────────
// Mapping table
// ───────────────────────────────────────────────────────────────────────────

/** Direct subtype-string → fine-grained doc_type_id table. */
const SUBTYPE_MAP: Record<string, string> = {
  // Corporate formation
  articles_of_organization: 'articles_of_organization',
  articles_of_incorporation: 'articles_of_incorporation',
  operating_agreement_amendment: 'operating_agreement',
  ein_assignment_letter: 'ein_cp575',
  certificate_of_good_standing: 'certificate_of_good_standing',
  state_registration: 'state_business_license',

  // Contracts
  membership_interest_transfer_agreement: 'mita',
  operating_agreement: 'operating_agreement',
  bill_of_sale: 'bill_of_sale',
  commercial_lease: 'lease_commercial',
  residential_lease: 'lease_residential',

  // Financial statements
  profit_and_loss: 'profit_loss_statement',
  balance_sheet: 'balance_sheet',

  // Government docs
  title_deed: 'title_deed_us',
  vital_record_birth: 'birth_certificate',
  vital_record_marriage: 'marriage_certificate',
  birth_certificate: 'birth_certificate',
  marriage_certificate: 'marriage_certificate',

  // Tax returns
  form_1120: 'tax_return_1120',
  form_1120s: 'tax_return_1120s',
  form_1065: 'tax_return_1065',
  form_1040_schedule_c: 'tax_return_schedule_c',

  // Foreign corporate
  shareholder_register: 'foreign_corporate_registry_other',
  audited_financials: 'audited_financial_statement',
  foreign_tax_certificate: 'amigos_treaty_country_tax_cert',

  // Credentials
  diploma: 'diploma',
  professional_certification: 'professional_license',
  license: 'professional_license',

  // Payroll
  payroll_register: 'payroll_register',

  // Wire / receipts
  international_wire_with_fx: 'wire_swift_mt103',
  usd_only_wire: 'wire_confirmation',
  corporate_funding: 'wire_swift_mt103',
};

/** Coarse doc_type → fine-grained id fallback when no subtype matches. */
const COARSE_FALLBACK: Record<string, string> = {
  passport: 'passport_bio',
  status_doc: 'visa_stamp',
  i94: 'i94',
  bank_statement: 'bank_statement_personal',
  tax_doc: 'tax_return_1040',
  money_movement: 'wire_confirmation',
  source_of_funds: 'bank_statement_personal',
  formation_doc: 'articles_of_organization',
  ownership_evidence: 'operating_agreement',
  business_contract: 'vendor_contract',
  lease_or_property: 'lease_commercial',
  image: 'photo_premises',
  government_id: 'naturalization_certificate',
  vital_records: 'birth_certificate',
  payroll: 'payroll_register',
  financial_statement: 'profit_loss_statement',
  job_offer: 'offer_letter',
  service_record: 'service_record',
  cv: 'cv',
  credential: 'professional_license',
  recommendation_letter: 'recommendation_letter',
  foreign_corporate: 'foreign_corporate_registry_other',
  customer_contract: 'customer_contract',
  real_estate_purchase: 'sale_contract',
  translation_certification: 'certified_translation',
};

// ───────────────────────────────────────────────────────────────────────────
// Per-entry classification
// ───────────────────────────────────────────────────────────────────────────

/** Resolve the most specific fine-grained doc_type_id for one entry. */
export function resolveDocTypeId(entry: MemoryPdfEntry): string | null {
  // Walk rich extractors in order of specificity.
  const candidateSubtypes: (string | undefined)[] = [
    entry.corporateFormation?.formation_doc_subtype,
    entry.contract?.contract_subtype,
    entry.governmentDoc?.government_doc_subtype,
    entry.taxReturn?.tax_return_subtype,
    entry.financialStatement?.statement_subtype,
    entry.foreignCorporate?.foreign_doc_subtype,
    entry.credential?.credential_subtype,
    entry.payroll?.payroll_subtype,
    entry.wireConfirmation?.wire_subtype,
    entry.vitalRecords?.vital_record_subtype,
  ];

  for (const sub of candidateSubtypes) {
    if (sub && SUBTYPE_MAP[sub]) return SUBTYPE_MAP[sub];
  }

  // Filename heuristics for foreign corporate registries — these all map to
  // foreign_corporate but have country-specific fine-grained ids.
  const lower = entry.filename.toLowerCase();
  if (entry.foreignCorporate || /foreign|kbis|handelsregister|visura|companies.*house|ticaret.*sicil/.test(lower)) {
    if (/k.?bis/.test(lower)) return 'foreign_corporate_registry_kbis';
    if (/handelsregister/.test(lower)) return 'foreign_corporate_registry_handelsregister';
    if (/visura/.test(lower)) return 'foreign_corporate_registry_visura';
    if (/companies.*house/.test(lower)) return 'foreign_corporate_registry_companies_house';
    if (/ticaret.*sicil/.test(lower)) return 'foreign_corporate_registry_ticaret_sicil_gazetesi';
  }
  if (/tapu/.test(lower)) return 'tapu_senedi';
  if (/dekont/.test(lower)) return 'bank_receipt';
  if (/vergi.*levha/.test(lower)) return 'vergi_levhasi';
  if (/ds.?156.?e/.test(lower)) return 'ds156e';
  if (/ds.?160/.test(lower)) return 'ds160_confirmation';
  if (/i.?129/.test(lower)) return 'i129';
  if (/i.?539a/.test(lower)) return 'i539a';
  if (/i.?539(?!a)/.test(lower)) return 'i539';
  if (/g.?28/.test(lower)) return 'g28';
  if (/business.*plan/.test(lower)) return 'business_plan_5yr';

  // Coarse fallback
  const coarse = entry.facts?.doc_type;
  if (coarse && COARSE_FALLBACK[coarse]) return COARSE_FALLBACK[coarse];

  return null;
}

// ───────────────────────────────────────────────────────────────────────────
// Memory → AuditInput
// ───────────────────────────────────────────────────────────────────────────

export interface FromMemoryInput {
  case_profile: CaseProfile;
  /** Iterable of per-PDF entries — typically `Array.from(iterMemoryEntries(memory))`. */
  entries: Iterable<MemoryPdfEntry>;
  /** Optional: cross-document conflict register entries to roll into the report. */
  conflicts?: AuditInput['conflicts'];
}

export function buildAuditInputFromMemory(input: FromMemoryInput): AuditInput {
  const filled_exhibits: FilledExhibit[] = [];
  for (const entry of input.entries) {
    const docTypeId = resolveDocTypeId(entry);
    if (!docTypeId) continue;
    const dt = DOC_TYPES_BY_ID[docTypeId];
    filled_exhibits.push({
      doc_type_id: docTypeId,
      pdf_path: entry.filename,
      effective_aps: dt?.typical_aps ?? 3,
    });
  }
  return {
    case_profile: input.case_profile,
    filled_exhibits,
    conflicts: input.conflicts,
  };
}

export function auditFromMemory(input: FromMemoryInput): MissingnessReport {
  return auditDocuments(buildAuditInputFromMemory(input));
}

// ───────────────────────────────────────────────────────────────────────────
// CaseProfile derivation
// ───────────────────────────────────────────────────────────────────────────

/**
 * Existing subtype-detect.schema enum mapping to the framework's CaseProfile.
 * Existing values vs framework values:
 *   principal_subtype:
 *     individual_investor              → individual_investor
 *     corporate_owned_investor         → corporate_owned_investor
 *     executive_supervisory_employee   → executive_supervisory
 *     essential_skills_employee        → essential_skills_employee
 *   procedural_posture:
 *     consular_new                     → consular_first_time
 *     uscis_cos_new                    → uscis_change_of_status
 *     uscis_extension                  → uscis_extension
 *     consular_renewal                 → consular_renewal
 */
export interface DetectedSubtypeShape {
  principal_subtype: string;
  procedural_posture: string;
  has_dependents: boolean;
  dependent_breakdown: { spouse: boolean; children: number } | null;
}

export interface CaseProfileDefaults {
  stage?: CaseProfile['stage'];
  vehicle?: CaseProfile['vehicle'];
  funds_origins?: CaseProfile['funds_origins'];
  nationality_path?: CaseProfile['nationality_path'];
  treaty_country?: string;
  post?: CaseProfile['post'];
}

const PRINCIPAL_SUBTYPE_MAP: Record<string, CaseProfile['principal_subtype']> = {
  individual_investor: 'individual_investor',
  corporate_owned_investor: 'corporate_owned_investor',
  executive_supervisory_employee: 'executive_supervisory',
  essential_skills_employee: 'essential_skills_employee',
};

const POSTURE_MAP: Record<string, CaseProfile['posture']> = {
  consular_new: 'consular_first_time',
  uscis_cos_new: 'uscis_change_of_status',
  uscis_extension: 'uscis_extension',
  consular_renewal: 'consular_renewal',
};

export function deriveCaseProfile(
  detected: DetectedSubtypeShape | null | undefined,
  defaults: CaseProfileDefaults = {},
): CaseProfile {
  const principal_subtype = detected
    ? (PRINCIPAL_SUBTYPE_MAP[detected.principal_subtype] ?? 'individual_investor')
    : 'individual_investor';
  const posture = detected
    ? (POSTURE_MAP[detected.procedural_posture] ?? 'consular_first_time')
    : 'consular_first_time';
  const has_dependents = !!detected?.has_dependents;
  const dependent_breakdown = detected?.dependent_breakdown
    ? {
        spouse: detected.dependent_breakdown.spouse,
        children_under_21: detected.dependent_breakdown.children,
      }
    : null;
  return {
    visa_class: 'E2',
    principal_subtype,
    posture,
    stage: defaults.stage ?? 'pre_launch',
    vehicle: defaults.vehicle ?? 'other',
    funds_origins: defaults.funds_origins ?? ['personal_savings'],
    nationality_path: defaults.nationality_path ?? 'birth',
    treaty_country: defaults.treaty_country ?? '',
    post: defaults.post ?? (posture.startsWith('consular_') ? 'other' : null),
    has_dependents,
    dependent_breakdown,
  };
}
