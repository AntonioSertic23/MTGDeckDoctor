import { getSetNameMap } from "@/lib/cards/scryfall";
import { cardProviderErrorResponse } from "@/lib/api/errors";

export const maxDuration = 60;

/** Full set catalog for collection filter labels (code → name). */
export async function GET() {
  try {
    const names = await getSetNameMap();
    return Response.json({
      sets: [...names.entries()].map(([code, name]) => ({ code, name })),
    });
  } catch (error) {
    return cardProviderErrorResponse(error);
  }
}
