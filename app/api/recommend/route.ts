import { GoogleGenAI, Type } from "@google/genai";

export const runtime = "nodejs";
export const maxDuration = 60;

type InputBook = { title: string; author?: string | null };
type Mode = "next" | "shadow";

type RecommendationFromModel = {
  title: string;
  author: string;
  why: string;
  bridge_title: string;
};

type OpenLibraryDoc = {
  title?: string;
  author_name?: string[];
  cover_i?: number;
  first_publish_year?: number;
  key?: string;
};

const NEXT_READS_PROMPT = `You are a thoughtful librarian recommending books to a reader based on their personal shelf.

Recommend 5 books that the reader will safely love — natural next picks given the themes, genres, and sensibilities of their collection. Stay close to what they already enjoy.

Rules:
- Recommend real, published books only. Do not invent titles or authors.
- Do NOT recommend any book that is already in the reader's shelf.
- Each recommendation must reference one specific book on their shelf as the "bridge" — the closest book on their shelf that connects to your pick.
- The "why" must be a single, specific sentence that explains the connection — not vague taste-talk.
- Return ONLY valid JSON matching the schema. No prose.`;

const SHADOW_LIBRARY_PROMPT = `You are an exceptional librarian who specializes in surfacing books a reader's collection IMPLIES they'd love but they'd never find on their own.

Your job is to find the GAP. Look for the implied taste behind the explicit choices. Reach across genres and disciplines the reader only flirts with on this shelf. Surprise them — without ever being random.

Rules:
- Avoid the obvious adjacent pick. If they own Murakami, don't recommend another magic-realist novel — find what that taste reveals.
- Cross genres. A reader of literary fiction + popular science is hungry for narrative non-fiction. A reader of philosophy + thrillers is hungry for taut political memoir. Look for the through-line.
- Recommend real, published books only. Do not invent titles or authors.
- Do NOT recommend any book that is already in the reader's shelf.
- Each recommendation must reference one specific book on their shelf as the "bridge" — the book whose implied taste opens the door to your pick.
- The "why" must be a single, sharp sentence that names the implied taste your pick satisfies — not vague comparison-talk.
- Return ONLY valid JSON matching the schema. No prose.`;

async function searchOpenLibrary(
  title: string,
  author: string
): Promise<OpenLibraryDoc | null> {
  const params = new URLSearchParams({
    title,
    author,
    limit: "1",
    fields: "title,author_name,cover_i,first_publish_year,key",
  });
  try {
    const res = await fetch(
      `https://openlibrary.org/search.json?${params.toString()}`,
      { headers: { "User-Agent": "Tsundoku/0.1 (github.com/ug4672/tsundoku)" } }
    );
    if (!res.ok) return null;
    const json = (await res.json()) as { docs?: OpenLibraryDoc[] };
    return json.docs?.[0] ?? null;
  } catch {
    return null;
  }
}

function buildUserPrompt(
  books: InputBook[],
  favorites: string[],
  mode: Mode
): string {
  const libraryDescription = books
    .map((b) => `- ${b.title}${b.author ? ` by ${b.author}` : ""}`)
    .join("\n");

  const favoritesBlock =
    favorites.length > 0
      ? `\n\nThe reader has marked these as their TOP FAVORITES from the shelf — weigh these heaviest as taste anchors:\n${favorites
          .map((t) => `- ${t}`)
          .join("\n")}`
      : "";

  const closer =
    mode === "shadow"
      ? "Recommend 5 books that this shelf IMPLIES they'd love but they'd never find on their own. Find the gap."
      : "Recommend 5 books they should read next.";

  return `The reader's shelf:\n${libraryDescription}${favoritesBlock}\n\n${closer}`;
}

export async function POST(request: Request) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "GEMINI_API_KEY is not configured" },
      { status: 500 }
    );
  }

  let body: {
    books?: InputBook[];
    favorites?: string[];
    mode?: Mode;
  };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const books = body.books;
  if (!Array.isArray(books) || books.length === 0) {
    return Response.json(
      { error: "Provide a non-empty 'books' array" },
      { status: 400 }
    );
  }

  const favorites = Array.isArray(body.favorites)
    ? body.favorites.filter((s): s is string => typeof s === "string").slice(0, 5)
    : [];

  const mode: Mode = body.mode === "shadow" ? "shadow" : "next";
  const systemPrompt =
    mode === "shadow" ? SHADOW_LIBRARY_PROMPT : NEXT_READS_PROMPT;
  const userPrompt = buildUserPrompt(books, favorites, mode);

  const ai = new GoogleGenAI({ apiKey });

  let modelRecs: RecommendationFromModel[];
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [{ text: systemPrompt }, { text: userPrompt }],
        },
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            recommendations: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  author: { type: Type.STRING },
                  why: { type: Type.STRING },
                  bridge_title: { type: Type.STRING },
                },
                required: ["title", "author", "why", "bridge_title"],
              },
            },
          },
          required: ["recommendations"],
        },
      },
    });

    const text = response.text;
    if (!text) {
      return Response.json(
        { error: "Empty response from Gemini" },
        { status: 502 }
      );
    }
    const parsed = JSON.parse(text);
    modelRecs = parsed.recommendations ?? [];
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json(
      { error: `Gemini call failed: ${message}` },
      { status: 502 }
    );
  }

  // Validate every rec against Open Library — drop hallucinations,
  // enrich the survivors with canonical metadata + cover URL.
  const validated = await Promise.all(
    modelRecs.map(async (rec) => {
      const doc = await searchOpenLibrary(rec.title, rec.author);
      if (!doc || !doc.title) return null;
      return {
        title: doc.title,
        author: doc.author_name?.[0] ?? rec.author,
        first_publish_year: doc.first_publish_year ?? null,
        cover_url: doc.cover_i
          ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg`
          : null,
        open_library_key: doc.key ?? null,
        why: rec.why,
        bridge_title: rec.bridge_title,
      };
    })
  );

  const recommendations = validated.filter((r) => r !== null);

  return Response.json({ mode, recommendations });
}
