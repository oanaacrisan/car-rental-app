import { serverSupabase } from "./server-supabase";
import { getClientIp, sanitizeMultilineText, sanitizeText } from "./security";

type AuditEvent = {
  action: string;
  actorRole: "admin" | "user" | "anonymous";
  actorIdentifier?: string | null;
  targetType?: string | null;
  targetId?: string | null;
  status: "success" | "failure";
  details?: string | null;
  req?: Request;
};

export async function logAuditEvent(event: AuditEvent) {
  const payload = {
    action: sanitizeText(event.action, 80),
    actor_role: event.actorRole,
    actor_identifier: sanitizeText(event.actorIdentifier || "", 120) || null,
    target_type: sanitizeText(event.targetType || "", 80) || null,
    target_id: sanitizeText(event.targetId || "", 120) || null,
    status: event.status,
    details: sanitizeMultilineText(event.details || "", 1500) || null,
    ip_address: event.req ? sanitizeText(getClientIp(event.req), 64) : null,
    user_agent: event.req
      ? sanitizeText(event.req.headers.get("user-agent") || "", 255) || null
      : null,
  };

  try {
    await serverSupabase.from("audit_logs").insert(payload);
  } catch (error) {
    console.error("AUDIT LOG ERROR:", error, payload);
  }
}
