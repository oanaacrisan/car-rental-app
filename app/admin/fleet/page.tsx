import Link from "next/link";
import { serverSupabase } from "../../lib/server-supabase";
import { adminT, getLanguage } from "../../lib/i18n";
import { hasAdminSession } from "../../lib/admin-auth";
import AdminLogoutButton from "../AdminLogoutButton";
import MaintenanceManager from "../cars/[id]/history/MaintenanceManager";

type Car = {
  id: string;
  brand: string | null;
  model: string | null;
  price_per_day: number | null;
  deposit: number | null;
};

type Booking = {
  id: string;
  car_id: string | null;
  booking_status: string | null;
  first_name: string | null;
  last_name: string | null;
  pickup_date: string | null;
  pickup_time: string | null;
  return_date: string | null;
  return_time: string | null;
};

type MaintenancePeriod = {
  id: string;
  car_id: string;
  start_date: string;
  end_date: string;
  reason: string | null;
};

export default async function AdminFleetPage({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string }>;
}) {
  const params = await searchParams;
  const language = getLanguage(params.lang);
  const copy = adminT[language];

  if (!(await hasAdminSession())) {
    return (
      <main className="min-h-screen bg-black p-8 text-white">
        <h1 className="text-3xl font-bold">{copy.accessDenied}</h1>
        <p className="mt-2 text-gray-400">{copy.notAuthorized}</p>
      </main>
    );
  }

  const today = new Date().toISOString().slice(0, 10);
  const [{ data: cars }, { data: bookings }, { data: maintenancePeriods }] =
    await Promise.all([
      serverSupabase
        .from("cars")
        .select("id, brand, model, price_per_day, deposit")
        .order("brand", { ascending: true }),
      serverSupabase
        .from("bookings")
        .select(
          "id, car_id, booking_status, first_name, last_name, pickup_date, pickup_time, return_date, return_time"
        )
        .in("booking_status", ["PENDING", "CONFIRMED"])
        .gte("return_date", today)
        .order("pickup_date", { ascending: true }),
      serverSupabase
        .from("maintenance_periods")
        .select("id, car_id, start_date, end_date, reason")
        .gte("end_date", today)
        .order("start_date", { ascending: true }),
    ]);

  const bookingRows = (bookings || []) as Booking[];
  const maintenanceRows = (maintenancePeriods || []) as MaintenancePeriod[];

  return (
    <main className="min-h-screen bg-black p-8 text-white">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-4xl font-bold">{copy.adminFleet}</h1>
            <p className="mt-2 text-gray-400">{copy.adminFleetHelp}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href={`/admin/dashboard?lang=${language}`}
              className="rounded-lg border border-zinc-700 px-4 py-2 font-semibold text-white"
            >
              {copy.adminDashboard}
            </Link>
            <Link
              href={`/admin/bookings?lang=${language}`}
              className="rounded-lg bg-white px-4 py-2 font-semibold text-black"
            >
              {copy.adminBookings}
            </Link>
            <AdminLogoutButton label={copy.logout} />
          </div>
        </div>

        <div className="space-y-6">
          {((cars || []) as Car[]).map((car) => {
            const carBookings = bookingRows.filter(
              (booking) => booking.car_id === car.id
            );
            const carMaintenance = maintenanceRows.filter(
              (period) => period.car_id === car.id
            );

            return (
              <article
                key={car.id}
                className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h2 className="text-2xl font-semibold">
                      {car.brand} {car.model}
                    </h2>
                    <p className="mt-1 text-sm text-gray-400">
                      EUR {car.price_per_day} / day · EUR {car.deposit} deposit
                    </p>
                  </div>
                  <Link
                    href={`/admin/cars/${car.id}/history?lang=${language}`}
                    className="rounded-lg border border-zinc-700 px-4 py-2 font-semibold text-white hover:bg-zinc-800"
                  >
                    {copy.carHistory}
                  </Link>
                </div>

                <div className="mt-5 grid gap-4 lg:grid-cols-2">
                  <div className="rounded-xl border border-zinc-800 bg-black p-4">
                    <h3 className="font-semibold">{copy.upcomingBookings}</h3>
                    <div className="mt-3 space-y-3 text-sm">
                      {carBookings.length === 0 ? (
                        <p className="text-gray-400">{copy.noUpcomingBookings}</p>
                      ) : (
                        carBookings.map((booking) => (
                          <Link
                            key={booking.id}
                            href={`/admin/bookings/${booking.id}?lang=${language}`}
                            className="block rounded-lg border border-zinc-800 bg-zinc-950 p-3 hover:border-zinc-600"
                          >
                            <p className="font-semibold">
                              {booking.first_name} {booking.last_name}
                            </p>
                            <p className="mt-1 text-gray-400">
                              {booking.pickup_date} {booking.pickup_time} -{" "}
                              {booking.return_date} {booking.return_time}
                            </p>
                            <p className="mt-1 text-xs text-gray-500">
                              {booking.booking_status}
                            </p>
                          </Link>
                        ))
                      )}
                    </div>
                  </div>

                  <MaintenanceManager
                    carId={car.id}
                    periods={carMaintenance}
                    copy={copy}
                    compact
                  />
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </main>
  );
}
