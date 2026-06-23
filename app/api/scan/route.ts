import { GoogleGenAI, Type } from "@google/genai";

export const runtime = "nodejs";
export const maxDuration = 60;

const SYSTEM_PROMPT = `You are a careful librarian looking at a photograph of a bookshelf.

Read every book spine you can see. For each one, return:
- title: best guess of the title
- author: best guess of the author if visible, otherwise null
- confidence: "high" if you're sure, "medium" if partial/blurry, "low" if you're guessing

Rules:
- Only include books you can actually see on a spine. Do not invent books.
- Do not include items that aren't books (boxes, decor, lamps).
- If a spine is too obscured to read, skip it instead of guessing.
- Return ONLY valid JSON matching the schema. No prose.`;

export async function POST(request: Request) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "GEMINI_API_KEY is not configured" },
      { status: 500 }
    );
  }

  const formData = await request.formData();
  const image = formData.get("image");

  if (!(image instanceof File)) {
    return Response.json(
      { error: "Missing 'image' file in form data" },
      { status: 400 }
    );
  }

  if (!image.type.startsWith("image/")) {
    return Response.json(
      { error: `Unsupported file type: ${image.type}` },
      { status: 400 }
    );
  }

  const buffer = Buffer.from(await image.arrayBuffer());
  const base64 = buffer.toString("base64");

  const ai = new GoogleGenAI({ apiKey });

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [
            { text: SYSTEM_PROMPT },
            { inlineData: { mimeType: image.type, data: base64 } },
          ],
        },
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            books: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  author: { type: Type.STRING, nullable: true },
                  confidence: {
                    type: Type.STRING,
                    enum: ["high", "medium", "low"],
                  },
                },
                required: ["title", "confidence"],
              },
            },
          },
          required: ["books"],
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
    return Response.json(parsed);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json(
      { error: `Gemini call failed: ${message}` },
      { status: 502 }
    );
  }
}
