import Link from "next/link";
import { serverSupabase } from "../../../lib/server-supabase";
import { adminT, getLanguage } from "../../../lib/i18n";
import { hasAdminSession } from "../../../lib/admin-auth";
import ReviewActions from "./ReviewActions";
import ReturnInspection from "./ReturnInspection";

type Car = {
  id: string;
  brand: string | null;
  model: string | null;
  minimum_age: number | null;
  minimum_years_license: number | null;
};

function formatReason(reason: string | null) {
  switch (reason) {
    case "MINIMUM_AGE_NOT_MET":
      return "Minimum age not met";
    case "INSUFFICIENT_LICENSE_EXPERIENCE":
      return "Insufficient license experience";
    case "DOCUMENTS_INVALID_OR_UNREADABLE":
      return "Documents invalid or unreadable";
    default:
      return reason || "-";
  }
}

export default async function AdminBookingReviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ lang?: string }>;
}) {
  const routeParams = await params;
  const query = await searchParams;
  const language = getLanguage(query.lang);
  const copy = adminT[language];

  if (!(await hasAdminSession())) {
    return (
      <main className="min-h-screen bg-black text-white p-8">
        <h1 className="text-3xl font-bold">{copy.accessDenied}</h1>
        <p className="text-gray-400 mt-2">
          {copy.notAuthorized}
        </p>
      </main>
    );
  }

  const { data: booking, error } = await serverSupabase
    .from("bookings")
    .select(`
      id,
      car_id,
      booking_status,
      rejection_reason,
      internal_notes,
      first_name,
      last_name,
      customer_email,
      phone,
      date_of_birth,
      license_years,
      pickup_date,
      pickup_time,
      return_date,
      return_time,
      rental_price,
      deposit_amount,
      insurance_plan_name,
      insurance_category,
      insurance_price_per_day,
      insurance_deductible,
      insurance_total,
      driver_license_image_url,
      id_card_image_url
    `)
    .eq("id", routeParams.id)
    .single();

  if (error || !booking) {
    return (
      <main className="min-h-screen bg-black text-white p-8">
        <h1 className="text-4xl font-bold mb-4">{copy.bookingNotFound}</h1>
      </main>
    );
  }

  let car: Car | null = null;

  if (booking.car_id) {
    const { data: carData } = await serverSupabase
      .from("cars")
      .select("id, brand, model, minimum_age, minimum_years_license")
      .eq("id", booking.car_id)
      .single();

    if (carData) {
      car = carData;
    }
  }

  const returnDateTime =
    booking.return_date && booking.return_time
      ? new Date(`${booking.return_date}T${booking.return_time}`)
      : null;
  const canInspectReturn =
    booking.booking_status === "COMPLETED" &&
    returnDateTime !== null &&
    returnDateTime <= new Date();

  return (
    <main className="min-h-screen bg-black text-white p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8 flex items-center justify-between gap-4">
          <h1 className="text-4xl font-bold">{copy.reviewBooking}</h1>

          <Link
            href={`/admin/bookings?lang=${language}`}
            className="bg-zinc-800 text-white px-4 py-2 rounded-lg border border-zinc-700"
          >
            {copy.backToBookings}
          </Link>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-lg space-y-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h2 className="text-2xl font-semibold">
              {car?.brand ?? "Unknown"} {car?.model ?? ""}
            </h2>

            <span
              className={`px-3 py-1 rounded-full text-sm font-semibold ${
                booking.booking_status === "CONFIRMED"
                  ? "bg-green-900/60 text-green-300 border border-green-800"
                  : booking.booking_status === "COMPLETED"
                  ? "bg-blue-900/60 text-blue-300 border border-blue-800"
                  : booking.booking_status === "REJECTED"
                  ? "bg-red-900/60 text-red-300 border border-red-800"
                  : booking.booking_status === "CANCELLED"
                  ? "bg-zinc-800 text-zinc-300 border border-zinc-700"
                  : "bg-yellow-900/60 text-yellow-300 border border-yellow-800"
              }`}
            >
              {booking.booking_status ?? "PENDING"}
            </span>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            <div className="space-y-3">
              <h3 className="text-lg font-semibold">{copy.customerInformation}</h3>
              <p>
                <span className="text-gray-400">{copy.client}:</span>{" "}
                {booking.first_name} {booking.last_name}
              </p>
              <p>
                <span className="text-gray-400">{copy.email}:</span>{" "}
                {booking.customer_email}
              </p>
              <p>
                <span className="text-gray-400">{copy.phone}:</span>{" "}
                {booking.phone}
              </p>
              <p>
                <span className="text-gray-400">{copy.dateOfBirth}:</span>{" "}
                {booking.date_of_birth}
              </p>
              <p>
                <span className="text-gray-400">{copy.minimumLicenseYears}:</span>{" "}
                {booking.license_years ?? "-"}
              </p>
            </div>

            <div className="space-y-3">
              <h3 className="text-lg font-semibold">{copy.rentalInformation}</h3>
              <p>
                <span className="text-gray-400">{copy.pickup}:</span>{" "}
                {booking.pickup_date} at {booking.pickup_time}
              </p>
              <p>
                <span className="text-gray-400">{copy.return}:</span>{" "}
                {booking.return_date} at {booking.return_time}
              </p>
              <p>
                <span className="text-gray-400">{copy.rentalPrice}:</span> EUR
                {booking.rental_price}
              </p>
              {booking.insurance_plan_name && (
                <p>
                  <span className="text-gray-400">{copy.insurance}:</span>{" "}
                  {booking.insurance_plan_name} ({booking.insurance_category}) -
                  EUR {booking.insurance_price_per_day}/day,{" "}
                  {copy.deductible}: EUR {booking.insurance_deductible},{" "}
                  {copy.insurance}: EUR {booking.insurance_total}
                </p>
              )}
              <p>
                <span className="text-gray-400">{copy.deposit}:</span> EUR
                {booking.deposit_amount}
              </p>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            <div className="space-y-3">
              <h3 className="text-lg font-semibold">{copy.vehicleRequirements}</h3>
              <p>
                <span className="text-gray-400">{copy.minimumAge}:</span>{" "}
                {car?.minimum_age ?? "-"}
              </p>
              <p>
                <span className="text-gray-400">{copy.minimumLicenseYears}:</span>{" "}
                {car?.minimum_years_license ?? "-"}
              </p>
            </div>

            <div className="space-y-3">
              <h3 className="text-lg font-semibold">{copy.documents}</h3>

              {booking.driver_license_image_url && (
                <a
                  href={booking.driver_license_image_url}
                  target="_blank"
                  rel="noreferrer"
                  className="block bg-white text-black px-4 py-2 rounded-lg font-semibold w-fit"
                >
                  {copy.openDriverLicense}
                </a>
              )}

              {booking.id_card_image_url && (
                <a
                  href={booking.id_card_image_url}
                  target="_blank"
                  rel="noreferrer"
                  className="block bg-white text-black px-4 py-2 rounded-lg font-semibold w-fit"
                >
                  {copy.openIdCard}
                </a>
              )}
            </div>
          </div>

          {booking.booking_status === "REJECTED" &&
            booking.rejection_reason && (
              <div className="bg-red-950/40 border border-red-900 rounded-xl p-4">
                <p className="text-red-300">
                  <span className="font-semibold">{copy.rejectionReason}:</span>{" "}
                  {formatReason(booking.rejection_reason)}
                </p>
              </div>
            )}

          <div className="border-t border-zinc-800 pt-6">
            <h3 className="text-lg font-semibold mb-4">{copy.adminActions}</h3>

            <ReviewActions
              bookingId={booking.id}
              status={booking.booking_status}
              initialInternalNotes={booking.internal_notes || ""}
              copy={copy}
            />
          </div>

          <div className="border-t border-zinc-800 pt-6">
            {canInspectReturn ? (
              <ReturnInspection
              bookingId={booking.id}
              depositAmount={booking.deposit_amount ?? 0}
              copy={copy}
              />
            ) : (
              <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
                <h3 className="text-lg font-semibold">{copy.returnInspection}</h3>
                <p className="mt-2 text-sm text-gray-400">
                  {copy.returnInspectionUnavailable}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
