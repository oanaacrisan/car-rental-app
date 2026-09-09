import { NextResponse } from "next/server";
import {
  applyAdminChallengeCookie,
  applyAdminSessionCookie,
  clearAdminAuthCookies,
  createAdminChallengeToken,
  createAdminSessionToken,
  getAdminPassword,
  getAdminTwoFactorCode,
  hasAdminLoginChallenge,
} from "@/app/lib/admin-auth";
import { logAuditEvent } from "@/app/lib/audit";
import {
  constantTimeEqual,
  enforceRateLimit,
  getClientIp,
  getLoginProtectionState,
  registerFailedLoginAttempt,
  resetLoginProtection,
  sameOriginRequest,
  sanitizeText,
  validateCaptcha,
} from "@/app/lib/security";

export async function POST(req: Request) {
  if (!sameOriginRequest(req)) {
    return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
  }

  const ip = getClientIp(req);
  const rateLimit = enforceRateLimit(`admin-login:${ip}`, {
    limit: 10,
    windowMs: 15 * 60 * 1000,
    blockMs: 15 * 60 * 1000,
  });

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many login attempts. Please try again later." },
      { status: 429 }
    );
  }

  const body = (await req.json().catch(() => ({}))) as {
    password?: string;
    secondFactorCode?: string;
    captchaAnswer?: string;
  };

  const key = `admin:${ip}`;
  const protectionState = getLoginProtectionState(key);

  if (protectionState.blockedUntil) {
    await logAuditEvent({
      action: "admin_login_blocked",
      actorRole: "anonymous",
      status: "failure",
      details: "Login temporarily blocked after repeated failures.",
      req,
    });

    return NextResponse.json(
      { error: "Too many failed attempts. Login is temporarily blocked." },
      { status: 429 }
    );
  }

  if (
    protectionState.captchaRequired &&
    !validateCaptcha(key, String(body.captchaAnswer || ""))
  ) {
    return NextResponse.json(
      {
        error: "Captcha answer is required after repeated failed attempts.",
        captchaRequired: true,
        captchaQuestion: protectionState.captchaQuestion,
      },
      { status: 400 }
    );
  }

  const password = sanitizeText(body.password || "", 120);
  const secondFactorCode = sanitizeText(body.secondFactorCode || "", 20);

  if (!hasAdminLoginChallenge(req)) {
    if (!constantTimeEqual(password, getAdminPassword())) {
      const updatedState = registerFailedLoginAttempt(key);
      await logAuditEvent({
        action: "admin_login_failed",
        actorRole: "anonymous",
        status: "failure",
        details: "Invalid admin password.",
        req,
      });

      return NextResponse.json(
        {
          error: "Invalid admin credentials.",
          requiresSecondFactor: false,
          captchaRequired: updatedState.failures >= 3,
          captchaQuestion: updatedState.captchaQuestion || "",
        },
        { status: 401 }
      );
    }

    const response = NextResponse.json({
      success: true,
      requiresSecondFactor: true,
    });
    applyAdminChallengeCookie(response, createAdminChallengeToken());
    return response;
  }

  if (!constantTimeEqual(secondFactorCode, getAdminTwoFactorCode())) {
    const updatedState = registerFailedLoginAttempt(key);
    await logAuditEvent({
      action: "admin_2fa_failed",
      actorRole: "anonymous",
      status: "failure",
      details: "Invalid admin 2FA code.",
      req,
    });

    const response = NextResponse.json(
      {
        error: "Invalid 2FA code.",
        requiresSecondFactor: true,
        captchaRequired: updatedState.failures >= 3,
        captchaQuestion: updatedState.captchaQuestion || "",
      },
      { status: 401 }
    );
    clearAdminAuthCookies(response);
    return response;
  }

  resetLoginProtection(key);
  await logAuditEvent({
    action: "admin_login_success",
    actorRole: "admin",
    actorIdentifier: "admin",
    status: "success",
    details: "Admin login completed with password and 2FA.",
    req,
  });

  const response = NextResponse.json({ success: true, requiresSecondFactor: false });
  clearAdminAuthCookies(response);
  applyAdminSessionCookie(response, createAdminSessionToken());
  return response;
}
