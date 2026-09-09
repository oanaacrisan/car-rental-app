import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  ADMIN_LOGIN_CHALLENGE_COOKIE,
  ADMIN_SESSION_COOKIE,
  createSignedToken,
  makeExpiringTimestamp,
  verifySignedToken,
} from "./security";

type AdminSessionPayload = {
  role: "admin";
  exp: number;
  factor: "password+2fa";
};

type AdminChallengePayload = {
  role: "admin_challenge";
  exp: number;
};

function isProduction() {
  return process.env.NODE_ENV === "production";
}

export function getAdminPassword() {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) {
    throw new Error("ADMIN_PASSWORD is not configured.");
  }
  return password;
}

export function getAdminTwoFactorCode() {
  const code = process.env.ADMIN_2FA_CODE;
  if (!code) {
    throw new Error("ADMIN_2FA_CODE is not configured.");
  }
  return code;
}

export function createAdminSessionToken() {
  return createSignedToken({
    role: "admin",
    factor: "password+2fa",
    exp: makeExpiringTimestamp(8),
  } satisfies AdminSessionPayload);
}

export function createAdminChallengeToken() {
  return createSignedToken({
    role: "admin_challenge",
    exp: makeExpiringTimestamp(0.25),
  } satisfies AdminChallengePayload);
}

export async function hasAdminSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;
  const payload = verifySignedToken<AdminSessionPayload>(token);
  return payload?.role === "admin" && payload.factor === "password+2fa";
}

export function isAdminRequest(req: Request) {
  const cookie = req.headers
    .get("cookie")
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${ADMIN_SESSION_COOKIE}=`))
    ?.split("=")[1];

  const payload = verifySignedToken<AdminSessionPayload>(cookie);
  return payload?.role === "admin" && payload.factor === "password+2fa";
}

export function hasAdminLoginChallenge(req: Request) {
  const cookie = req.headers
    .get("cookie")
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${ADMIN_LOGIN_CHALLENGE_COOKIE}=`))
    ?.split("=")[1];

  const payload = verifySignedToken<AdminChallengePayload>(cookie);
  return payload?.role === "admin_challenge";
}

export function applyAdminSessionCookie(response: NextResponse, token: string) {
  response.cookies.set({
    name: ADMIN_SESSION_COOKIE,
    value: token,
    httpOnly: true,
    sameSite: "strict",
    secure: isProduction(),
    path: "/",
    maxAge: 60 * 60 * 8,
  });
}

export function applyAdminChallengeCookie(response: NextResponse, token: string) {
  response.cookies.set({
    name: ADMIN_LOGIN_CHALLENGE_COOKIE,
    value: token,
    httpOnly: true,
    sameSite: "strict",
    secure: isProduction(),
    path: "/",
    maxAge: 60 * 15,
  });
}

export function clearAdminAuthCookies(response: NextResponse) {
  response.cookies.set({
    name: ADMIN_SESSION_COOKIE,
    value: "",
    httpOnly: true,
    sameSite: "strict",
    secure: isProduction(),
    path: "/",
    expires: new Date(0),
  });
  response.cookies.set({
    name: ADMIN_LOGIN_CHALLENGE_COOKIE,
    value: "",
    httpOnly: true,
    sameSite: "strict",
    secure: isProduction(),
    path: "/",
    expires: new Date(0),
  });
}
