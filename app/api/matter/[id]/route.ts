import { buildExhibitList } from '@/draft/exhibit-list';
import { getMockMatter, getMockTypedMemory } from './mock-data';

export const runtime = 'nodejs';

/**
 * Per-PDF inventory entry returned alongside the matter facts so the
 * dashboard's DocumentInventory doesn't have to reach into
 * facts.suggested_filename / facts.display_name on the client. The
 * priority is the same 4-tier render chain the exhibit-list applies:
 * applied alias > display_name > suggested_filename > raw filename.
 */
interface InventoryItem {
  filename: string;
  display_name: string;
  doc_type: string;
  page_count: number;
}

interface InventoryTab {
  tab: string;
  heading: string;
  items: InventoryItem[];
}

export async function GET(
  _request: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await ctx.params;
  const matter = getMockMatter(id);
  const memory = getMockTypedMemory(id);
  const exhibits = buildExhibitList({ memory });

  const inventory: InventoryTab[] = exhibits.tabs.map((tab) => ({
    tab: tab.tab,
    heading: tab.heading,
    items: tab.items.map((item) => ({
      filename: item.filename,
      display_name: item.display_name,
      doc_type: item.doc_type,
      page_count: item.page_count,
    })),
  }));

  return Response.json({ ...matter, inventory });
}
