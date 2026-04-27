/**
 * Credential rich-extraction second pass — runs after typed-extract.ts
 * classifies a PDF as credential-flavored. Routing accepts
 * doc_type='cv_or_resume' (if classifier emits it) OR filename matches
 * /(diploma|certificate|license|transcript|sertifika|lisans|belge)/i.
 * Single Haiku 4.5 call fills the credential_subtype-discriminated
 * CredentialFactsSchema. The aggregator uses the diploma variant's
 * apostille_or_legalization_present field for the credential_unverifiable
 * gate (manual §3.5).
 */

import { getAnthropic } from '@/lib/anthropic';
import { logAnthropicUsage } from '@/lib/usage-log';
import {
  CredentialFactsSchema,
  type CredentialFacts,
} from './credential.schema';

function extractFirstJsonObject(text: string): string {
  const start = text.indexOf('{');
  if (start < 0) throw new Error('No JSON object found in response');
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (c === '\\') {
      escape = true;
      continue;
    }
    if (c === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  throw new Error('Unterminated JSON object in response');
}

const SYSTEM_PROMPT = `You are an immigration paralegal performing per-document extraction on an education / professional credential attached to an E-2 Treaty Investor case folder. The aggregator uses your output for the manual §3.3 specialized-knowledge / education narrative AND for the credential_unverifiable gate (manual §3.5: foreign diplomas require apostille or legalization).

Your job is two-fold:

1. CLASSIFY the document into exactly ONE credential_subtype:

   - diploma — university / college degree certificate ("Bachelor of Science in Mechanical Engineering, conferred upon …"). Includes the issuing institution's seal + registrar signature. Includes high-school equivalents only when the role's specialized-knowledge argument depends on them (rare).

   - professional_certification — industry or vendor certification (AWS Solutions Architect, PMP, Six Sigma Black Belt, ISO 9001 lead auditor, etc.). Issuer is typically a private body or vendor.

   - license — regulator-issued professional license (architecture, medical practice, engineering, electrical, real-estate, etc.). Issuer is a government authority.

   - transcript — academic transcript with course-level grades / credits. Distinct from a diploma even when both are in the same PDF — diplomas state the conferral, transcripts itemize coursework.

   - other_credential — anything that doesn't fit the above (e.g., honorary degree, language proficiency certificate that is NOT an industry standard, training-course completion).

2. EXTRACT the subtype-specific fields per the schema for the chosen credential_subtype. Only the schema variant matching your chosen credential_subtype is valid in your JSON output.

Subtype-specific guidance:

diploma:
- institution_country: country whose registrar issued the degree.
- degree_level: 'associate' | 'bachelor' | 'master' | 'phd' | 'professional' (e.g., MD, JD, MBA when those don't fit master/phd) | 'other'.
- conferral_date: ISO YYYY-MM-DD when the degree was conferred.
- graduate_name_ascii: the holder's name in ASCII (apply transliteration).
- registrar_signature_present: true if a registrar / dean / president signature block is visible.
- apostille_or_legalization_present: true if the document includes an apostille certificate (Hague Convention countries) OR consular legalization stamp. CRITICAL — this drives the credential_unverifiable gate. If neither apostille nor legalization is visible, set value=false.

professional_certification:
- scope_or_domain: a short phrase capturing what the certification covers (e.g., "Medium Voltage Switchgear Installation", "AWS Solutions Architect — Associate level", "Microsoft Azure Administrator").
- expiry_date: ISO YYYY-MM-DD; some certifications don't expire — leave value=null.
- certification_id: the identifier on the certificate (number, hash, registry id).

license:
- issuing_authority: regulator name (e.g., "Texas Board of Professional Engineers", "Türkiye Elektrik Mühendisleri Odası").
- license_type: e.g., "Licensed Professional Engineer", "Architect — registered".
- scope: jurisdictional / domain limits printed on the license.

transcript:
- gpa_or_equivalent: as printed (e.g., "3.81/4.00", "First Class Honours", "Magna Cum Laude").
- courses[]: capture each row {course_name, grade, credits}. For very long transcripts (>40 courses), capture the first 40 in chronological order and note "[truncated]" in source_quote on the last course.

Provenance rules — non-negotiable on every leaf field:
- NEVER invent. If a field is not present in this document, return value=null AND source_page=null AND source_quote=null AND confidence=null.
- source_page is the 1-indexed page number from the [page N] markers.
- source_quote is a short verbatim phrase (5–25 words).
- confidence is in [0, 1]; do not emit values below 0.3.

Edge cases:
- A PDF that contains BOTH a diploma AND a transcript: classify by the PRIMARY page (whichever is the front-page exhibit) and note the secondary in source_quote on a relevant field.
- A diploma accompanied by a certified English translation in the same PDF: still classify as diploma. Capture the institution name from the original-language page.
- If the document is partially OCR-garbled, extract what is legible; leave noisy fields null.

Output: ONE JSON object matching the credential_subtype-discriminated CredentialFacts schema. No prose, no commentary, no markdown fences.`;

export interface CredentialExtractInput {
  filename: string;
  text: string;
  pageCount: number;
}

export interface CredentialExtractResult {
  filename: string;
  pageCount: number;
  facts?: CredentialFacts;
  error?: { code: string; message: string };
}

const MAX_TEXT_CHARS = 60_000;

export async function extractCredential(
  input: CredentialExtractInput,
): Promise<CredentialExtractResult> {
  const text =
    input.text.length > MAX_TEXT_CHARS
      ? input.text.slice(0, MAX_TEXT_CHARS) + '\n[…truncated…]'
      : input.text;

  const userMessage = `## Filename\n${input.filename}\n\n## Document text (pages delimited by [page N] markers)\n\n${text}\n\nRespond with ONLY a single JSON object matching the credential_subtype-discriminated CredentialFacts schema. No prose, no markdown fences.`;

  let response;
  try {
    response = await getAnthropic().messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 4000,
      system: [
        {
          type: 'text',
          text: SYSTEM_PROMPT,
          cache_control: { type: 'ephemeral', ttl: '1h' },
        },
      ],
      messages: [{ role: 'user', content: userMessage }],
    });
  } catch (e: unknown) {
    return {
      filename: input.filename,
      pageCount: input.pageCount,
      error: {
        code: 'credential_extract_failed',
        message: e instanceof Error ? e.message : String(e),
      },
    };
  }

  let jsonText = '';
  for (const block of response.content) {
    if (block.type === 'text') jsonText += block.text;
  }

  let raw: unknown;
  try {
    raw = JSON.parse(extractFirstJsonObject(jsonText));
  } catch (e: unknown) {
    return {
      filename: input.filename,
      pageCount: input.pageCount,
      error: {
        code: 'json_parse_failed',
        message: e instanceof Error ? e.message : String(e),
      },
    };
  }

  const validated = CredentialFactsSchema.safeParse(raw);
  if (!validated.success) {
    return {
      filename: input.filename,
      pageCount: input.pageCount,
      error: {
        code: 'schema_mismatch',
        message: validated.error.message.slice(0, 500),
      },
    };
  }

  logAnthropicUsage({
    stage: 'extract',
    model: 'claude-haiku-4-5',
    case_type: 'E2',
    usage: response.usage,
  });

  return {
    filename: input.filename,
    pageCount: input.pageCount,
    facts: validated.data as CredentialFacts,
  };
}
