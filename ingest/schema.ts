import { z } from 'zod';

const Field = <T extends z.ZodTypeAny>(value: T) =>
  z.object({
    value: value.nullable(),
    source_page: z.number().int().nullable(),
    source_quote: z.string().nullable(),
    confidence: z.number().min(0).max(1).nullable(),
  });

export const E2FactsSchema = z.object({
  applicant_name: Field(z.string()),
  dob: Field(z.string()),
  passport_number: Field(z.string()),
  country: Field(z.string()),
  business_name: Field(z.string()),
  ein: Field(z.string()),
  investment_amount: Field(z.number()),
  dates: z.array(Field(z.string())),
  addresses: z.array(Field(z.string())),
});

export type E2Facts = z.infer<typeof E2FactsSchema>;
