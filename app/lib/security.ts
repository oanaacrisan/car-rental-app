import crypto from "crypto";

export const ADMIN_SESSION_COOKIE = "admin_session";
export const BOOKING_ACCESS_COOKIE = "booking_access";
export const ADMIN_LOGIN_CHALLENGE_COOKIE = "admin_login_challenge";

type RateLimitEntry = {
  count: number;
  resetAt: number;
  blockedUntil?: number;
};

type LoginAttemptEntry = {
  failures: number;
  captchaAnswer?: string;
  captchaQuestion?: string;
  blockedUntil?: number;
  lastFailureAt?: number;
};

const rateLimitStore = new Map<string, RateLimitEntry>();
const loginAttemptStore = new Map<string, LoginAttemptEntry>();

function now() {
  return Date.now();
}

function getSecuritySecret() {
  const secret = process.env.APP_SESSION_SECRET;
  if (!secret) {
    throw new Error("APP_SESSION_SECRET is not configured.");
  }
  return secret;
}

export function getClientIp(req: Request) {
  const forwardedFor = req.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || "unknown";
  }

  return req.headers.get("x-real-ip") || "unknown";
}

export function constantTimeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);

  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

export function hmacSign(value: string) {
  return crypto
    .createHmac("sha256", getSecuritySecret())
    .update(value)
    .digest("hex");
}

export function createSignedToken(payload: Record<string, unknown>) {
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = hmacSign(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

export function verifySignedToken<T>(token?: string | null): T | null {
  if (!token) return null;

  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature) return null;
  if (!constantTimeEqual(hmacSign(encodedPayload), signature)) return null;

  try {
    const payload = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf8")
    ) as T & { exp?: number };

    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

export function makeExpiringTimestamp(hoursFromNow: number) {
  return Math.floor(Date.now() / 1000) + hoursFromNow * 60 * 60;
}

export function sanitizeText(input: unknown, maxLength = 200) {
  return String(input ?? "")
    .replace(/[<>{}]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

export function sanitizeMultilineText(input: unknown, maxLength = 2000) {
  return String(input ?? "")
    .replace(/[<>]/g, "")
    .replace(/\r\n/g, "\n")
    .trim()
    .slice(0, maxLength);
}

export function normalizeEmail(input: unknown) {
  return String(input ?? "").trim().toLowerCase();
}

export function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function isValidPhone(phone: string) {
  return /^\+?[0-9\s-]{7,20}$/.test(phone);
}

export function isValidUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

export function isValidIsoDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function isValidTime(value: string) {
  return /^\d{2}:\d{2}$/.test(value);
}

export function sameOriginRequest(req: Request) {
  const origin = req.headers.get("origin");
  if (!origin) return true;

  try {
    const requestUrl = new URL(req.url);
    const originUrl = new URL(origin);
    return requestUrl.origin === originUrl.origin;
  } catch {
    return false;
  }
}

export function enforceRateLimit(
  key: string,
  options: { limit: number; windowMs: number; blockMs?: number }
) {
  const currentTime = now();
  const existing = rateLimitStore.get(key);

  if (!existing || existing.resetAt <= currentTime) {
    rateLimitStore.set(key, {
      count: 1,
      resetAt: currentTime + options.windowMs,
    });
    return { allowed: true, retryAfterMs: 0 };
  }

  if (existing.blockedUntil && existing.blockedUntil > currentTime) {
    return {
      allowed: false,
      retryAfterMs: existing.blockedUntil - currentTime,
    };
  }

  existing.count += 1;

  if (existing.count > options.limit) {
    if (options.blockMs) {
      existing.blockedUntil = currentTime + options.blockMs;
    }

    return {
      allowed: false,
      retryAfterMs: (existing.blockedUntil || existing.resetAt) - currentTime,
    };
  }

  rateLimitStore.set(key, existing);
  return { allowed: true, retryAfterMs: 0 };
}

function createCaptcha() {
  const left = Math.floor(Math.random() * 8) + 1;
  const right = Math.floor(Math.random() * 8) + 1;
  return {
    question: `${left} + ${right}`,
    answer: String(left + right),
  };
}

export function getLoginProtectionState(key: string) {
  const entry = loginAttemptStore.get(key);
  const currentTime = now();

  if (!entry) {
    return {
      blockedUntil: 0,
      captchaRequired: false,
      captchaQuestion: "",
    };
  }

  return {
    blockedUntil:
      entry.blockedUntil && entry.blockedUntil > currentTime ? entry.blockedUntil : 0,
    captchaRequired: entry.failures >= 3,
    captchaQuestion: entry.captchaQuestion || "",
  };
}

export function registerFailedLoginAttempt(key: string) {
  const currentTime = now();
  const existing = loginAttemptStore.get(key) || { failures: 0 };
  existing.failures += 1;
  existing.lastFailureAt = currentTime;

  if (existing.failures >= 3) {
    const captcha = createCaptcha();
    existing.captchaAnswer = captcha.answer;
    existing.captchaQuestion = captcha.question;
  }

  if (existing.failures >= 5) {
    existing.blockedUntil = currentTime + 15 * 60 * 1000;
  }

  loginAttemptStore.set(key, existing);
  return existing;
}

export function resetLoginProtection(key: string) {
  loginAttemptStore.delete(key);
}

export function validateCaptcha(key: string, answer: string) {
  const entry = loginAttemptStore.get(key);
  if (!entry || !entry.captchaAnswer) return true;
  return constantTimeEqual(entry.captchaAnswer, String(answer).trim());
}

export function getSafeFileExtension(fileName: string) {
  const extension = fileName.split(".").pop()?.toLowerCase() || "";
  return extension.replace(/[^a-z0-9]/g, "");
}

export function createSafeStorageFileName(prefix: string, extension: string) {
  return `${prefix}/${crypto.randomUUID()}.${extension}`;
}

export function isAllowedImageMimeType(mimeType: string) {
  return ["image/jpeg", "image/png", "image/webp"].includes(mimeType);
}

export function isAllowedImageExtension(extension: string) {
  return ["jpg", "jpeg", "png", "webp"].includes(extension);
}
