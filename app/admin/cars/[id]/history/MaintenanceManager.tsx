"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { AdminCopy } from "../../../../lib/i18n";

type MaintenancePeriod = {
  id: string;
  start_date: string;
  end_date: string;
  reason: string | null;
};

type Props = {
  carId: string;
  periods: MaintenancePeriod[];
  copy: AdminCopy;
  compact?: boolean;
};

export default function MaintenanceManager({
  carId,
  periods,
  copy,
  compact = false,
}: Props) {
  const router = useRouter();
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function addPeriod() {
    setMessage("");
    setLoading(true);

    try {
      const response = await fetch("/api/admin/maintenance-periods", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          car_id: carId,
          start_date: startDate,
          end_date: endDate,
          reason,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setMessage(result.error || copy.failedAction);
        return;
      }

      setStartDate("");
      setEndDate("");
      setReason("");
      router.refresh();
    } catch {
      setMessage(copy.networkAction);
    } finally {
      setLoading(false);
    }
  }

  async function deletePeriod(id: string) {
    setMessage("");
    setLoading(true);

    try {
      const response = await fetch(`/api/admin/maintenance-periods/${id}`, {
        method: "DELETE",
      });

      const result = await response.json();

      if (!response.ok) {
        setMessage(result.error || copy.failedAction);
        return;
      }

      router.refresh();
    } catch {
      setMessage(copy.networkAction);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section
      className={`rounded-2xl border border-zinc-800 p-5 ${
        compact ? "bg-black" : "mb-8 bg-zinc-900"
      }`}
    >
      <h2 className="text-xl font-semibold">{copy.maintenancePeriods}</h2>
      <p className="mt-2 text-sm text-gray-400">{copy.maintenanceHelp}</p>

      <div
        className={`mt-5 grid gap-3 ${
          compact ? "md:grid-cols-2" : "md:grid-cols-[1fr_1fr_1.5fr_auto]"
        }`}
      >
        <input
          type="date"
          value={startDate}
          onChange={(event) => setStartDate(event.target.value)}
          className="rounded-lg border border-zinc-700 bg-black p-3 text-white"
        />
        <input
          type="date"
          value={endDate}
          onChange={(event) => setEndDate(event.target.value)}
          className="rounded-lg border border-zinc-700 bg-black p-3 text-white"
        />
        <input
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder={copy.maintenanceReason}
          className="rounded-lg border border-zinc-700 bg-black p-3 text-white"
        />
        <button
          type="button"
          onClick={addPeriod}
          disabled={loading}
          className={`rounded-lg bg-white px-4 py-3 font-semibold text-black disabled:opacity-50 ${
            compact ? "md:col-span-2" : ""
          }`}
        >
          {copy.addMaintenance}
        </button>
      </div>

      {message && <p className="mt-4 text-sm text-red-400">{message}</p>}

      <div className="mt-5 space-y-3">
        {periods.length === 0 ? (
          <p className="text-sm text-gray-400">{copy.noMaintenancePeriods}</p>
        ) : (
          periods.map((period) => (
            <div
              key={period.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-black p-4 text-sm"
            >
              <div>
                <p className="font-semibold">
                  {period.start_date} - {period.end_date}
                </p>
                <p className="mt-1 text-gray-400">{period.reason || "-"}</p>
              </div>
              <button
                type="button"
                onClick={() => deletePeriod(period.id)}
                disabled={loading}
                className="rounded-lg border border-red-800 px-3 py-2 font-semibold text-red-300 hover:bg-red-950 disabled:opacity-50"
              >
                {copy.deleteMaintenance}
              </button>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
