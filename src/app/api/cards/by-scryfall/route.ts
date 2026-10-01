import { z } from "zod";
import { scryfallProvider } from "@/lib/cards/scryfall";
import { cardProviderErrorResponse } from "@/lib/api/errors";

const bodySchema = z.object({
  scryfallIds: z.array(z.string().uuid()).min(1).max(500),
});

/** Resolves exact printings. Oracle-id lookup returns a default art and is the wrong tool here. */
export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return Response.json(
      { error: "Expected a JSON body of the shape { scryfallIds: uuid[] }" },
      { status: 400 },
    );
  }

  try {
    const cards = await scryfallProvider.getByScryfallIds(parsed.data.scryfallIds);
    return Response.json({ cards });
  } catch (error) {
    return cardProviderErrorResponse(error);
  }
}
