import { z } from "zod";
import { scryfallProvider } from "@/lib/cards/scryfall";
import { cardProviderErrorResponse } from "@/lib/api/errors";

const lookupSchema = z.object({
  name: z.string().min(1),
  setCode: z.string().min(1).optional(),
  collectorNumber: z.string().min(1).optional(),
});

const bodySchema = z.union([
  z.object({
    lookups: z.array(lookupSchema).min(1).max(500),
  }),
  z.object({
    names: z.array(z.string().min(1)).min(1).max(500),
  }),
]);

/** Resolves decklist names (and optional printings) to cached card records. */
export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return Response.json(
      {
        error:
          "Expected { lookups: { name, setCode?, collectorNumber? }[] } or { names: string[] }",
      },
      { status: 400 },
    );
  }

  try {
    const lookups =
      "lookups" in parsed.data
        ? parsed.data.lookups
        : parsed.data.names.map((name) => ({ name }));
    const { cards, notFound } = await scryfallProvider.findByLookups(lookups);
    return Response.json({ cards, notFound });
  } catch (error) {
    return cardProviderErrorResponse(error);
  }
}
