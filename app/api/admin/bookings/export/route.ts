import { NextResponse } from "next/server";
import { supabase } from "@/app/lib/supabase";
import { isAdminRequest } from "@/app/lib/admin-auth";

export async function GET(req: Request) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const status = url.searchParams.get("status") || "ALL";
  const q = (url.searchParams.get("q") || "").toLowerCase();

  let query = supabase
    .from("bookings")
    .select(
      "id, booking_status, first_name, last_name, customer_email, phone, pickup_date, pickup_time, return_date, return_time, rental_price, deposit_amount, insurance_plan_name, insurance_total"
    )
    .order("pickup_date", { ascending: false });

  if (status !== "ALL") {
    query = query.eq("booking_status", status);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = (data || []).filter((booking) => {
    if (!q) return true;
    return [
      booking.first_name,
      booking.last_name,
      booking.customer_email,
      booking.phone,
      booking.booking_status,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(q);
  });

  const csv = [
    [
      "id",
      "status",
      "first_name",
      "last_name",
      "email",
      "phone",
      "pickup",
      "return",
      "rental_price",
      "insurance_plan",
      "insurance_total",
      "deposit",
    ],
    ...rows.map((booking) => [
      booking.id,
      booking.booking_status,
      booking.first_name,
      booking.last_name,
      booking.customer_email,
      booking.phone,
      `${booking.pickup_date} ${booking.pickup_time}`,
      `${booking.return_date} ${booking.return_time}`,
      booking.rental_price,
      booking.insurance_plan_name,
      booking.insurance_total,
      booking.deposit_amount,
    ]),
  ]
    .map((row) =>
      row
        .map((value) => `"${String(value ?? "").replaceAll('"', '""')}"`)
        .join(",")
    )
    .join("\n");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=bookings.csv",
    },
  });
}
