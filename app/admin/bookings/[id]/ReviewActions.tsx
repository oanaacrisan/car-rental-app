"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { AdminCopy } from "../../../lib/i18n";

type Props = {
  bookingId: string;
  status: string | null;
  initialInternalNotes: string;
  copy: AdminCopy;
};

export default function ReviewActions({
  bookingId,
  status,
  initialInternalNotes,
  copy,
}: Props) {
  const router = useRouter();

  const [reason, setReason] = useState("");
  const [internalNotes, setInternalNotes] = useState(initialInternalNotes);
  const [loading, setLoading] = useState<
    "confirm" | "reject" | "complete" | "cancel" | "notes" | null
  >(null);
  const [message, setMessage] = useState("");

  async function postAction(action: "confirm" | "complete" | "cancel") {
    setMessage("");
    setLoading(action);

    try {
      const response = await fetch(
        `/api/admin/bookings/${bookingId}/${action}`,
        {
          method: "POST",
        }
      );

      const result = await response.json();

      if (!response.ok) {
        setMessage(result.error || copy.failedAction);
        return;
      }

      setMessage("");
      router.refresh();
    } catch {
      setMessage(copy.networkAction);
    } finally {
      setLoading(null);
    }
  }

  async function handleReject() {
    setMessage("");

    if (!reason) {
      setMessage(copy.selectRejectionReason);
      return;
    }

    setLoading("reject");

    try {
      const formData = new FormData();
      formData.append("reason", reason);

      const response = await fetch(
        `/api/admin/bookings/${bookingId}/reject`,
        {
          method: "POST",
          body: formData,
        }
      );

      const result = await response.json();

      if (!response.ok) {
        setMessage(result.error || copy.failedRejectBooking);
        return;
      }

      setReason("");
      setMessage("");
      router.refresh();
    } catch {
      setMessage(copy.networkReject);
    } finally {
      setLoading(null);
    }
  }

  async function saveInternalNotes() {
    setMessage("");
    setLoading("notes");

    try {
      const response = await fetch(`/api/admin/bookings/${bookingId}/notes`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ internal_notes: internalNotes }),
      });

      const result = await response.json();

      if (!response.ok) {
        setMessage(result.error || copy.failedAction);
        return;
      }

      setMessage(copy.internalNotesSaved);
      router.refresh();
    } catch {
      setMessage(copy.networkAction);
    } finally {
      setLoading(null);
    }
  }

  const canConfirm = status === "PENDING" || status === null;
  const canReject = status === "PENDING" || status === null;
  const canComplete = status === "CONFIRMED";
  const canCancel = status === "PENDING" || status === "CONFIRMED";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap gap-3">
        {canConfirm && (
          <button
            type="button"
            onClick={() => postAction("confirm")}
            disabled={loading !== null}
            className="bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded-lg font-semibold disabled:opacity-50"
          >
            {loading === "confirm" ? copy.confirming : copy.confirmBooking}
          </button>
        )}

        {canComplete && (
          <button
            type="button"
            onClick={() => postAction("complete")}
            disabled={loading !== null}
            className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg font-semibold disabled:opacity-50"
          >
            {loading === "complete" ? copy.saving : copy.markCompleted}
          </button>
        )}

        {canCancel && (
          <button
            type="button"
            onClick={() => postAction("cancel")}
            disabled={loading !== null}
            className="bg-zinc-700 hover:bg-zinc-600 text-white px-4 py-2 rounded-lg font-semibold disabled:opacity-50"
          >
            {loading === "cancel" ? copy.saving : copy.cancelBooking}
          </button>
        )}
      </div>

      {canReject && (
        <div className="flex flex-col gap-3 max-w-md">
          <select
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full p-3 rounded-xl bg-black border border-gray-700 text-white"
            disabled={loading !== null}
          >
            <option value="">{copy.selectRejectionReason}</option>
            <option value="MINIMUM_AGE_NOT_MET">{copy.minimumAgeNotMet}</option>
            <option value="INSUFFICIENT_LICENSE_EXPERIENCE">
              {copy.insufficientLicenseExperience}
            </option>
            <option value="DOCUMENTS_INVALID_OR_UNREADABLE">
              {copy.documentsInvalid}
            </option>
          </select>

          <button
            type="button"
            onClick={handleReject}
            disabled={loading !== null}
            className="bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded-lg font-semibold disabled:opacity-50"
          >
            {loading === "reject" ? copy.rejecting : copy.rejectBooking}
          </button>
        </div>
      )}

      <div className="max-w-2xl">
        <label className="block">
          <span className="mb-2 block text-sm text-gray-300">
            {copy.internalNotes}
          </span>
          <textarea
            value={internalNotes}
            onChange={(event) => setInternalNotes(event.target.value)}
            rows={4}
            className="w-full rounded-xl border border-gray-700 bg-black p-3 text-white focus:border-white focus:outline-none"
            placeholder={copy.internalNotesPlaceholder}
          />
        </label>
        <button
          type="button"
          onClick={saveInternalNotes}
          disabled={loading !== null}
          className="mt-3 rounded-lg border border-zinc-700 px-4 py-2 font-semibold text-white hover:bg-zinc-800 disabled:opacity-50"
        >
          {loading === "notes" ? copy.saving : copy.saveInternalNotes}
        </button>
      </div>

      {message && (
        <p
          className={`text-sm ${
            message === copy.internalNotesSaved ? "text-green-400" : "text-red-400"
          }`}
        >
          {message}
        </p>
      )}
    </div>
  );
}
