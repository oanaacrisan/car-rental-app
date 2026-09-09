"use client";

import { useEffect, useMemo, useState } from "react";
import type { AdminCopy } from "../../../lib/i18n";

type Props = {
  bookingId: string;
  depositAmount: number;
  copy: AdminCopy;
};

type InspectionState = {
  fuel_not_full: boolean;
  interior_dirty: boolean;
  exterior_dirty: boolean;
  new_damage: boolean;
  missing_accessories: boolean;
  late_return: boolean;
  deduction_amount: string;
  notes: string;
  settlement_number?: string | null;
  settlement_pdf_url?: string | null;
  updated_at?: string;
};

type ApiInspection = Omit<InspectionState, "deduction_amount"> & {
  deduction_amount: number | string;
};

const defaultInspection: InspectionState = {
  fuel_not_full: false,
  interior_dirty: false,
  exterior_dirty: false,
  new_damage: false,
  missing_accessories: false,
  late_return: false,
  deduction_amount: "",
  notes: "",
};

const issueOptions: Array<{
  key: keyof Pick<
    InspectionState,
    | "fuel_not_full"
    | "interior_dirty"
    | "exterior_dirty"
    | "new_damage"
    | "missing_accessories"
    | "late_return"
  >;
  label: string;
}> = [
  { key: "fuel_not_full", label: "fuelNotFull" },
  { key: "interior_dirty", label: "interiorDirty" },
  { key: "exterior_dirty", label: "exteriorDirty" },
  { key: "new_damage", label: "newDamage" },
  { key: "missing_accessories", label: "missingAccessories" },
  { key: "late_return", label: "lateReturn" },
];

function normalizeInspection(inspection: ApiInspection): InspectionState {
  return {
    ...defaultInspection,
    ...inspection,
    deduction_amount: String(inspection.deduction_amount ?? ""),
    notes: inspection.notes || "",
  };
}

