/**
 * Business-plan WRITER output schema (drafter side, not extractor).
 *
 * Produces a structured 5-year business plan ready to be paginated under
 * Tab G-8 / Tab H-1 of the petition exhibits. The schema enforces the
 * refusal contract that protects this firm against hallucinated industry
 * data: every projected figure carries a `source` field, and where no
 * primary source exists in the input the source MUST be the literal
 * sentinel '[ASSUMED — verify before filing]' so the attorney can scan
 * the plan for unverifiable numbers before signing.
 *
 * Authority anchor: Matter of Ho, 19 I&N Dec. 582 (BIA 1988) — by
 * analogy, business plans submitted to USCIS must be "comprehensive,
 * credible, and verifiable". The authority_anchor_note at the head of
 * the plan invokes this standard.
 *
 * Schema design notes:
 * - All sections produce GitHub-flavored markdown in `content_markdown`.
 *   The drafter is told to use level-3 (###) sub-headings within each
 *   section so the renderer can stitch level-2 (##) section headings on
 *   top without clashing.
 * - financial_projections breaks the P&L into year_1..year_5, each a
 *   structured ProjectedYearPL with five line items. Forcing structure
 *   here (vs. free-form markdown) is what lets the deterministic
 *   "[ASSUMED]" scan work.
 * - source_urls on market_analysis are explicit URLs the writer pulled
 *   industry data from. An empty array = "no industry data was
 *   citable" — the writer was instructed to write defensively in that
 *   case rather than fabricate.
 */

import { z } from 'zod';

/**
 * Sentinel value for any projected figure whose source could not be
 * established from the inputs. Exposed as a constant so callers can scan
 * a rendered plan for unverifiable numbers (the attorney's last review
 * pass before the cover letter is filed).
 */
export const ASSUMED_SENTINEL = '[ASSUMED — verify before filing]';

const ProjectedFigureSchema = z.object({
  /** The figure as a string (e.g., "$1,200,000", "12%", "8 FTE"). */
  value: z.string(),
  /**
   * The primary source the figure traces to. Either a URL / citation
   * pulled from market data the writer was given, OR the literal
   * sentinel `[ASSUMED — verify before filing]` when no primary source
   * exists. NEVER a fabricated citation.
   */
  source: z.string(),
});

export type ProjectedFigure = z.infer<typeof ProjectedFigureSchema>;

const ProjectedYearPLSchema = z.object({
  revenue: ProjectedFigureSchema,
  cogs: ProjectedFigureSchema,
  gross_profit: ProjectedFigureSchema,
  operating_expenses: ProjectedFigureSchema,
  net_income: ProjectedFigureSchema,
});

export type ProjectedYearPL = z.infer<typeof ProjectedYearPLSchema>;

const FinancialProjectionsSchema = z.object({
  year_1: ProjectedYearPLSchema,
  year_2: ProjectedYearPLSchema,
  year_3: ProjectedYearPLSchema,
  year_4: ProjectedYearPLSchema,
  year_5: ProjectedYearPLSchema,
  /** Markdown table (year × hires by role) — each row a discrete W-2 add. */
  hiring_schedule_markdown: z.string(),
  /** Month at which cumulative net income crosses zero, e.g. "Month 14". */
  breakeven_month: ProjectedFigureSchema,
});

export type FinancialProjections = z.infer<typeof FinancialProjectionsSchema>;

const SectionSchema = z.object({
  content_markdown: z.string(),
});

const MarketAnalysisSchema = z.object({
  content_markdown: z.string(),
  /**
   * Explicit URLs the writer pulled industry data from. An empty array
   * is acceptable AND signals to the attorney that no third-party
   * industry data was cited — the section was written defensively.
   */
  source_urls: z.array(z.string()),
});

export const BusinessPlanSchema = z.object({
  /**
   * Short note at the head of the plan invoking Matter of Ho, 19 I&N
   * Dec. 582 (BIA 1988) — the authority anchor for the comprehensive /
   * credible / verifiable standard the plan is being held to.
   */
  authority_anchor_note: z.string(),
  executive_summary: SectionSchema,
  market_analysis: MarketAnalysisSchema,
  products_or_services: SectionSchema,
  operational_plan: SectionSchema,
  marketing_strategy: SectionSchema,
  management_team: SectionSchema,
  financial_projections: FinancialProjectionsSchema,
  growth_strategy: SectionSchema,
});

export type BusinessPlan = z.infer<typeof BusinessPlanSchema>;
