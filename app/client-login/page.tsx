"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { getLanguage, t } from "../lib/i18n";

function ClientLoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const language = getLanguage(searchParams.get("lang"));
  const copy = t[language];

  const [bookingId, setBookingId] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function findBooking() {
    setMessage("");

    if (!bookingId.trim() || !email.trim()) {
      setMessage(copy.completeRequiredFields);
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/booking-lookup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ bookingId, email }),
      });

      const result = await response.json();

      if (!response.ok) {
        setMessage(result.error || copy.bookingLookupFailed);
        return;
      }

      router.push(`/booking/${result.bookingId}?lang=${language}`);
    } catch {
      setMessage(copy.bookingLookupFailed);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="premium-page px-6 py-16">
      <div className="app-card mx-auto max-w-xl p-8">
        <h1 className="text-4xl font-bold">{copy.clientLoginTitle}</h1>
        <p className="mt-3 text-gray-400">{copy.bookingLookupHelp}</p>

        <div className="mt-8 space-y-4">
          <label className="block">
            <span className="mb-2 block text-sm text-gray-300">
              {copy.bookingReference}
            </span>
            <input
              value={bookingId}
              onChange={(event) => setBookingId(event.target.value)}
              placeholder={copy.enterBookingReference}
              className="control-field"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm text-gray-300">
              {copy.email}
            </span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder={copy.enterEmail}
              className="control-field"
            />
          </label>
        </div>

        {message && <p className="mt-5 text-sm text-red-400">{message}</p>}

        <div className="mt-8 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={findBooking}
            disabled={loading}
            className="btn-primary disabled:opacity-50"
          >
            {loading ? copy.loading : copy.findBooking}
          </button>
          <Link
            href={`/?lang=${language}`}
            className="btn-secondary"
          >
            {copy.backToHome}
          </Link>
        </div>
      </div>
    </main>
  );
}

export default function ClientLoginPage() {
  return (
    <Suspense fallback={null}>
      <ClientLoginContent />
    </Suspense>
  );
}
