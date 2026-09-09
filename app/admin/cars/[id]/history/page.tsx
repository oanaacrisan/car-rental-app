import Link from "next/link";
import { supabase } from "../../../../lib/supabase";
import { adminT, getLanguage } from "../../../../lib/i18n";
import { hasAdminSession } from "../../../../lib/admin-auth";
import MaintenanceManager from "./MaintenanceManager";

type Booking = {
  id: string;
  booking_status: string | null;
  first_name: string | null;
  last_name: string | null;
  pickup_date: string | null;
  pickup_time: string | null;
  return_date: string | null;
  return_time: string | null;
  rental_price: number | null;
  deposit_amount: number | null;
  insurance_plan_name: string | null;
  insurance_total: number | null;
};

type Inspection = {
  booking_id: string;
  deduction_amount: number | null;
  returned_deposit_amount: number | null;
  notes: string | null;
  updated_at: string | null;
  fuel_not_full: boolean | null;
  interior_dirty: boolean | null;
  exterior_dirty: boolean | null;
  new_damage: boolean | null;
  missing_accessories: boolean | null;
  late_return: boolean | null;
  settlement_pdf_url: string | null;
  settlement_number: string | null;
};

type MaintenancePeriod = {
  id: string;
  start_date: string;
  end_date: string;
  reason: string | null;
};

export default async function CarHistoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ lang?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const language = getLanguage(query.lang);
  const copy = adminT[language];

  if (!(await hasAdminSession())) {
    return (
      <main className="min-h-screen bg-black p-8 text-white">
        <h1 className="text-3xl font-bold">{copy.accessDenied}</h1>
        <p className="mt-2 text-gray-400">{copy.notAuthorized}</p>
      </main>
    );
  }

  const { data: car } = await supabase
    .from("cars")
    .select("brand, model")
    .eq("id", id)
    .single();

  const { data: bookings } = await supabase
    .from("bookings")
    .select(
      "id, booking_status, first_name, last_name, pickup_date, pickup_time, return_date, return_time, rental_price, deposit_amount, insurance_plan_name, insurance_total"
    )
    .eq("car_id", id)
    .order("pickup_date", { ascending: false });

  const bookingIds = ((bookings || []) as Booking[]).map((booking) => booking.id);

  const { data: inspections } =
    bookingIds.length > 0
      ? await supabase
          .from("return_inspections")
          .select("*")
          .in("booking_id", bookingIds)
      : { data: [] };

  const { data: maintenancePeriods } = await supabase
    .from("maintenance_periods")
    .select("id, start_date, end_date, reason")
    .eq("car_id", id)
    .order("start_date", { ascending: false });

  const inspectionsMap = new Map(
    ((inspections || []) as Inspection[]).map((inspection) => [
      inspection.booking_id,
      inspection,
    ])
  );

  return (
    <main className="min-h-screen bg-black p-8 text-white">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-4xl font-bold">{copy.carHistory}</h1>
            <p className="mt-2 text-gray-400">
              {car ? `${car.brand} ${car.model}` : id}
            </p>
          </div>
          <Link
            href={`/admin/bookings?lang=${language}`}
            className="rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2 font-semibold"
          >
            {copy.backToBookings}
          </Link>
        </div>

        <MaintenanceManager
          carId={id}
          periods={(maintenancePeriods || []) as MaintenancePeriod[]}
          copy={copy}
        />

        <div className="space-y-5">
          {((bookings || []) as Booking[]).map((booking) => {
            const inspection = inspectionsMap.get(booking.id);

            return (
              <article
                key={booking.id}
                className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-xl font-semibold">
                    {booking.first_name} {booking.last_name}
                  </h2>
                  <span className="rounded-full border border-zinc-700 px-3 py-1 text-sm">
                    {booking.booking_status}
                  </span>
                </div>

                <div className="mt-4 grid gap-3 text-sm text-gray-300 md:grid-cols-2">
                  <p>
                    {copy.pickup}: {booking.pickup_date} {booking.pickup_time}
                  </p>
                  <p>
                    {copy.return}: {booking.return_date} {booking.return_time}
                  </p>
                  <p>
                    {copy.rentalPrice}: EUR {booking.rental_price}
                  </p>
                  {booking.insurance_plan_name && (
                    <p>
                      {copy.insurance}: {booking.insurance_plan_name} / EUR{" "}
                      {booking.insurance_total ?? 0}
                    </p>
                  )}
                  <p>
                    {copy.deposit}: EUR {booking.deposit_amount}
                  </p>
                </div>

                {inspection && (
                  <div className="mt-4 rounded-xl border border-zinc-800 bg-black p-4 text-sm">
                    <p>
                      {copy.deduction}: EUR {inspection.deduction_amount ?? 0}
                    </p>
                    <p>
                      {copy.depositReturned}: EUR{" "}
                      {inspection.returned_deposit_amount ?? 0}
                    </p>
                    {inspection.notes && (
                      <p className="mt-2 text-gray-400">{inspection.notes}</p>
                    )}
                    {inspection.settlement_pdf_url && (
                      <a
                        href={inspection.settlement_pdf_url}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-3 inline-flex rounded-lg bg-white px-3 py-2 font-semibold text-black"
                      >
                        {copy.openSettlementPdf}
                        {inspection.settlement_number
                          ? ` (${inspection.settlement_number})`
                          : ""}
                      </a>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </div>
    </main>
  );
}
