export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 px-6 dark:bg-black">
      <div className="flex flex-col items-center gap-6 text-center max-w-xl">
        <div className="text-5xl">📚</div>
        <h1 className="text-4xl font-semibold tracking-tight text-black dark:text-zinc-50">
          Tsundoku
        </h1>
        <p className="text-lg text-zinc-600 dark:text-zinc-400">
          Photograph your bookshelf. Get recommendations from books you actually own —
          plus a shadow library of titles you&apos;d love but haven&apos;t found yet.
        </p>
        <p className="text-sm text-zinc-500 dark:text-zinc-500">
          Coming soon · Building in public
        </p>
      </div>
    </main>
  );
}
