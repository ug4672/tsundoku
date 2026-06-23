"use client";

import { useRef, useState } from "react";

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
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  function reset() {
    setBooks(null);
    setRecs(null);
    setRecsMode(null);
    setFavoriteIndices(new Set());
    setScanError(null);
    setRecsError(null);
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const next = e.target.files?.[0] ?? null;
    reset();
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
    <div className="flex min-h-screen flex-col">
      <main className="flex-1 flex flex-col items-center px-4 pt-12 pb-20 sm:px-6 sm:pt-16">
        <div className="w-full max-w-2xl flex flex-col gap-14">
          <Hero />

          {!file && !books && <HowItWorks />}

          <UploadZone
            previewUrl={previewUrl}
            fileName={file?.name ?? null}
            onPick={() => fileInputRef.current?.click()}
            onExtract={handleExtract}
            extracting={scanLoading}
            hasResults={Boolean(books)}
          />

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFile}
            className="hidden"
          />

          {scanError && <ErrorBox message={scanError} />}

          {scanLoading && <BookListSkeleton />}

          {books && !scanLoading && (
            <BooksSection
              books={books}
              favoriteIndices={favoriteIndices}
              favoritesCount={favoritesCount}
              onToggleFavorite={toggleFavorite}
              mode={mode}
              onModeChange={setMode}
              onRecommend={handleRecommend}
              recsLoading={recsLoading}
            />
          )}

          {recsError && <ErrorBox message={recsError} />}

          {recsLoading && <RecsSkeleton />}

          {recs && !recsLoading && (
            <RecsSection mode={recsMode ?? mode} recs={recs} />
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}

function Hero() {
  return (
    <header className="flex flex-col items-center gap-5 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-3xl shadow-sm">
        📚
      </div>
      <div className="flex flex-col gap-3">
        <h1 className="font-serif text-5xl font-semibold tracking-tight text-[var(--foreground)] sm:text-6xl">
          Tsundoku
        </h1>
        <p className="text-base text-[var(--foreground-muted)] sm:text-lg max-w-md">
          Photograph your bookshelf. Get safe next reads — or a{" "}
          <span className="font-serif italic text-[var(--accent)]">
            shadow library
          </span>{" "}
          of books your taste implies you&apos;d love but you&apos;d never find on your own.
        </p>
      </div>
    </header>
  );
}

function HowItWorks() {
  const steps = [
    {
      n: "1",
      title: "Photograph your shelf",
      body: "One clear shot of any bookshelf. Phone camera is fine.",
    },
    {
      n: "2",
      title: "Tap your favorites",
      body: "Mark up to 5 books you love. They anchor your taste.",
    },
    {
      n: "3",
      title: "Get a shadow library",
      body: "Safe next reads — or surprising picks across genres.",
    },
  ];
  return (
    <section className="grid gap-4 sm:grid-cols-3">
      {steps.map((step) => (
        <div
          key={step.n}
          className="flex flex-col gap-2 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5"
        >
          <span className="font-serif text-3xl font-medium text-[var(--accent)] leading-none">
            {step.n}
          </span>
          <h3 className="font-medium text-[var(--foreground)]">{step.title}</h3>
          <p className="text-sm text-[var(--foreground-muted)] leading-snug">
            {step.body}
          </p>
        </div>
      ))}
    </section>
  );
}

function UploadZone({
  previewUrl,
  fileName,
  onPick,
  onExtract,
  extracting,
  hasResults,
}: {
  previewUrl: string | null;
  fileName: string | null;
  onPick: () => void;
  onExtract: () => void;
  extracting: boolean;
  hasResults: boolean;
}) {
  return (
    <section className="flex flex-col gap-4">
      <button
        type="button"
        onClick={onPick}
        className="group relative flex min-h-48 w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-[var(--border)] bg-[var(--surface)] p-6 text-center transition-colors hover:border-[var(--accent)] hover:bg-[var(--accent-soft)]"
      >
        {previewUrl ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl}
              alt="Bookshelf preview"
              className="max-h-72 w-full rounded-lg object-contain"
            />
            <p className="text-xs text-[var(--foreground-muted)]">
              {fileName} · tap to change
            </p>
          </>
        ) : (
          <>
            <span className="text-3xl">📷</span>
            <div className="flex flex-col gap-1">
              <p className="font-medium text-[var(--foreground)]">
                Tap to photograph or upload
              </p>
              <p className="text-sm text-[var(--foreground-muted)]">
                JPG or PNG · phone camera recommended
              </p>
            </div>
          </>
        )}
      </button>

      {previewUrl && !hasResults && (
        <button
          type="button"
          onClick={onExtract}
          disabled={extracting}
          className="flex h-12 w-full items-center justify-center rounded-full bg-[var(--accent)] text-white font-medium transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {extracting ? "Reading spines…" : "Extract books"}
        </button>
      )}
    </section>
  );
}

