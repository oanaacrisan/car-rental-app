import { NextResponse } from "next/server";
import { serverSupabase } from "@/app/lib/server-supabase";
import { sendDepositDeductionEmail } from "@/app/lib/email";
import { isAdminRequest } from "@/app/lib/admin-auth";
import { createSettlementPdf } from "@/app/lib/settlement-pdf";
import { logAuditEvent } from "@/app/lib/audit";
import { enforceRateLimit, getClientIp, sameOriginRequest, sanitizeMultilineText } from "@/app/lib/security";

const reasonLabels = {
  fuel_not_full: "Fuel tank was not full",
  interior_dirty: "Interior was not returned clean",
  exterior_dirty: "Exterior was not returned clean",
  new_damage: "New damage found after return",
  missing_accessories: "Missing accessories or documents",
  late_return: "Vehicle was returned late",
} as const;

function createSettlementNumber(bookingId: string) {
  const year = new Date().getFullYear();
  return `SET-${year}-${bookingId.slice(0, 8).toUpperCase()}`;
}

type InspectionPayload = {
  fuel_not_full?: boolean;
  interior_dirty?: boolean;
  exterior_dirty?: boolean;
  new_damage?: boolean;
  missing_accessories?: boolean;
  late_return?: boolean;
  deduction_amount?: number;
  deposit_amount?: number;
  returned_deposit_amount?: number;
  notes?: string;
};

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const limit = enforceRateLimit(`admin-return-inspection-read:${getClientIp(req)}`, {
    limit: 40,
    windowMs: 15 * 60 * 1000,
  });
  if (!limit.allowed) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  }
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await serverSupabase
    .from("return_inspections")
    .select("*")
    .eq("booking_id", id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ inspection: data });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!sameOriginRequest(req)) {
    return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
  }
  const limit = enforceRateLimit(`admin-return-inspection-write:${getClientIp(req)}`, {
    limit: 20,
    windowMs: 15 * 60 * 1000,
  });
  if (!limit.allowed) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  }
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as InspectionPayload;

  const { data: booking, error: bookingError } = await serverSupabase
    .from("bookings")
    .select(
      "id, car_id, first_name, last_name, customer_email, pickup_date, pickup_time, return_date, return_time, rental_price, deposit_amount, insurance_plan_name, insurance_total"
    )
    .eq("id", id)
    .single();

  if (bookingError || !booking) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }

  const depositAmount = Number(body.deposit_amount ?? booking.deposit_amount ?? 0);
  const deductionAmount = Math.min(
    Math.max(Number(body.deduction_amount ?? 0), 0),
    depositAmount
  );
  const returnedDepositAmount = depositAmount - deductionAmount;

  const inspectionData = {
    booking_id: id,
    car_id: booking.car_id,
    fuel_not_full: Boolean(body.fuel_not_full),
    interior_dirty: Boolean(body.interior_dirty),
    exterior_dirty: Boolean(body.exterior_dirty),
    new_damage: Boolean(body.new_damage),
    missing_accessories: Boolean(body.missing_accessories),
    late_return: Boolean(body.late_return),
    deduction_amount: deductionAmount,
    deposit_amount: depositAmount,
    returned_deposit_amount: returnedDepositAmount,
    notes: sanitizeMultilineText(body.notes, 2000) || null,
  };

  const { data: car } = await serverSupabase
    .from("cars")
    .select("brand, model")
    .eq("id", booking.car_id)
    .single();

  const reasons = Object.entries(reasonLabels)
    .filter(([keyName]) => Boolean(inspectionData[keyName as keyof typeof reasonLabels]))
    .map(([, label]) => label);

  const carName = car ? `${car.brand} ${car.model}` : "your car";
  const settlementNumber = createSettlementNumber(id);
  const settlementPdf = createSettlementPdf({
    companyName: process.env.RESEND_FROM_NAME || "Nurburgring Car Rentals",
    settlementNumber,
    bookingId: id,
    customerName: `${booking.first_name || ""} ${booking.last_name || ""}`.trim(),
    carName,
    pickup: `${booking.pickup_date} ${booking.pickup_time}`,
    returnInfo: `${booking.return_date} ${booking.return_time}`,
    rentalPrice: Number(booking.rental_price || 0),
    insurancePlanName: booking.insurance_plan_name,
    insuranceTotal: Number(booking.insurance_total || 0),
    depositAmount,
    deductionAmount,
    returnedDepositAmount,
    reasons,
    notes: inspectionData.notes,
  });

  const settlementFileName = `${id}/${settlementNumber}.pdf`;
  const { error: pdfUploadError } = await serverSupabase.storage
    .from("settlement-documents")
    .upload(settlementFileName, settlementPdf, {
      contentType: "application/pdf",
      upsert: true,
    });

  if (pdfUploadError) {
    console.error("SETTLEMENT PDF UPLOAD ERROR:", pdfUploadError);
  }

  const { data: settlementUrlData } = serverSupabase.storage
    .from("settlement-documents")
    .getPublicUrl(settlementFileName);

  const { data: inspection, error } = await serverSupabase
    .from("return_inspections")
    .upsert(
      {
        ...inspectionData,
        settlement_number: settlementNumber,
        settlement_pdf_url: pdfUploadError ? null : settlementUrlData.publicUrl,
      },
      { onConflict: "booking_id" }
    )
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (booking.customer_email) {
    try {
      await sendDepositDeductionEmail({
        to: booking.customer_email,
        firstName: booking.first_name || "there",
        carName,
        depositAmount,
        deductionAmount,
        returnedDepositAmount,
        reasons,
        notes: inspectionData.notes || undefined,
        settlementPdf,
      });
    } catch (emailError) {
      console.error("DEPOSIT DEDUCTION EMAIL ERROR:", emailError);
    }
  }

  await logAuditEvent({
    action: "admin_return_inspection_saved",
    actorRole: "admin",
    actorIdentifier: "admin",
    targetType: "booking",
    targetId: id,
    status: "success",
    details: `Return inspection saved. Deduction amount: ${deductionAmount}.`,
    req,
  });

  return NextResponse.json({ success: true, inspection });
}
