import { z } from "zod";
import { scryfallProvider } from "@/lib/cards/scryfall";
import { cardProviderErrorResponse } from "@/lib/api/errors";

const bodySchema = z.object({
  oracleIds: z.array(z.string().min(1)).min(1).max(500),
});

/** Rehydrates cards for decks already stored locally. */
export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return Response.json(
      { error: "Expected a JSON body of the shape { oracleIds: string[] }" },
      { status: 400 },
    );
  }

  try {
    const cards = await scryfallProvider.getByOracleIds(parsed.data.oracleIds);
    return Response.json({ cards });
  } catch (error) {
    return cardProviderErrorResponse(error);
  }
}
