/**
 * E-2 document framework — public surface.
 *
 * Pull this barrel from app code instead of reaching into individual files.
 * The internal module layout is allowed to change; this barrel is the stable API.
 */

export type * from './types';

export { ALL_PROOF_SLOTS, PROOF_SLOTS_BY_ID, PROOF_SLOTS_BY_FAM_ELEMENT } from './proof-slots';

export { ALL_DOC_TYPES, DOC_TYPES_BY_ID, DOC_TYPES_BY_CATEGORY } from './doc-taxonomy';

export { resolveSlots, requiredSlots, type ResolvedSlot } from './proof-matrix';

export {
  USCIS_SUBTYPE1,
  USCIS_SUBTYPE2,
  USCIS_SUBTYPE3,
  USCIS_SUBTYPE4,
  CONSULAR_BASE,
  BASE_PROFILES,
  BASE_PROFILES_BY_ID,
} from './binder-profiles';

export { POST_PROFILES_BY_POST, getPostProfile } from './binder-posts';

export { auditDocuments, type AuditInput } from './document-audit';

export { aggregateGatesToConflicts } from './aggregate-gates';

export { selectBinderProfile, buildBinderManifest, type ManifestInput } from './binder-manifest';

export {
  buildAuditInputFromMemory,
  auditFromMemory,
  resolveDocTypeId,
  deriveCaseProfile,
  type FromMemoryInput,
  type MemoryPdfEntry,
  type DetectedSubtypeShape,
  type CaseProfileDefaults,
} from './from-memory';