export default function ReturnInspection({
  bookingId,
  depositAmount,
  copy,
}: Props) {
  const [inspection, setInspection] =
    useState<InspectionState>(defaultInspection);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);

  useEffect(() => {
    async function loadInspection() {
      setLoading(true);
      setMessage("");

      try {
        const response = await fetch(
          `/api/admin/bookings/${bookingId}/return-inspection`
        );
        const result = await response.json();

        if (!response.ok) {
          setMessage(result.error || copy.failedLoadInspection);
          return;
        }

        if (result.inspection) {
          setInspection(normalizeInspection(result.inspection as ApiInspection));
        }
      } catch {
        setMessage(copy.networkLoadInspection);
      } finally {
        setLoading(false);
      }
    }

    loadInspection();
  }, [bookingId, copy.failedLoadInspection, copy.networkLoadInspection]);

  const deduction = useMemo(() => {
    const value = Number(inspection.deduction_amount || 0);

    if (!Number.isFinite(value)) return 0;
    return Math.min(Math.max(value, 0), depositAmount);
  }, [depositAmount, inspection.deduction_amount]);

  const remainingDeposit = depositAmount - deduction;

  function updateIssue(key: (typeof issueOptions)[number]["key"]) {
    setInspection((current) => ({
      ...current,
      [key]: !current[key],
    }));
  }

  async function saveInspection() {
    setMessage("");
    setSaving(true);

    try {
      const photoUrls: string[] = [];

      for (const file of photoFiles) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("kind", "inspection-photo");
        formData.append("bookingId", bookingId);

        const uploadResponse = await fetch("/api/uploads", {
          method: "POST",
          body: formData,
        });
        const uploadResult = await uploadResponse.json();

        if (!uploadResponse.ok) {
          throw new Error(uploadResult.error || "Photo upload failed.");
        }

        photoUrls.push(uploadResult.url);
      }

      const notesWithPhotos =
        photoUrls.length > 0
          ? `${inspection.notes}\n\nPhoto evidence:\n${photoUrls.join("\n")}`.trim()
          : inspection.notes;

      const response = await fetch(
        `/api/admin/bookings/${bookingId}/return-inspection`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            ...inspection,
            deduction_amount: deduction,
            deposit_amount: depositAmount,
            returned_deposit_amount: remainingDeposit,
            notes: notesWithPhotos,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        setMessage(result.error || copy.failedSaveInspection);
        return;
      }

      setInspection(
        normalizeInspection(result.inspection as ApiInspection)
      );
      setPhotoFiles([]);
      setMessage(copy.savedEmailAttempted);
    } catch {
      setMessage(copy.networkSaveInspection);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold">{copy.returnInspection}</h3>
          <p className="mt-1 text-sm text-gray-400">
            {copy.returnInspectionHelp}
          </p>
        </div>

        {inspection.updated_at && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-green-800 bg-green-900/40 px-3 py-1 text-xs font-semibold text-green-300">
              {copy.saved}: {new Date(inspection.updated_at).toLocaleString()}
            </span>
            {inspection.settlement_pdf_url && (
              <a
                href={inspection.settlement_pdf_url}
                target="_blank"
                rel="noreferrer"
                className="rounded-full border border-zinc-700 bg-white px-3 py-1 text-xs font-semibold text-black"
              >
                {copy.openSettlementPdf}
                {inspection.settlement_number
                  ? ` (${inspection.settlement_number})`
                  : ""}
              </a>
            )}
          </div>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-gray-400">{copy.loadingReturnInspection}</p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_0.75fr]">
          <div className="space-y-3">
            {issueOptions.map((option) => (
              <label
                key={option.key}
                className="flex items-center gap-3 rounded-lg border border-zinc-800 bg-black p-3 text-sm text-gray-200"
              >
                <input
                  type="checkbox"
                  checked={Boolean(inspection[option.key])}
                  onChange={() => updateIssue(option.key)}
                  className="h-4 w-4 accent-white"
                />
                {copy[option.label as keyof typeof copy]}
              </label>
            ))}

            <label className="block">
              <span className="mb-2 block text-sm text-gray-300">
                {copy.inspectionNotes}
              </span>
              <textarea
                value={inspection.notes}
                onChange={(event) =>
                  setInspection((current) => ({
                    ...current,
                    notes: event.target.value,
                  }))
                }
                rows={4}
                placeholder={copy.inspectionPlaceholder}
                className="w-full rounded-lg border border-zinc-800 bg-black p-3 text-sm text-white focus:border-white focus:outline-none"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm text-gray-300">
                {copy.photoEvidence}
              </span>
              <input
                type="file"
                multiple
                accept="image/*"
                onChange={(event) =>
                  setPhotoFiles(Array.from(event.target.files || []))
                }
                className="w-full rounded-lg border border-zinc-800 bg-black p-3 text-sm text-white focus:border-white focus:outline-none"
              />
            </label>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-black p-4">
            <label className="block">
              <span className="mb-2 block text-sm text-gray-300">
                {copy.deductedAmount}
              </span>
              <input
                type="number"
                min="0"
                max={depositAmount}
                value={inspection.deduction_amount}
                onChange={(event) =>
                  setInspection((current) => ({
                    ...current,
                    deduction_amount: event.target.value,
                  }))
                }
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950 p-3 text-white focus:border-white focus:outline-none"
              />
            </label>

            <div className="mt-5 space-y-2 text-sm">
              <p className="flex justify-between gap-4">
                <span className="text-gray-400">{copy.initialDeposit}</span>
                <span>EUR {depositAmount}</span>
              </p>
              <p className="flex justify-between gap-4">
                <span className="text-gray-400">{copy.deduction}</span>
                <span className="text-red-300">EUR {deduction}</span>
              </p>
              <p className="flex justify-between gap-4 border-t border-zinc-800 pt-3 text-base font-semibold">
                <span>{copy.depositReturned}</span>
                <span className="text-green-300">EUR {remainingDeposit}</span>
              </p>
            </div>

            <button
              type="button"
              onClick={saveInspection}
              disabled={saving}
              className="mt-6 w-full rounded-lg bg-white px-4 py-2 font-semibold text-black hover:bg-gray-200 disabled:opacity-50"
            >
              {saving ? copy.saving : copy.saveInspection}
            </button>

            {message && (
              <p
                className={`mt-4 text-sm ${
                  message === copy.savedEmailAttempted ? "text-green-400" : "text-red-400"
                }`}
              >
                {message}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
