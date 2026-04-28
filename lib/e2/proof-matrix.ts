/**
 * E-2 proof matrix — composition resolver.
 *
 * Input:  CaseProfile (axis 2)
 * Output: list of { slot_id, requirement } for the case
 *
 * The required-slots list is COMPOSED layer-by-layer:
 *
 *   base_slots                            ← every E-2 case
 *   + posture_slots[posture]              ← consular vs USCIS forms
 *   + stage_slots[stage]                  ← pre-launch (Walsh & Pollard) vs operating (tax/payroll)
 *   + subtype_slots[principal_subtype]    ← Subtype-3 supervisory; Subtype-4 specialized knowledge
 *   + vehicle_slots[vehicle]              ← restaurant permits, franchise FDD, etc.
 *   + origin_slots[funds_origins[*]]      ← gift, crypto, loan, etc.
 *   + nationality_slots[nationality_path] ← CBI → AMIGOS pack
 *   + dependent_slots                     ← when has_dependents
 *
 * Each layer can:
 *   - ADD a slot at a given requirement level
 *   - PROMOTE an existing slot's requirement (optional → recommended → required)
 *   - DEMOTE is NOT supported — once required, always required
 *
 * Per-post slot overrides live in lib/e2/posts/{post}.ts and are applied AFTER
 * this matrix runs, via the BinderProfile resolution pipeline.
 */

import type { CaseProfile, FundsOrigin, SlotRequirement, Vehicle } from './types';
import { ALL_PROOF_SLOTS } from './proof-slots';

export interface ResolvedSlot {
  slot_id: string;
  requirement: SlotRequirement;
}

// ───────────────────────────────────────────────────────────────────────────
// BASE — every E-2 case, regardless of profile
// ───────────────────────────────────────────────────────────────────────────

const BASE_REQUIRED: string[] = [
  'E1.principal_passport',
  'E1.principal_nationality_path',
  'E1.entity_treaty_ownership',
  'E1.foreign_owner_passports',
  'E2.investment_amount_proof',
  'E2.at_risk_evidence',
  'E2.proportionality_substantiality',
  'E2.SOF.origin_evidence',
  'E2.SOF.intermediate_holding',
  'E2.SOF.us_deployment',
  'E3.business_formation',
  'E3.business_premises',
  'E3.licenses_permits',
  'E3.tax_compliance',
  'E4.business_plan_5yr',
  'E4.hiring_timetable',
  'E4.financial_capacity',
  'E5.develop_direct.org_chart',
  'E5.develop_direct.appointing_resolution',
  'FORMS.cover_letter',
  'APP.photographs',
];

const BASE_RECOMMENDED: string[] = ['APP.prior_visas_and_status', 'E3.operating_evidence'];

// ───────────────────────────────────────────────────────────────────────────
// POSTURE
// ───────────────────────────────────────────────────────────────────────────

const POSTURE_LAYERS: Record<CaseProfile['posture'], { required: string[]; recommended: string[] }> = {
  consular_first_time: {
    required: ['FORMS.ds160_confirmation', 'FORMS.ds156e'],
    recommended: [],
  },
  consular_renewal: {
    required: ['FORMS.ds160_confirmation', 'FORMS.ds156e'],
    recommended: ['APP.prior_visas_and_status'],
  },
  uscis_change_of_status: {
    required: ['FORMS.uscis_petition', 'APP.prior_visas_and_status'],
    recommended: [],
  },
  uscis_extension: {
    required: ['FORMS.uscis_petition', 'APP.prior_visas_and_status'],
    recommended: [],
  },
};

// ───────────────────────────────────────────────────────────────────────────
// STAGE — pre-launch vs operating
// ───────────────────────────────────────────────────────────────────────────

const STAGE_LAYERS: Record<CaseProfile['stage'], { required: string[]; recommended: string[] }> = {
  pre_launch: {
    required: ['E2.in_process_walsh_pollard'],
    recommended: [],
  },
  early_stage: {
    required: ['E3.operating_evidence'],
    recommended: ['E2.in_process_walsh_pollard'],
  },
  operating: {
    required: ['E3.operating_evidence'],
    recommended: [],
  },
};

// ───────────────────────────────────────────────────────────────────────────
// PRINCIPAL SUBTYPE
// ───────────────────────────────────────────────────────────────────────────

const SUBTYPE_LAYERS: Record<CaseProfile['principal_subtype'], { required: string[]; recommended: string[] }> = {
  individual_investor: {
    required: [],
    recommended: [],
  },
  corporate_owned_investor: {
    required: ['E3.foreign_corporate_registry'],
    recommended: [],
  },
  executive_supervisory: {
    required: ['E5.executive_supervisory_authority'],
    recommended: [],
  },
  essential_skills_employee: {
    required: ['E5.specialized_knowledge_pack', 'E3.foreign_corporate_registry'],
    recommended: [],
  },
};

// ───────────────────────────────────────────────────────────────────────────
// VEHICLE — vehicle-specific permits + benchmark sources
// ───────────────────────────────────────────────────────────────────────────

const VEHICLE_LAYERS: Record<Vehicle, { required: string[]; recommended: string[] }> = {
  restaurant_food_service: { required: [], recommended: [] }, // food_permit covered via E3.licenses_permits adequacy gate
  franchise: { required: [], recommended: [] }, // proof-slot already accepts FDD via E2.proportionality_substantiality
  tech_saas: { required: [], recommended: [] },
  consulting_services: { required: [], recommended: [] },
  professional_services: { required: [], recommended: [] },
  ecommerce: { required: [], recommended: [] },
  real_estate_active: { required: [], recommended: [] },
  hospitality_lodging: { required: [], recommended: [] },
  healthcare_clinic: { required: [], recommended: [] },
  beauty_personal_care: { required: [], recommended: [] },
  fitness_wellness: { required: [], recommended: [] },
  automotive_services: { required: [], recommended: [] },
  construction_trades: { required: [], recommended: [] },
  import_export_trade: { required: [], recommended: [] },
  manufacturing: { required: [], recommended: [] },
  retail_brick_mortar: { required: [], recommended: [] },
  education_training: { required: [], recommended: [] },
  media_entertainment: { required: [], recommended: [] },
  other: { required: [], recommended: [] },
};

