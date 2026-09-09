import Link from "next/link";
import { getLanguage, t } from "../lib/i18n";

export default async function TermsPage({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string }>;
}) {
  const params = await searchParams;
  const language = getLanguage(params.lang);
  const copy = t[language];

  const sections = [
    [copy.termsDocumentsTitle, copy.termsDocumentsText],
    [copy.termsPaymentTitle, copy.termsPaymentText],
    [copy.termsDepositTitle, copy.termsDepositText],
    [copy.termsCancellationTitle, copy.termsCancellationText],
    [copy.termsReturnTitle, copy.termsReturnText],
    [copy.termsTrackTitle, copy.termsTrackText],
  ];

  return (
    <main className="premium-page px-6 py-12">
      <div className="premium-container max-w-4xl">
        <Link
          href={`/?lang=${language}`}
          className="btn-secondary mb-8"
        >
          {copy.backToHome}
        </Link>

        <h1 className="section-heading">{copy.termsTitle}</h1>
        <p className="mt-4 text-gray-400">{copy.termsIntro}</p>

        <div className="mt-8 space-y-4">
          {sections.map(([title, text]) => (
            <section
              key={title}
              className="info-tile"
            >
              <h2 className="text-xl font-semibold">{title}</h2>
              <p className="mt-3 leading-7 text-gray-400">{text}</p>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
