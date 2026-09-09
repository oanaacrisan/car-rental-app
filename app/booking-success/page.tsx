import Link from "next/link";
import { getLanguage, t } from "../lib/i18n";

export default async function BookingSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string; id?: string; token?: string }>;
}) {
  const params = await searchParams;
  const language = getLanguage(params.lang);
  const copy = t[language];

  return (
    <main className="premium-page px-6 py-16">
      <div className="app-card mx-auto max-w-2xl p-8">
        <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-green-300">
          PENDING
        </p>
        <h1 className="text-4xl font-bold">{copy.bookingSubmittedTitle}</h1>
        <p className="mt-4 text-gray-300">{copy.bookingSubmittedText}</p>

        <Link
          href={`/?lang=${language}`}
          className="btn-primary mt-8"
        >
          {copy.backToHome}
        </Link>
        {params.id && (
          <Link
            href={`/booking/${params.id}?lang=${language}${
              params.token ? `&token=${encodeURIComponent(params.token)}` : ""
            }`}
            className="btn-secondary ml-3 mt-8"
          >
            {copy.viewBookingStatus}
          </Link>
        )}
      </div>
    </main>
  );
}
