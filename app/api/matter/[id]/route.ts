import { getMockMatter } from './mock-data';

export const runtime = 'nodejs';

export async function GET(
  _request: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await ctx.params;
  const matter = getMockMatter(id);
  return Response.json(matter);
}
