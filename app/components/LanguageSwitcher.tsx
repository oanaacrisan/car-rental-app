"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { getLanguage, languageLabels, languages, type Language } from "../lib/i18n";

export default function LanguageSwitcher() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentLanguage = getLanguage(searchParams.get("lang"));

  function changeLanguage(language: Language) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("lang", language);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="fixed right-5 top-5 z-50 flex overflow-hidden rounded-lg border border-zinc-700 bg-zinc-950/90 shadow-lg backdrop-blur">
      {languages.map((language) => {
        const isActive = currentLanguage === language;

        return (
          <button
            key={language}
            type="button"
            onClick={() => changeLanguage(language)}
            className={`px-3 py-2 text-sm font-semibold transition ${
              isActive
                ? "bg-white text-black"
                : "text-zinc-300 hover:bg-zinc-800 hover:text-white"
            }`}
            aria-pressed={isActive}
          >
            {languageLabels[language]}
          </button>
        );
      })}
    </div>
  );
}
