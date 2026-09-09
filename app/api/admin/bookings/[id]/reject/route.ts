import { NextResponse } from "next/server";
import { serverSupabase } from "@/app/lib/server-supabase";
import { sendRejectedBookingEmail } from "@/app/lib/email";
import { isAdminRequest } from "@/app/lib/admin-auth";
import { logAuditEvent } from "@/app/lib/audit";
import { enforceRateLimit, getClientIp, sameOriginRequest, sanitizeText } from "@/app/lib/security";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!sameOriginRequest(req)) {
    return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
  }
  const limit = enforceRateLimit(`admin-reject:${getClientIp(req)}`, {
    limit: 20,
    windowMs: 15 * 60 * 1000,
  });
  if (!limit.allowed) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  }
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await req.formData();
  const reason = sanitizeText(formData.get("reason"), 120);

  if (!reason) {
    return NextResponse.json(
      { error: "Rejection reason is required." },
      { status: 400 }
    );
  }

  const { data: booking, error: bookingError } = await serverSupabase
    .from("bookings")
    .select("first_name, customer_email, car_id")
    .eq("id", id)
    .single();

  if (bookingError || !booking) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }

  const { error } = await serverSupabase
    .from("bookings")
    .update({
      booking_status: "REJECTED",
      status: "REJECTED",
      rejection_reason: reason,
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
      await sendRejectedBookingEmail({
        to: booking.customer_email,
        firstName: booking.first_name || "there",
        carName,
        bookingId: id,
        reason,
      });
    } catch (emailError) {
      console.error("REJECTION EMAIL ERROR:", emailError);
    }
  }

  await logAuditEvent({
    action: "admin_booking_rejected",
    actorRole: "admin",
    actorIdentifier: "admin",
    targetType: "booking",
    targetId: id,
    status: "success",
    details: `Booking rejected with reason: ${reason}`,
    req,
  });

  return NextResponse.json({ success: true });
}
