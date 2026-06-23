"use client";

import { useState } from "react";

type Confidence = "high" | "medium" | "low";

type Book = {
  title: string;
  author: string | null;
  confidence: Confidence;
};

type ScanResponse = { books: Book[] } | { error: string };

export default function Home() {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [books, setBooks] = useState<Book[] | null>(null);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const next = e.target.files?.[0] ?? null;
    setBooks(null);
    setError(null);
    setFile(next);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(next ? URL.createObjectURL(next) : null);
  }

  async function handleSubmit() {
    if (!file) return;
    setLoading(true);
    setError(null);
    setBooks(null);

    const fd = new FormData();
    fd.append("image", file);

    try {
      const res = await fetch("/api/scan", { method: "POST", body: fd });
      const data: ScanResponse = await res.json();
      if (!res.ok || "error" in data) {
        setError("error" in data ? data.error : `Request failed (${res.status})`);
      } else {
        setBooks(data.books);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center bg-zinc-50 px-6 py-12 dark:bg-black">
      <div className="w-full max-w-2xl flex flex-col gap-8">
        <header className="flex flex-col items-center gap-3 text-center">
          <div className="text-4xl">📚</div>
          <h1 className="text-3xl font-semibold tracking-tight text-black dark:text-zinc-50">
            Tsundoku
          </h1>
          <p className="text-zinc-600 dark:text-zinc-400">
            Photograph a bookshelf to extract every title you can see.
          </p>
        </header>

        <section className="flex flex-col gap-4">
          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Bookshelf photo
            </span>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFile}
              className="block w-full text-sm text-zinc-600 file:mr-4 file:rounded-full file:border-0 file:bg-black file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-zinc-800 dark:text-zinc-300 dark:file:bg-zinc-50 dark:file:text-black"
            />
          </label>

          {previewUrl && (
            <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewUrl}
                alt="Bookshelf preview"
                className="w-full max-h-96 object-contain bg-zinc-100 dark:bg-zinc-900"
              />
            </div>
          )}

          <button
            type="button"
            onClick={handleSubmit}
            disabled={!file || loading}
            className="flex h-12 w-full items-center justify-center rounded-full bg-black text-white font-medium transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-zinc-50 dark:text-black dark:hover:bg-zinc-200"
          >
            {loading ? "Reading spines…" : "Extract books"}
          </button>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
              {error}
            </div>
          )}
        </section>

        {books && (
          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-medium text-black dark:text-zinc-50">
              Found {books.length} {books.length === 1 ? "book" : "books"}
            </h2>
            <ul className="flex flex-col gap-2">
              {books.map((book, i) => (
                <li
                  key={`${book.title}-${i}`}
                  className="flex items-start justify-between gap-3 rounded-lg border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900"
                >
                  <div className="flex flex-col">
                    <span className="font-medium text-black dark:text-zinc-50">
                      {book.title}
                    </span>
                    {book.author && (
                      <span className="text-sm text-zinc-600 dark:text-zinc-400">
                        {book.author}
                      </span>
                    )}
                  </div>
                  <ConfidenceBadge level={book.confidence} />
                </li>
              ))}
            </ul>
            {books.length === 0 && (
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                No books detected. Try a closer shot with even lighting.
              </p>
            )}
          </section>
        )}
      </div>
    </main>
  );
}

function ConfidenceBadge({ level }: { level: Confidence }) {
  const styles: Record<Confidence, string> = {
    high: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
    medium: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
    low: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
  };
  return (
    <span
      className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${styles[level]}`}
    >
      {level}
    </span>
  );
}
