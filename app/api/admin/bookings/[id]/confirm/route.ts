import { NextResponse } from "next/server";
import { serverSupabase } from "@/app/lib/server-supabase";
import { sendConfirmedBookingEmail } from "@/app/lib/email";
import { isAdminRequest } from "@/app/lib/admin-auth";
import { logAuditEvent } from "@/app/lib/audit";
import { enforceRateLimit, getClientIp, sameOriginRequest } from "@/app/lib/security";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!sameOriginRequest(req)) {
    return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
  }
  const limit = enforceRateLimit(`admin-confirm:${getClientIp(req)}`, {
    limit: 20,
    windowMs: 15 * 60 * 1000,
  });
  if (!limit.allowed) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  }
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: booking, error: bookingError } = await serverSupabase
    .from("bookings")
    .select("first_name, customer_email, car_id, insurance_plan_name, insurance_deductible")
    .eq("id", id)
    .single();

  if (bookingError || !booking) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }

  const { error } = await serverSupabase
    .from("bookings")
    .update({
      booking_status: "CONFIRMED",
      status: "CONFIRMED",
      rejection_reason: null,
    })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { data: car } = await serverSupabase
    .from("cars")
    .select("brand, model")
    .eq("id", booking.car_id)
    .single();

  const carName = car ? `${car.brand} ${car.model}` : "your car";

  if (booking.customer_email) {
    try {
      await sendConfirmedBookingEmail({
        to: booking.customer_email,
        firstName: booking.first_name || "there",
        carName,
        bookingId: id,
        insurancePlanName: booking.insurance_plan_name,
        insuranceDeductible: booking.insurance_deductible,
      });
    } catch (emailError) {
      console.error("CONFIRMATION EMAIL ERROR:", emailError);
    }
  }

  await logAuditEvent({
    action: "admin_booking_confirmed",
    actorRole: "admin",
    actorIdentifier: "admin",
    targetType: "booking",
    targetId: id,
    status: "success",
    details: "Booking confirmed by admin.",
    req,
  });

  return NextResponse.json({ success: true });
}
