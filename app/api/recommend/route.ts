import { GoogleGenAI, Type } from "@google/genai";

export const runtime = "nodejs";
export const maxDuration = 60;

type InputBook = { title: string; author?: string | null };

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

const SYSTEM_PROMPT = `You are a thoughtful librarian recommending books to a reader based on their personal shelf.

Given a list of books the reader owns, recommend 5 books they likely have NOT read but would love based on the themes, genres, and sensibilities of their collection.

Rules:
- Recommend real, published books only. Do not invent titles or authors.
- Do NOT recommend any book that is already in the reader's shelf.
- Each recommendation must reference one specific book on their shelf as the "bridge" — the closest book on their shelf that connects to your pick.
- The "why" must be a single, specific sentence that explains the connection — not vague taste-talk.
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

export async function POST(request: Request) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "GEMINI_API_KEY is not configured" },
      { status: 500 }
    );
  }

  let body: { books?: InputBook[] };
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

  const libraryDescription = books
    .map((b) => `- ${b.title}${b.author ? ` by ${b.author}` : ""}`)
    .join("\n");

  const ai = new GoogleGenAI({ apiKey });

  let modelRecs: RecommendationFromModel[];
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [
            { text: SYSTEM_PROMPT },
            {
              text: `The reader's shelf:\n${libraryDescription}\n\nRecommend 5 books they should read next.`,
            },
          ],
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

  return Response.json({ recommendations });
}
