import { scryfallProvider } from "@/lib/cards/scryfall";
import { cardProviderErrorResponse } from "@/lib/api/errors";

/** Card search used by the collection and "add card" flows. */
export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";

  if (query.length < 2) {
    return Response.json({ cards: [] });
  }

  try {
    const cards = await scryfallProvider.search(query, 20);
    return Response.json({ cards });
  } catch (error) {
    return cardProviderErrorResponse(error);
  }
}
