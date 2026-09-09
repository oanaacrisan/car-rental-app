import { NextResponse } from "next/server";
import { serverSupabase } from "@/app/lib/server-supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  const [bookingsResult, maintenanceResult] = await Promise.all([
    serverSupabase
      .from("bookings")
      .select("car_id, pickup_date, pickup_time, return_date, return_time, booking_status")
      .in("booking_status", ["PENDING", "CONFIRMED"]),
    serverSupabase
      .from("maintenance_periods")
      .select("car_id, start_date, end_date"),
  ]);

  if (bookingsResult.error || maintenanceResult.error) {
    return NextResponse.json(
      {
        error:
          bookingsResult.error?.message ||
          maintenanceResult.error?.message ||
          "Availability could not be loaded.",
      },
      { status: 500 }
    );
  }

  return NextResponse.json(
    {
      bookings: bookingsResult.data || [],
      maintenancePeriods: maintenanceResult.data || [],
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
