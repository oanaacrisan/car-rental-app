import { NextResponse } from "next/server";
import { clearAdminAuthCookies } from "@/app/lib/admin-auth";
import { logAuditEvent } from "@/app/lib/audit";

export async function POST(req: Request) {
  await logAuditEvent({
    action: "admin_logout",
    actorRole: "admin",
    actorIdentifier: "admin",
    status: "success",
    details: "Admin session was invalidated.",
    req,
  });

  const response = NextResponse.json({ success: true });
  clearAdminAuthCookies(response);
  return response;
}
