import { NextResponse } from "next/server";
import { serverSupabase } from "@/app/lib/server-supabase";
import { applyBookingAccessCookie, createBookingAccessToken } from "@/app/lib/booking-auth";
import { logAuditEvent } from "@/app/lib/audit";
import {
  enforceRateLimit,
  getClientIp,
  isValidEmail,
  normalizeEmail,
  sameOriginRequest,
  sanitizeText,
} from "@/app/lib/security";

export async function POST(req: Request) {
  if (!sameOriginRequest(req)) {
    return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
  }

  const ip = getClientIp(req);
  const rateLimit = enforceRateLimit(`booking-lookup:${ip}`, {
    limit: 8,
    windowMs: 15 * 60 * 1000,
    blockMs: 15 * 60 * 1000,
  });

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many attempts. Please try again later." },
      { status: 429 }
    );
  }

  const body = (await req.json()) as { bookingId?: string; email?: string };
  const bookingId = sanitizeText(body.bookingId, 80);
  const email = normalizeEmail(body.email);

  if (!bookingId || !email || !isValidEmail(email)) {
    return NextResponse.json({ error: "Missing booking details." }, { status: 400 });
  }

  const { data, error } = await serverSupabase
    .from("bookings")
    .select("id, customer_email")
    .eq("id", bookingId)
    .ilike("customer_email", email)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    await logAuditEvent({
      action: "booking_lookup_failed",
      actorRole: "anonymous",
      actorIdentifier: email,
      targetType: "booking",
      targetId: bookingId,
      status: "failure",
      details: "Booking lookup failed.",
      req,
    });
    return NextResponse.json({ error: "Booking not found." }, { status: 404 });
  }

  const response = NextResponse.json({ bookingId: data.id });
  applyBookingAccessCookie(response, createBookingAccessToken(data.id, email));
  await logAuditEvent({
    action: "booking_lookup_success",
    actorRole: "user",
    actorIdentifier: email,
    targetType: "booking",
    targetId: data.id,
    status: "success",
    details: "Booking access cookie issued after successful lookup.",
    req,
  });

  return response;
}
