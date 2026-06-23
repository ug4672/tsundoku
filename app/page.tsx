"use client";

import { useState } from "react";

type Confidence = "high" | "medium" | "low";
type Mode = "next" | "shadow";

type Book = {
  title: string;
  author: string | null;
  confidence: Confidence;
};

type Recommendation = {
  title: string;
  author: string;
  first_publish_year: number | null;
  cover_url: string | null;
  open_library_key: string | null;
  why: string;
  bridge_title: string;
};

const MAX_FAVORITES = 5;

export default function Home() {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);

  const [scanLoading, setScanLoading] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [books, setBooks] = useState<Book[] | null>(null);

  const [favoriteIndices, setFavoriteIndices] = useState<Set<number>>(new Set());
  const [mode, setMode] = useState<Mode>("next");

  const [recsLoading, setRecsLoading] = useState(false);
  const [recsError, setRecsError] = useState<string | null>(null);
  const [recsMode, setRecsMode] = useState<Mode | null>(null);
  const [recs, setRecs] = useState<Recommendation[] | null>(null);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const next = e.target.files?.[0] ?? null;
    setBooks(null);
    setRecs(null);
    setRecsMode(null);
    setFavoriteIndices(new Set());
    setScanError(null);
    setRecsError(null);
    setFile(next);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(next ? URL.createObjectURL(next) : null);
  }

  async function handleExtract() {
    if (!file) return;
    setScanLoading(true);
    setScanError(null);
    setBooks(null);
    setRecs(null);
    setRecsMode(null);
    setFavoriteIndices(new Set());

    const fd = new FormData();
    fd.append("image", file);

    try {
      const res = await fetch("/api/scan", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok || data.error) {
        setScanError(data.error ?? `Request failed (${res.status})`);
      } else {
        setBooks(data.books ?? []);
      }
    } catch (err) {
      setScanError(err instanceof Error ? err.message : "Network error");
    } finally {
      setScanLoading(false);
    }
  }

  function toggleFavorite(index: number) {
    setFavoriteIndices((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else if (next.size < MAX_FAVORITES) {
        next.add(index);
      }
      return next;
    });
  }

  async function handleRecommend() {
    if (!books || books.length === 0) return;
    setRecsLoading(true);
    setRecsError(null);
    setRecs(null);
    setRecsMode(null);

    const favoritesList = Array.from(favoriteIndices)
      .map((i) => books[i]?.title)
      .filter((t): t is string => Boolean(t));

    try {
      const res = await fetch("/api/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          books: books.map((b) => ({ title: b.title, author: b.author })),
          favorites: favoritesList,
          mode,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setRecsError(data.error ?? `Request failed (${res.status})`);
      } else {
        setRecs(data.recommendations ?? []);
        setRecsMode(data.mode ?? mode);
      }
    } catch (err) {
      setRecsError(err instanceof Error ? err.message : "Network error");
    } finally {
      setRecsLoading(false);
    }
  }

  const favoritesCount = favoriteIndices.size;

  return (
    <main className="flex min-h-screen flex-col items-center bg-zinc-50 px-4 py-10 dark:bg-black sm:px-6 sm:py-14">
      <div className="w-full max-w-2xl flex flex-col gap-10">
        <header className="flex flex-col items-center gap-3 text-center">
          <div className="text-4xl">📚</div>
          <h1 className="text-3xl font-semibold tracking-tight text-black dark:text-zinc-50">
            Tsundoku
          </h1>
          <p className="text-zinc-600 dark:text-zinc-400 max-w-sm">
            Photograph a bookshelf. Get safe next reads — or a shadow library of
            books your taste implies but you&apos;d never find on your own.
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
                className="w-full max-h-80 object-contain bg-zinc-100 dark:bg-zinc-900"
              />
            </div>
          )}

          <button
            type="button"
            onClick={handleExtract}
            disabled={!file || scanLoading}
            className="flex h-12 w-full items-center justify-center rounded-full bg-black text-white font-medium transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-zinc-50 dark:text-black dark:hover:bg-zinc-200"
          >
            {scanLoading ? "Reading spines…" : "Extract books"}
          </button>

          {scanError && <ErrorBox message={scanError} />}
        </section>

        {books && (
          <section className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <h2 className="text-lg font-medium text-black dark:text-zinc-50">
                Found {books.length} {books.length === 1 ? "book" : "books"}
              </h2>
              {books.length > 0 && (
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  Tap the heart on up to {MAX_FAVORITES} books you love — they
                  become taste anchors for the recommendations.
                  {favoritesCount > 0 &&
                    ` ${favoritesCount}/${MAX_FAVORITES} selected.`}
                </p>
              )}
            </div>

            {books.length === 0 ? (
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                No books detected. Try a closer shot with even lighting.
              </p>
            ) : (
              <>
                <ul className="flex flex-col gap-2">
                  {books.map((book, i) => {
                    const isFav = favoriteIndices.has(i);
                    const canStillFav =
                      isFav || favoritesCount < MAX_FAVORITES;
                    return (
                      <li
                        key={`${book.title}-${i}`}
                        className="flex items-start justify-between gap-3 rounded-lg border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900"
                      >
                        <button
                          type="button"
                          onClick={() => toggleFavorite(i)}
                          disabled={!canStillFav}
                          aria-label={
                            isFav ? "Remove from favorites" : "Mark as favorite"
                          }
                          className={`shrink-0 mt-0.5 text-xl leading-none transition ${
                            isFav
                              ? "opacity-100"
                              : canStillFav
                                ? "opacity-30 hover:opacity-70"
                                : "opacity-15 cursor-not-allowed"
                          }`}
                        >
                          {isFav ? "❤️" : "🤍"}
                        </button>
                        <div className="flex flex-col flex-1 min-w-0">
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
                    );
                  })}
                </ul>

                <div className="flex flex-col gap-3">
                  <ModeToggle mode={mode} onChange={setMode} />

                  <button
                    type="button"
                    onClick={handleRecommend}
                    disabled={recsLoading}
                    className="flex h-12 w-full items-center justify-center rounded-full border-2 border-black text-black font-medium transition-colors hover:bg-black hover:text-white disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-50 dark:text-zinc-50 dark:hover:bg-zinc-50 dark:hover:text-black"
                  >
                    {recsLoading
                      ? mode === "shadow"
                        ? "Finding the gap…"
                        : "Finding your next reads…"
                      : mode === "shadow"
                        ? "Build my shadow library"
                        : "Recommend next reads"}
                  </button>
                </div>

                {recsError && <ErrorBox message={recsError} />}
              </>
            )}
          </section>
        )}

        {recs && recs.length > 0 && (
          <section className="flex flex-col gap-4">
            <h2 className="text-lg font-medium text-black dark:text-zinc-50">
              {recsMode === "shadow"
                ? `Your shadow library · ${recs.length}`
                : `Your next ${recs.length} reads`}
            </h2>
            <ul className="flex flex-col gap-3">
              {recs.map((rec, i) => (
                <li
                  key={`${rec.title}-${i}`}
                  className="flex gap-4 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
                >
                  <div className="shrink-0 w-20 h-28 bg-zinc-100 dark:bg-zinc-800 rounded-md overflow-hidden flex items-center justify-center">
                    {rec.cover_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={rec.cover_url}
                        alt={`Cover of ${rec.title}`}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-xs text-zinc-400">No cover</span>
                    )}
                  </div>
                  <div className="flex flex-col gap-1 min-w-0">
                    <h3 className="font-medium text-black dark:text-zinc-50 leading-tight">
                      {rec.title}
                    </h3>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400">
                      {rec.author}
                      {rec.first_publish_year ? ` · ${rec.first_publish_year}` : ""}
                    </p>
                    <p className="text-sm text-zinc-700 dark:text-zinc-300 mt-1 leading-snug">
                      {rec.why}
                    </p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-500 mt-1 italic">
                      Bridge: {rec.bridge_title}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {recs && recs.length === 0 && (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            No recommendations made it through validation. Try again with a
            larger shelf for better signal.
          </p>
        )}
      </div>
    </main>
  );
}

function ModeToggle({
  mode,
  onChange,
}: {
  mode: Mode;
  onChange: (m: Mode) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
        Recommendation mode
      </span>
      <div
        role="radiogroup"
        className="grid grid-cols-2 rounded-full border border-zinc-200 bg-white p-1 dark:border-zinc-800 dark:bg-zinc-900"
      >
        <ToggleButton
          active={mode === "next"}
          onClick={() => onChange("next")}
          label="Next reads"
          sub="Safe"
        />
        <ToggleButton
          active={mode === "shadow"}
          onClick={() => onChange("shadow")}
          label="Shadow library"
          sub="Adventurous"
        />
      </div>
    </div>
  );
}

function ToggleButton({
  active,
  onClick,
  label,
  sub,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  sub: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      className={`flex flex-col items-center justify-center rounded-full py-2 text-sm font-medium transition-colors ${
        active
          ? "bg-black text-white dark:bg-zinc-50 dark:text-black"
          : "text-zinc-600 hover:text-black dark:text-zinc-400 dark:hover:text-zinc-50"
      }`}
    >
      <span>{label}</span>
      <span
        className={`text-[10px] uppercase tracking-wide ${
          active ? "opacity-70" : "opacity-50"
        }`}
      >
        {sub}
      </span>
    </button>
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

function ErrorBox({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
      {message}
    </div>
  );
}
