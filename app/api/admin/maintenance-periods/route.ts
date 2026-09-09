import { NextResponse } from "next/server";
import { serverSupabase } from "@/app/lib/server-supabase";
import { isAdminRequest } from "@/app/lib/admin-auth";
import { logAuditEvent } from "@/app/lib/audit";
import {
  enforceRateLimit,
  getClientIp,
  isValidIsoDate,
  isValidUuid,
  sameOriginRequest,
  sanitizeText,
} from "@/app/lib/security";

export async function POST(req: Request) {
  if (!sameOriginRequest(req)) {
    return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
  }
  const limit = enforceRateLimit(`admin-maintenance-create:${getClientIp(req)}`, {
    limit: 20,
    windowMs: 15 * 60 * 1000,
  });
  if (!limit.allowed) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  }
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as {
    car_id?: string;
    start_date?: string;
    end_date?: string;
    reason?: string;
  };
  const carId = sanitizeText(body.car_id, 80);
  const startDate = sanitizeText(body.start_date, 20);
  const endDate = sanitizeText(body.end_date, 20);
  const reason = sanitizeText(body.reason, 200) || null;

  if (!carId || !startDate || !endDate) {
    return NextResponse.json(
      { error: "Car, start date and end date are required." },
      { status: 400 }
    );
  }

  if (!isValidUuid(carId) || !isValidIsoDate(startDate) || !isValidIsoDate(endDate)) {
    return NextResponse.json({ error: "Invalid maintenance payload." }, { status: 400 });
  }

  if (new Date(endDate) < new Date(startDate)) {
    return NextResponse.json(
      { error: "End date must be after start date." },
      { status: 400 }
    );
  }

  const { error } = await serverSupabase.from("maintenance_periods").insert({
    car_id: carId,
    start_date: startDate,
    end_date: endDate,
    reason,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await logAuditEvent({
    action: "admin_maintenance_created",
    actorRole: "admin",
    actorIdentifier: "admin",
    targetType: "car",
    targetId: carId,
    status: "success",
    details: `Maintenance period ${startDate} - ${endDate} created.`,
    req,
  });

  return NextResponse.json({ success: true });
}
