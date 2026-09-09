"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { adminT, getLanguage } from "../../lib/i18n";

function AdminLoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const language = getLanguage(searchParams.get("lang"));
  const copy = adminT[language];
  const [password, setPassword] = useState("");
  const [secondFactorCode, setSecondFactorCode] = useState("");
  const [captchaAnswer, setCaptchaAnswer] = useState("");
  const [captchaQuestion, setCaptchaQuestion] = useState("");
  const [requiresSecondFactor, setRequiresSecondFactor] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    setMessage("");
    setLoading(true);

    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          password,
          secondFactorCode,
          captchaAnswer,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setMessage(result.error || copy.accessDenied);
        setRequiresSecondFactor(Boolean(result.requiresSecondFactor));
        setCaptchaQuestion(result.captchaQuestion || "");
        return;
      }

      if (result.requiresSecondFactor) {
        setRequiresSecondFactor(true);
        setMessage("Enter the admin 2FA code to complete login.");
        return;
      }

      router.push(`/admin/dashboard?lang=${language}`);
    } catch {
      setMessage(copy.accessDenied);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-black px-6 py-16 text-white">
      <div className="mx-auto max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-8 shadow-xl">
        <h1 className="text-3xl font-bold">{copy.adminDashboard}</h1>
        <p className="mt-2 text-sm text-gray-400">{copy.notAuthorized}</p>

        <label className="mt-6 block">
          <span className="mb-2 block text-sm text-gray-300">Admin password</span>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="w-full rounded-lg border border-zinc-700 bg-black p-3 text-white focus:border-white focus:outline-none"
          />
        </label>

        {requiresSecondFactor && (
          <label className="mt-4 block">
            <span className="mb-2 block text-sm text-gray-300">2FA code</span>
            <input
              type="text"
              value={secondFactorCode}
              onChange={(event) => setSecondFactorCode(event.target.value)}
              className="w-full rounded-lg border border-zinc-700 bg-black p-3 text-white focus:border-white focus:outline-none"
            />
          </label>
        )}

        {captchaQuestion && (
          <label className="mt-4 block">
            <span className="mb-2 block text-sm text-gray-300">
              Security check: {captchaQuestion}
            </span>
            <input
              type="text"
              value={captchaAnswer}
              onChange={(event) => setCaptchaAnswer(event.target.value)}
              className="w-full rounded-lg border border-zinc-700 bg-black p-3 text-white focus:border-white focus:outline-none"
            />
          </label>
        )}

        <button
          type="button"
          onClick={handleLogin}
          disabled={loading}
          className="mt-5 w-full rounded-lg bg-white px-4 py-3 font-semibold text-black hover:bg-gray-200 disabled:opacity-50"
        >
          {loading ? copy.loadingReturnInspection : "Login"}
        </button>

        {message && <p className="mt-4 text-sm text-red-400">{message}</p>}
      </div>
    </main>
  );
}

export default function AdminLoginPage() {
  return (
    <Suspense fallback={null}>
      <AdminLoginContent />
    </Suspense>
  );
}
