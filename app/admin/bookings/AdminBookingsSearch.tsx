"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { AdminCopy } from "../../lib/i18n";

type Props = {
  initialQuery: string;
  selectedStatus: string;
  language: string;
  copy: AdminCopy;
};

export default function AdminBookingsSearch({
  initialQuery,
  selectedStatus,
  language,
  copy,
}: Props) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);

  function buildUrl(nextQuery: string) {
    const params = new URLSearchParams();
    params.set("status", selectedStatus);
    params.set("lang", language);

    if (nextQuery.trim()) {
      params.set("q", nextQuery.trim());
    }

    return `/admin/bookings?${params.toString()}`;
  }

  function submitSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    router.push(buildUrl(query));
  }

  function clearSearch() {
    setQuery("");
    router.push(buildUrl(""));
  }

  return (
    <form onSubmit={submitSearch} className="mb-6 flex flex-wrap gap-3">
      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={copy.searchBookings}
        className="min-w-72 rounded-lg border border-zinc-700 bg-black px-4 py-2 text-white"
      />
      <button className="rounded-lg bg-white px-4 py-2 font-semibold text-black">
        {copy.search}
      </button>
      {query && (
        <button
          type="button"
          onClick={clearSearch}
          className="rounded-lg border border-zinc-700 px-4 py-2 font-semibold text-zinc-200 hover:bg-zinc-800"
        >
          {copy.clearSearch}
        </button>
      )}
      <a
        href={`/api/admin/bookings/export?status=${selectedStatus}&q=${encodeURIComponent(
          query
        )}`}
        className="rounded-lg border border-zinc-700 px-4 py-2 font-semibold text-zinc-200 hover:bg-zinc-800"
      >
        {copy.exportCsv}
      </a>
    </form>
  );
}
