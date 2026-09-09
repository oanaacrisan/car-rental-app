import Link from "next/link";
import { redirect } from "next/navigation";
import { supabase } from "../../lib/supabase";
import { getBookingAccessSession, verifyBookingAccessToken } from "../../lib/booking-auth";
import { hasAdminSession } from "../../lib/admin-auth";
import { getLanguage, t } from "../../lib/i18n";

export default async function BookingStatusPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ lang?: string; token?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const language = getLanguage(query.lang);
  const copy = t[language];
  const admin = await hasAdminSession();
  const bookingAccess =
    verifyBookingAccessToken(query.token) || (await getBookingAccessSession());

  if (!admin && (!bookingAccess || bookingAccess.bookingId !== id)) {
    redirect(`/client-login?lang=${language}`);
  }

  const { data: booking } = await supabase
    .from("bookings")
    .select(
      "id, car_id, booking_status, first_name, last_name, pickup_date, pickup_time, return_date, return_time, rental_price, deposit_amount, insurance_plan_name, insurance_category, insurance_price_per_day, insurance_deductible, insurance_total"
    )
    .eq("id", id)
    .single();

  let car: { brand: string | null; model: string | null } | null = null;
  let inspection: {
    deduction_amount: number | null;
    returned_deposit_amount: number | null;
    settlement_number: string | null;
    settlement_pdf_url: string | null;
  } | null = null;

  if (booking?.car_id) {
    const { data } = await supabase
      .from("cars")
      .select("brand, model")
      .eq("id", booking.car_id)
      .single();
    car = data;
  }

  if (booking?.booking_status === "COMPLETED") {
    const { data } = await supabase
      .from("return_inspections")
      .select(
        "deduction_amount, returned_deposit_amount, settlement_number, settlement_pdf_url"
      )
      .eq("booking_id", booking.id)
      .maybeSingle();

    inspection = data;
  }

  if (!booking) {
    return (
      <main className="premium-page p-8">
        <h1 className="text-4xl font-bold">{copy.bookingRequest}</h1>
        <p className="mt-3 text-gray-400">{copy.carNotFound}</p>
      </main>
    );
  }

  return (
    <main className="premium-page p-8">
      <div className="app-card mx-auto max-w-2xl p-8">
        <p className="text-sm font-semibold text-gray-400">#{booking.id}</p>
        <h1 className="mt-2 text-4xl font-bold">{copy.bookingRequest}</h1>
        <span className="mt-4 inline-block rounded-full border border-zinc-700 px-3 py-1 text-sm font-semibold">
          {booking.booking_status}
        </span>

        <div className="mt-6 space-y-3 text-gray-300">
          <p>
            {car?.brand} {car?.model}
          </p>
          <p>
            {copy.firstName}: {booking.first_name} {booking.last_name}
          </p>
          <p>
            {copy.pickupDate}: {booking.pickup_date} {booking.pickup_time}
          </p>
          <p>
            {copy.returnDate}: {booking.return_date} {booking.return_time}
          </p>
          <p>
            {copy.rentalPrice}: EUR {booking.rental_price}
          </p>
          {booking.insurance_plan_name && (
            <p>
              {copy.insurance}: {booking.insurance_plan_name} (
              {booking.insurance_category}) - EUR{" "}
              {booking.insurance_price_per_day}
              {copy.perDay}, {copy.deductible}: EUR{" "}
              {booking.insurance_deductible}, {copy.insurance}: EUR{" "}
              {booking.insurance_total}
            </p>
          )}
          <p>
            {copy.deposit}: EUR {booking.deposit_amount}
          </p>
        </div>

        {inspection && (
          <div className="mt-6 rounded-2xl border border-white/10 bg-black/50 p-5">
            <h2 className="text-xl font-semibold">{copy.finalSettlement}</h2>
            {inspection.settlement_number && (
              <p className="mt-2 text-sm text-gray-400">
                {inspection.settlement_number}
              </p>
            )}
            <div className="mt-3 space-y-2 text-gray-300">
              <p>
                {copy.retainedDeposit}: EUR {inspection.deduction_amount ?? 0}
              </p>
              <p>
                {copy.returnedDeposit}: EUR{" "}
                {inspection.returned_deposit_amount ?? booking.deposit_amount}
              </p>
            </div>
            {inspection.settlement_pdf_url && (
              <a
                href={inspection.settlement_pdf_url}
                target="_blank"
                rel="noreferrer"
                className="btn-primary mt-4"
              >
                {copy.openSettlementPdf}
              </a>
            )}
          </div>
        )}

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href={`/?lang=${language}`}
            className="btn-primary"
          >
            {copy.backToHome}
          </Link>
          <Link
            href={`/client-login?lang=${language}`}
            className="btn-secondary"
          >
            {copy.clientLogin}
          </Link>
        </div>
      </div>
    </main>
  );
}
