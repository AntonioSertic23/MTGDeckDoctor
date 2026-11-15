import { scryfallProvider } from "@/lib/cards/scryfall";
import { cardProviderErrorResponse } from "@/lib/api/errors";

export const maxDuration = 60;

/** Full set checklist for collection “missing from set” views. */
export async function GET(request: Request) {
  const setCode = new URL(request.url).searchParams.get("set")?.trim().toLowerCase() ?? "";

  if (!/^[a-z0-9]{3,6}$/.test(setCode)) {
    return Response.json({ error: "Expected a set code like ?set=acr" }, { status: 400 });
  }

  try {
    const cards = await scryfallProvider.listBySet(setCode);
    return Response.json({ cards });
  } catch (error) {
    return cardProviderErrorResponse(error);
  }
}
