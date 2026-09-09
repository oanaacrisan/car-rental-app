import { NextResponse } from "next/server";
import { serverSupabase } from "@/app/lib/server-supabase";
import { isAdminRequest } from "@/app/lib/admin-auth";
import { logAuditEvent } from "@/app/lib/audit";
import { enforceRateLimit, getClientIp, sameOriginRequest, sanitizeMultilineText } from "@/app/lib/security";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!sameOriginRequest(req)) {
    return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
  }
  const limit = enforceRateLimit(`admin-notes:${getClientIp(req)}`, {
    limit: 25,
    windowMs: 15 * 60 * 1000,
  });
  if (!limit.allowed) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  }

  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as { internal_notes?: string };
  const internalNotes = sanitizeMultilineText(body.internal_notes, 1500) || null;

  const { error } = await serverSupabase
    .from("bookings")
    .update({
      internal_notes: internalNotes,
    })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await logAuditEvent({
    action: "admin_booking_notes_updated",
    actorRole: "admin",
    actorIdentifier: "admin",
    targetType: "booking",
    targetId: id,
    status: "success",
    details: "Internal booking notes updated.",
    req,
  });

  return NextResponse.json({ success: true });
}
