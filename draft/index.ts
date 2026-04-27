export {
  draftCoverLetter,
  draftCoverLetterStream,
  type DraftResult,
  type DraftStreamEvent,
} from './cover-letter';

export {
  buildExhibitList,
  renderExhibitListMarkdown,
  renderExhibitListCompact,
  TAB_META,
  TAB_ORDER,
  DOC_TYPE_TO_TAB,
  type Tab,
  type ExhibitItem,
  type ExhibitTab,
  type ExhibitList,
} from './exhibit-list';

export {
  fillForm,
  listGeneratedForms,
  loadFieldMap,
  resolveJsonPath,
  type FormFieldMap,
  type FillFormReport,
  type FillFormInputs,
  type GeneratedFormSummary,
} from './forms-filler';

export {
  draftDeclaration,
  renderDeclarationText,
  DeclarationSchema,
  type Declaration,
  type DeclarantRole,
  type DeclarationResult,
  type DraftDeclarationInputs,
} from './declaration';

export {
  draftBusinessPlan,
  renderBusinessPlanMarkdown,
  collectAssumedFigures,
  type BusinessPlanResult,
  type DraftBusinessPlanInputs,
  type AssumedFigureRow,
} from './business-plan-writer';

export {
  ASSUMED_SENTINEL,
  BusinessPlanSchema,
  type BusinessPlan,
  type ProjectedFigure,
  type ProjectedYearPL,
  type FinancialProjections,
} from './business-plan-writer.schema';
