import { Resend } from "resend";
import { createBookingAccessToken } from "./booking-auth";

function getResend() {
  if (!process.env.RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY is not configured.");
  }

  return new Resend(process.env.RESEND_API_KEY);
}

function getFromAddress() {
  const email = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";
  const name = process.env.RESEND_FROM_NAME || "Car Rental";

  return `${name} <${email}>`;
}

function getBookingUrl(bookingId: string, email?: string) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const token = email ? createBookingAccessToken(bookingId, email) : "";
  const tokenQuery = token ? `?token=${encodeURIComponent(token)}` : "";

  return `${siteUrl.replace(/\/$/, "")}/booking/${bookingId}${tokenQuery}`;
}

export async function sendPendingBookingEmail({
  to,
  firstName,
  carName,
  bookingId,
  insurancePlanName,
  insurancePricePerDay,
  insuranceDeductible,
  pickupDate,
  pickupTime,
  returnDate,
  returnTime,
}: {
  to: string;
  firstName: string;
  carName: string;
  bookingId: string;
  insurancePlanName?: string;
  insurancePricePerDay?: number;
  insuranceDeductible?: number;
  pickupDate: string;
  pickupTime: string;
  returnDate: string;
  returnTime: string;
}) {
  const bookingUrl = getBookingUrl(bookingId, to);

  return getResend().emails.send({
    from: getFromAddress(),
    to,
    subject: "Your booking request was received",
    html: `
      <h2>Hello ${firstName},</h2>
      <p>Your booking request for <strong>${carName}</strong> was received successfully.</p>
      <p>Status: <strong>PENDING</strong></p>
      <p><strong>Booking ID:</strong> ${bookingId}</p>
      ${
        insurancePlanName
          ? `<p><strong>Insurance:</strong> ${insurancePlanName} - EUR ${insurancePricePerDay}/day, deductible EUR ${insuranceDeductible}</p>`
          : ""
      }
      <p><strong>Pickup:</strong> ${pickupDate} at ${pickupTime}</p>
      <p><strong>Return:</strong> ${returnDate} at ${returnTime}</p>
      <p><a href="${bookingUrl}">View your booking status</a></p>
      <p>We will review your documents and send you a confirmation or rejection by email.</p>
    `,
  });
}

export async function sendConfirmedBookingEmail({
  to,
  firstName,
  carName,
  bookingId,
  insurancePlanName,
  insuranceDeductible,
}: {
  to: string;
  firstName: string;
  carName: string;
  bookingId: string;
  insurancePlanName?: string | null;
  insuranceDeductible?: number | null;
}) {
  const bookingUrl = getBookingUrl(bookingId, to);

  return getResend().emails.send({
    from: getFromAddress(),
    to,
    subject: "Your booking was confirmed",
    html: `
      <h2>Hello ${firstName},</h2>
      <p>Your booking for <strong>${carName}</strong> has been <strong>CONFIRMED</strong>.</p>
      <p><strong>Booking ID:</strong> ${bookingId}</p>
      ${
        insurancePlanName
          ? `<p><strong>Insurance:</strong> ${insurancePlanName}, deductible EUR ${insuranceDeductible}</p>`
          : ""
      }
      <p><a href="${bookingUrl}">View your booking details</a></p>
      <p>We look forward to welcoming you.</p>
    `,
  });
}

export async function sendRejectedBookingEmail({
  to,
  firstName,
  carName,
  bookingId,
  reason,
}: {
  to: string;
  firstName: string;
  carName: string;
  bookingId: string;
  reason: string;
}) {
  const bookingUrl = getBookingUrl(bookingId, to);

  return getResend().emails.send({
    from: getFromAddress(),
    to,
    subject: "Your booking was rejected",
    html: `
      <h2>Hello ${firstName},</h2>
      <p>Your booking for <strong>${carName}</strong> has been <strong>REJECTED</strong>.</p>
      <p><strong>Booking ID:</strong> ${bookingId}</p>
      <p><strong>Reason:</strong> ${reason}</p>
      <p><a href="${bookingUrl}">View your booking details</a></p>
      <p>If needed, you can submit a new request with updated information.</p>
    `,
  });
}

export async function sendDepositDeductionEmail({
  to,
  firstName,
  carName,
  depositAmount,
  deductionAmount,
  returnedDepositAmount,
  reasons,
  notes,
  settlementPdf,
}: {
  to: string;
  firstName: string;
  carName: string;
  depositAmount: number;
  deductionAmount: number;
  returnedDepositAmount: number;
  reasons: string[];
  notes?: string;
  settlementPdf?: Buffer;
}) {
  const reasonsHtml =
    reasons.length > 0
      ? `<ul>${reasons.map((reason) => `<li>${reason}</li>`).join("")}</ul>`
      : "<p>No return issues were selected.</p>";

  return getResend().emails.send({
    from: getFromAddress(),
    to,
    subject: "Final rental settlement",
    html: `
      <h2>Hello ${firstName},</h2>
      <p>The return inspection for <strong>${carName}</strong> has been completed.</p>
      <p><strong>Initial deposit:</strong> EUR ${depositAmount}</p>
      <p><strong>Deducted amount:</strong> EUR ${deductionAmount}</p>
      <p><strong>Deposit returned:</strong> EUR ${returnedDepositAmount}</p>
      <h3>Reasons</h3>
      ${reasonsHtml}
      ${notes ? `<p><strong>Inspection notes:</strong> ${notes}</p>` : ""}
      <p>The final settlement PDF is attached to this email.</p>
      <p>If you have questions, please contact our rental team.</p>
    `,
    attachments: settlementPdf
      ? [
          {
            filename: "final-rental-settlement.pdf",
            content: settlementPdf.toString("base64"),
          },
        ]
      : undefined,
  });
}
