import { cookies } from "next/headers";
import { BOOKING_ACCESS_COOKIE, createSignedToken, makeExpiringTimestamp, verifySignedToken } from "./security";

type BookingAccessPayload = {
  role: "booking_viewer";
  bookingId: string;
  email: string;
  exp: number;
};

function isProduction() {
  return process.env.NODE_ENV === "production";
}

export function createBookingAccessToken(bookingId: string, email: string) {
  return createSignedToken({
    role: "booking_viewer",
    bookingId,
    email,
    exp: makeExpiringTimestamp(24),
  } satisfies BookingAccessPayload);
}

export function verifyBookingAccessToken(token?: string | null) {
  return verifySignedToken<BookingAccessPayload>(token);
}

export async function getBookingAccessSession() {
  const cookieStore = await cookies();
  return verifyBookingAccessToken(cookieStore.get(BOOKING_ACCESS_COOKIE)?.value);
}

export function applyBookingAccessCookie(response: Response, token: string) {
  const nextResponse = response as Response & {
    cookies?: {
      set: (options: {
        name: string;
        value: string;
        httpOnly: boolean;
        sameSite: "strict";
        secure: boolean;
        path: string;
        maxAge: number;
      }) => void;
    };
  };

  nextResponse.cookies?.set({
    name: BOOKING_ACCESS_COOKIE,
    value: token,
    httpOnly: true,
    sameSite: "strict",
    secure: isProduction(),
    path: "/",
    maxAge: 60 * 60 * 24,
  });
}
