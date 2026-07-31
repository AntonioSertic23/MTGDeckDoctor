import { ScryfallError } from "@/lib/cards/scryfall";

/** Translates provider failures into responses the UI can show verbatim. */
export function cardProviderErrorResponse(error: unknown): Response {
  if (error instanceof ScryfallError) {
    const status = error.status === 429 ? 429 : 502;
    return Response.json(
      { error: "The card database is temporarily unavailable. Please try again." },
      { status },
    );
  }
  return Response.json({ error: "Unexpected error while resolving cards." }, { status: 500 });
}