// ───────────────────────────────────────────────────────────────────────────
// FUNDS ORIGIN — each origin adds its own SOF chain slot
// ───────────────────────────────────────────────────────────────────────────

const ORIGIN_LAYERS: Record<FundsOrigin, { required: string[]; recommended: string[] }> = {
  salary_employment: { required: [], recommended: [] },
  business_profits_dividends: { required: [], recommended: [] },
  sale_of_real_estate: { required: [], recommended: [] },
  sale_of_business_or_shares: { required: [], recommended: [] },
  inheritance: { required: [], recommended: [] },
  gift: { required: ['E2.SOF.gift_documentation'], recommended: [] },
  loan_personal_collateral: { required: ['E2.SOF.loan_collateral'], recommended: [] },
  personal_savings: { required: [], recommended: [] },
  cryptocurrency: { required: ['E2.SOF.crypto_chain'], recommended: [] },
  rental_income: { required: [], recommended: [] },
  investment_portfolio_sale: { required: [], recommended: [] },
};

// ───────────────────────────────────────────────────────────────────────────
// NATIONALITY PATH
// ───────────────────────────────────────────────────────────────────────────

const NATIONALITY_LAYERS: Record<CaseProfile['nationality_path'], { required: string[]; recommended: string[] }> = {
  birth: { required: [], recommended: [] },
  descent: { required: [], recommended: [] },
  marriage: { required: [], recommended: [] },
  naturalization_residency: { required: [], recommended: [] },
  cbi_investment: { required: ['E1.cbi_amigos_domicile'], recommended: [] },
};

// ───────────────────────────────────────────────────────────────────────────
// DEPENDENTS
// ───────────────────────────────────────────────────────────────────────────

function dependentLayer(profile: CaseProfile): { required: string[]; recommended: string[] } {
  if (!profile.has_dependents) return { required: [], recommended: [] };
  const required: string[] = ['DEP.dependent_passports', 'DEP.dependent_forms', 'DEP.intent_to_depart'];
  const breakdown = profile.dependent_breakdown;
  if (breakdown?.spouse) required.push('DEP.marriage_certificate');
  if (breakdown?.children_under_21 && breakdown.children_under_21 > 0) {
    required.push('DEP.child_birth_certificates');
  }
  return { required, recommended: [] };
}

// ───────────────────────────────────────────────────────────────────────────
// RESOLVE — compose all layers
// ───────────────────────────────────────────────────────────────────────────

const RANK: Record<SlotRequirement, number> = { optional: 0, recommended: 1, required: 2 };

function promote(map: Map<string, SlotRequirement>, slotId: string, level: SlotRequirement): void {
  const existing = map.get(slotId);
  if (!existing || RANK[level] > RANK[existing]) map.set(slotId, level);
}

export function resolveSlots(profile: CaseProfile): ResolvedSlot[] {
  const map = new Map<string, SlotRequirement>();

  for (const id of BASE_REQUIRED) promote(map, id, 'required');
  for (const id of BASE_RECOMMENDED) promote(map, id, 'recommended');

  const posture = POSTURE_LAYERS[profile.posture];
  for (const id of posture.required) promote(map, id, 'required');
  for (const id of posture.recommended) promote(map, id, 'recommended');

  const stage = STAGE_LAYERS[profile.stage];
  for (const id of stage.required) promote(map, id, 'required');
  for (const id of stage.recommended) promote(map, id, 'recommended');

  const subtype = SUBTYPE_LAYERS[profile.principal_subtype];
  for (const id of subtype.required) promote(map, id, 'required');
  for (const id of subtype.recommended) promote(map, id, 'recommended');

  const vehicle = VEHICLE_LAYERS[profile.vehicle];
  for (const id of vehicle.required) promote(map, id, 'required');
  for (const id of vehicle.recommended) promote(map, id, 'recommended');

  for (const origin of profile.funds_origins) {
    const layer = ORIGIN_LAYERS[origin];
    for (const id of layer.required) promote(map, id, 'required');
    for (const id of layer.recommended) promote(map, id, 'recommended');
  }

  const nationality = NATIONALITY_LAYERS[profile.nationality_path];
  for (const id of nationality.required) promote(map, id, 'required');
  for (const id of nationality.recommended) promote(map, id, 'recommended');

  const deps = dependentLayer(profile);
  for (const id of deps.required) promote(map, id, 'required');
  for (const id of deps.recommended) promote(map, id, 'recommended');

  // Stable canonical order: by slot id ascending so binder layout is deterministic.
  const slotIds = new Set(ALL_PROOF_SLOTS.map((s) => s.id));
  const resolved: ResolvedSlot[] = [];
  for (const [slot_id, requirement] of Array.from(map)) {
    if (!slotIds.has(slot_id)) continue; // guard against typos in layer arrays
    resolved.push({ slot_id, requirement });
  }
  resolved.sort((a, b) => a.slot_id.localeCompare(b.slot_id));
  return resolved;
}

export function requiredSlots(profile: CaseProfile): string[] {
  return resolveSlots(profile)
    .filter((s) => s.requirement === 'required')
    .map((s) => s.slot_id);
}
