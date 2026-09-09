import Link from "next/link";
import { serverSupabase } from "../../lib/server-supabase";
import { adminT, getLanguage } from "../../lib/i18n";
import { hasAdminSession } from "../../lib/admin-auth";
import AdminLogoutButton from "../AdminLogoutButton";

export default async function AdminDashboardPage({
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

  const [{ data: bookings }, { data: cars }, { data: inspections }] =
    await Promise.all([
      serverSupabase.from("bookings").select("booking_status, rental_price"),
      serverSupabase.from("cars").select("id"),
      serverSupabase.from("return_inspections").select("deduction_amount"),
    ]);

  const bookingRows = bookings || [];
  const totalRevenue = bookingRows.reduce(
    (sum, booking) => sum + Number(booking.rental_price || 0),
    0
  );
  const retainedDeposits = (inspections || []).reduce(
    (sum, inspection) => sum + Number(inspection.deduction_amount || 0),
    0
  );

  const statuses = ["PENDING", "CONFIRMED", "REJECTED", "COMPLETED"];
  const statusStyles: Record<string, string> = {
    PENDING:
      "border-yellow-800 bg-yellow-950/40 text-yellow-200 hover:border-yellow-500",
    CONFIRMED:
      "border-green-800 bg-green-950/40 text-green-200 hover:border-green-500",
    REJECTED:
      "border-red-800 bg-red-950/40 text-red-200 hover:border-red-500",
    COMPLETED:
      "border-blue-800 bg-blue-950/40 text-blue-200 hover:border-blue-500",
  };

  return (
    <main className="min-h-screen bg-black p-8 text-white">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-4xl font-bold">{copy.adminDashboard}</h1>
          <div className="flex flex-wrap gap-3">
            <Link
              href={`/admin/bookings?lang=${language}`}
              className="rounded-lg bg-white px-4 py-2 font-semibold text-black"
            >
              {copy.adminBookings}
            </Link>
            <Link
              href={`/admin/fleet?lang=${language}`}
              className="rounded-lg border border-zinc-700 px-4 py-2 font-semibold text-white"
            >
              {copy.adminFleet}
            </Link>
            <AdminLogoutButton label={copy.logout} />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          {[
            [copy.totalBookings, bookingRows.length],
            [copy.totalCars, cars?.length || 0],
            [copy.totalRevenue, `EUR ${totalRevenue}`],
            [copy.retainedDeposits, `EUR ${retainedDeposits}`],
          ].map(([label, value]) => (
            <div
              key={label}
              className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5"
            >
              <p className="text-sm text-gray-400">{label}</p>
              <p className="mt-2 text-2xl font-bold">{value}</p>
            </div>
          ))}
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-4">
          {statuses.map((status) => (
            <Link
              key={status}
              href={`/admin/bookings?status=${status}&lang=${language}`}
              className={`rounded-2xl border p-5 transition ${
                statusStyles[status] ?? "border-zinc-800 bg-zinc-900 text-white"
              }`}
            >
              <p className="text-sm font-semibold">{status}</p>
              <p className="mt-2 text-2xl font-bold text-white">
                {
                  bookingRows.filter(
                    (booking) => booking.booking_status === status
                  ).length
                }
              </p>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