function BookListSkeleton() {
  return (
    <section className="flex flex-col gap-3">
      <div className="shimmer h-6 w-40 rounded-md" />
      <div className="flex flex-col gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="shimmer h-16 w-full rounded-lg" />
        ))}
      </div>
    </section>
  );
}

function BooksSection({
  books,
  favoriteIndices,
  favoritesCount,
  onToggleFavorite,
  mode,
  onModeChange,
  onRecommend,
  recsLoading,
}: {
  books: Book[];
  favoriteIndices: Set<number>;
  favoritesCount: number;
  onToggleFavorite: (i: number) => void;
  mode: Mode;
  onModeChange: (m: Mode) => void;
  onRecommend: () => void;
  recsLoading: boolean;
}) {
  if (books.length === 0) {
    return (
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 text-center">
        <p className="text-sm text-[var(--foreground-muted)]">
          No books detected. Try a closer shot with even lighting.
        </p>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h2 className="font-serif text-2xl font-semibold text-[var(--foreground)]">
          {books.length} {books.length === 1 ? "title" : "titles"} on the shelf
        </h2>
        <p className="text-sm text-[var(--foreground-muted)]">
          Tap the heart on up to {MAX_FAVORITES} books you love — they become
          taste anchors.{" "}
          <span className="text-[var(--accent)] font-medium">
            {favoritesCount}/{MAX_FAVORITES}
          </span>{" "}
          selected.
        </p>
      </div>

      <ul className="flex flex-col gap-2">
        {books.map((book, i) => {
          const isFav = favoriteIndices.has(i);
          const canFav = isFav || favoritesCount < MAX_FAVORITES;
          return (
            <li
              key={`${book.title}-${i}`}
              className={`flex items-start gap-3 rounded-xl border bg-[var(--surface)] px-4 py-3 transition-colors ${
                isFav
                  ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                  : "border-[var(--border)]"
              }`}
            >
              <button
                type="button"
                onClick={() => onToggleFavorite(i)}
                disabled={!canFav}
                aria-label={isFav ? "Remove from favorites" : "Mark as favorite"}
                className={`shrink-0 mt-0.5 text-xl leading-none transition ${
                  isFav
                    ? "opacity-100 scale-110"
                    : canFav
                      ? "opacity-30 hover:opacity-70"
                      : "opacity-15 cursor-not-allowed"
                }`}
              >
                {isFav ? "❤️" : "🤍"}
              </button>
              <div className="flex flex-col flex-1 min-w-0">
                <span className="font-serif text-base font-medium text-[var(--foreground)] leading-snug">
                  {book.title}
                </span>
                {book.author && (
                  <span className="text-sm text-[var(--foreground-muted)]">
                    {book.author}
                  </span>
                )}
              </div>
              <ConfidenceBadge level={book.confidence} />
            </li>
          );
        })}
      </ul>

      <div className="flex flex-col gap-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
        <ModeToggle mode={mode} onChange={onModeChange} />
        <button
          type="button"
          onClick={onRecommend}
          disabled={recsLoading}
          className="flex h-12 w-full items-center justify-center rounded-full bg-[var(--accent)] text-white font-medium transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
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
    </section>
  );
}

function ModeToggle({
  mode,
  onChange,
}: {
  mode: Mode;
  onChange: (m: Mode) => void;
}) {
  const opts: { id: Mode; label: string; sub: string }[] = [
    { id: "next", label: "Next reads", sub: "Safe · close to your taste" },
    { id: "shadow", label: "Shadow library", sub: "Adventurous · find the gap" },
  ];
  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium text-[var(--foreground)]">
        Recommendation mode
      </span>
      <div role="radiogroup" className="grid grid-cols-2 gap-2">
        {opts.map((opt) => {
          const active = mode === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(opt.id)}
              className={`flex flex-col items-start rounded-xl border p-3 text-left transition-colors ${
                active
                  ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                  : "border-[var(--border)] bg-[var(--surface)] hover:border-[var(--foreground-muted)]"
              }`}
            >
              <span
                className={`font-medium ${
                  active ? "text-[var(--accent)]" : "text-[var(--foreground)]"
                }`}
              >
                {opt.label}
              </span>
              <span className="text-xs text-[var(--foreground-muted)]">
                {opt.sub}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function RecsSkeleton() {
  return (
    <section className="flex flex-col gap-4">
      <div className="shimmer h-7 w-48 rounded-md" />
      <div className="flex flex-col gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex gap-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <div className="shimmer h-32 w-22 shrink-0 rounded-md" />
            <div className="flex flex-1 flex-col gap-2">
              <div className="shimmer h-5 w-3/4 rounded-md" />
              <div className="shimmer h-4 w-1/2 rounded-md" />
              <div className="shimmer h-12 w-full rounded-md" />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function RecsSection({ mode, recs }: { mode: Mode; recs: Recommendation[] }) {
  if (recs.length === 0) {
    return (
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 text-center">
        <p className="text-sm text-[var(--foreground-muted)]">
          No recommendations made it through validation. Try again with a
          larger shelf for better signal.
        </p>
      </section>
    );
  }
  return (
    <section className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <p className="text-xs font-medium uppercase tracking-widest text-[var(--accent)]">
          {mode === "shadow" ? "Shadow library" : "Next reads"}
        </p>
        <h2 className="font-serif text-2xl font-semibold text-[var(--foreground)]">
          {mode === "shadow"
            ? "Books your shelf implies you'd love"
            : "Your safe next reads"}
        </h2>
      </div>

      <ul className="flex flex-col gap-3">
        {recs.map((rec, i) => (
          <li
            key={`${rec.title}-${i}`}
            className="flex gap-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 transition-shadow hover:shadow-sm"
          >
            <div className="shrink-0 w-22 h-32 overflow-hidden rounded-md bg-[var(--accent-soft)] flex items-center justify-center shadow-sm">
              {rec.cover_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={rec.cover_url}
                  alt={`Cover of ${rec.title}`}
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="text-xs text-[var(--foreground-muted)]">
                  No cover
                </span>
              )}
            </div>
            <div className="flex flex-col gap-1.5 min-w-0 flex-1">
              <h3 className="font-serif text-lg font-semibold text-[var(--foreground)] leading-tight">
                {rec.title}
              </h3>
              <p className="text-sm text-[var(--foreground-muted)]">
                {rec.author}
                {rec.first_publish_year ? ` · ${rec.first_publish_year}` : ""}
              </p>
              <blockquote className="border-l-2 border-[var(--accent)] pl-3 mt-1 font-serif italic text-[15px] text-[var(--foreground)] leading-snug">
                {rec.why}
              </blockquote>
              <p className="text-xs text-[var(--foreground-muted)] mt-1">
                Bridged from{" "}
                <span className="font-medium text-[var(--foreground)]">
                  {rec.bridge_title}
                </span>
              </p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function ConfidenceBadge({ level }: { level: Confidence }) {
  const styles: Record<Confidence, string> = {
    high: "bg-[var(--accent-soft)] text-[var(--accent)]",
    medium: "bg-[var(--accent-soft)] text-[var(--foreground-muted)]",
    low: "bg-transparent border border-[var(--border)] text-[var(--foreground-muted)]",
  };
  return (
    <span
      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${styles[level]}`}
    >
      {level}
    </span>
  );
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
      {message}
    </div>
  );
}

function Footer() {
  return (
    <footer className="border-t border-[var(--border)] py-6">
      <div className="mx-auto flex max-w-2xl flex-col items-center gap-1 px-4 text-center text-xs text-[var(--foreground-muted)] sm:flex-row sm:justify-between">
        <p>
          Book data via{" "}
          <a
            href="https://openlibrary.org"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-[var(--foreground)]"
          >
            Open Library
          </a>
        </p>
        <p>
          Built in public ·{" "}
          <a
            href="https://github.com/ug4672/tsundoku"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-[var(--foreground)]"
          >
            GitHub
          </a>
        </p>
      </div>
    </footer>
  );
}
