import Link from "next/link";
import { serverSupabase } from "../../lib/server-supabase";
import { adminT, getLanguage } from "../../lib/i18n";
import { hasAdminSession } from "../../lib/admin-auth";
import AdminLogoutButton from "../AdminLogoutButton";
import AdminBookingsSearch from "./AdminBookingsSearch";

type Booking = {
  id: string;
  booking_status: string | null;
  rejection_reason: string | null;
  first_name: string | null;
  last_name: string | null;
  customer_email: string | null;
  phone: string | null;
  date_of_birth: string | null;
  pickup_date: string | null;
  pickup_time: string | null;
  return_date: string | null;
  return_time: string | null;
  rental_price: number | null;
  deposit_amount: number | null;
  insurance_plan_name: string | null;
  insurance_total: number | null;
  driver_license_image_url: string | null;
  id_card_image_url: string | null;
  car_id: string | null;
};

type Car = {
  id: string;
  brand: string | null;
  model: string | null;
};

const allowedStatuses = [
  "ALL",
  "PENDING",
  "CONFIRMED",
  "COMPLETED",
  "REJECTED",
  "CANCELLED",
] as const;
type FilterStatus = (typeof allowedStatuses)[number];

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

export default async function AdminBookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; lang?: string; q?: string }>;
}) {
  const params = await searchParams;
  const language = getLanguage(params.lang);
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

  const selectedStatus: FilterStatus = allowedStatuses.includes(
    (params.status?.toUpperCase() || "ALL") as FilterStatus
  )
    ? ((params.status?.toUpperCase() || "ALL") as FilterStatus)
    : "ALL";
  const queryText = (params.q || "").trim().toLowerCase();

  const { data: allBookingStatuses, error: countsError } = await serverSupabase
    .from("bookings")
    .select("booking_status");

  if (countsError || !allBookingStatuses) {
    return (
      <main className="min-h-screen bg-black text-white p-8">
        <h1 className="text-4xl font-bold mb-4">{copy.adminBookings}</h1>
        <p>{copy.failedLoadBookingCounts}</p>
        {countsError && (
          <p className="text-red-400 mt-2 text-sm">{countsError.message}</p>
        )}
      </main>
    );
  }

  const counts = {
    ALL: allBookingStatuses.length,
    PENDING: allBookingStatuses.filter(
      (b) => (b.booking_status ?? "PENDING") === "PENDING"
    ).length,
    CONFIRMED: allBookingStatuses.filter(
      (b) => b.booking_status === "CONFIRMED"
    ).length,
    REJECTED: allBookingStatuses.filter(
      (b) => b.booking_status === "REJECTED"
    ).length,
    COMPLETED: allBookingStatuses.filter(
      (b) => b.booking_status === "COMPLETED"
    ).length,
    CANCELLED: allBookingStatuses.filter(
      (b) => b.booking_status === "CANCELLED"
    ).length,
  };

  let bookingsQuery = serverSupabase
    .from("bookings")
    .select(`
      id,
      car_id,
      booking_status,
      rejection_reason,
      first_name,
      last_name,
      customer_email,
      phone,
      date_of_birth,
      pickup_date,
      pickup_time,
      return_date,
      return_time,
      rental_price,
      deposit_amount,
      insurance_plan_name,
      insurance_total,
      driver_license_image_url,
      id_card_image_url
    `)
    .order("pickup_date", { ascending: false });

  if (selectedStatus !== "ALL") {
    bookingsQuery = bookingsQuery.eq("booking_status", selectedStatus);
  }

  const { data: bookings, error: bookingsError } = await bookingsQuery;

  if (bookingsError || !bookings) {
    return (
      <main className="min-h-screen bg-black text-white p-8">
        <h1 className="text-4xl font-bold mb-4">{copy.adminBookings}</h1>
        <p>{copy.failedLoadBookings}</p>
        {bookingsError && (
          <p className="text-red-400 mt-2 text-sm">{bookingsError.message}</p>
        )}
      </main>
    );
  }

  const carIds = [
    ...new Set(bookings.map((b) => b.car_id).filter(Boolean)),
  ] as string[];

  let carsMap = new Map<string, Car>();

  if (carIds.length > 0) {
    const { data: cars, error: carsError } = await serverSupabase
      .from("cars")
      .select("id, brand, model")
      .in("id", carIds);

    if (carsError) {
      return (
        <main className="min-h-screen bg-black text-white p-8">
          <h1 className="text-4xl font-bold mb-4">{copy.adminBookings}</h1>
          <p>{copy.failedLoadCars}</p>
          <p className="text-red-400 mt-2 text-sm">{carsError.message}</p>
        </main>
      );
    }

    carsMap = new Map((cars || []).map((car) => [car.id, car]));
  }

  function filterLink(status: FilterStatus) {
    return `/admin/bookings?status=${status}&lang=${language}${
      params.q ? `&q=${encodeURIComponent(params.q)}` : ""
    }`;
  }

  const filteredBookings = ((bookings || []) as Booking[]).filter((booking) => {
    if (!queryText) return true;

    const car = booking.car_id ? carsMap.get(booking.car_id) : null;
    return [
      booking.first_name,
      booking.last_name,
      booking.customer_email,
      booking.phone,
      car?.brand,
      car?.model,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(queryText);
  });

  return (
    <main className="min-h-screen bg-black text-white p-8">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-4xl font-bold">{copy.adminBookings}</h1>
          <Link
            href={`/admin/dashboard?lang=${language}`}
            className="mt-2 inline-block text-sm text-gray-400 hover:text-white"
          >
            {copy.adminDashboard}
          </Link>
          <Link
            href={`/admin/fleet?lang=${language}`}
            className="ml-4 mt-2 inline-block text-sm text-gray-400 hover:text-white"
          >
            {copy.adminFleet}
          </Link>
        </div>

        <div className="flex flex-wrap gap-3">
          <AdminLogoutButton label={copy.logout} />
          {allowedStatuses.map((status) => {
            const isActive = selectedStatus === status;
            const count = counts[status];

            return (
              <Link
                key={status}
                href={filterLink(status)}
                className={`px-4 py-2 rounded-lg border font-semibold transition ${
                  isActive
                    ? "bg-white text-black border-white"
                    : "bg-zinc-900 text-white border-zinc-700 hover:bg-zinc-800"
                }`}
              >
                {status} ({count})
              </Link>
            );
          })}
        </div>
      </div>

      <AdminBookingsSearch
        initialQuery={params.q || ""}
        selectedStatus={selectedStatus}
        language={language}
        copy={copy}
      />

      {filteredBookings.length === 0 ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8">
          <p className="text-gray-400">
            {copy.noBookingsFound}:{" "}
            <span className="text-white">{selectedStatus}</span>
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {filteredBookings.map((booking) => {
            const car = booking.car_id ? carsMap.get(booking.car_id) : null;

            return (
              <div
                key={booking.id}
                className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-lg"
              >
                <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
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

                <div className="grid md:grid-cols-2 gap-6 text-sm">
                  <div className="space-y-2">
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
                  </div>

                  <div className="space-y-2">
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
                        {booking.insurance_plan_name} / EUR{" "}
                        {booking.insurance_total ?? 0}
                      </p>
                    )}
                    <p>
                      <span className="text-gray-400">{copy.deposit}:</span> EUR
                      {booking.deposit_amount}
                    </p>
                  </div>
                </div>

                <div className="mt-6 flex flex-wrap gap-3">
                  {booking.driver_license_image_url && (
                    <a
                      href={booking.driver_license_image_url}
                      target="_blank"
                      rel="noreferrer"
                      className="bg-white text-black px-4 py-2 rounded-lg font-semibold hover:bg-gray-200 transition"
                    >
                      {copy.driverLicense}
                    </a>
                  )}

                  {booking.id_card_image_url && (
                    <a
                      href={booking.id_card_image_url}
                      target="_blank"
                      rel="noreferrer"
                      className="bg-white text-black px-4 py-2 rounded-lg font-semibold hover:bg-gray-200 transition"
                    >
                      {copy.idCard}
                    </a>
                  )}

                  <Link
                    href={`/admin/bookings/${booking.id}?lang=${language}`}
                    className="bg-zinc-800 text-white px-4 py-2 rounded-lg font-semibold border border-zinc-700 hover:bg-zinc-700 transition"
                  >
                    {copy.reviewBooking}
                  </Link>

                  {booking.car_id && (
                    <Link
                      href={`/admin/cars/${booking.car_id}/history?lang=${language}`}
                      className="bg-zinc-800 text-white px-4 py-2 rounded-lg font-semibold border border-zinc-700 hover:bg-zinc-700 transition"
                    >
                      {copy.carHistory}
                    </Link>
                  )}
                </div>

                {booking.booking_status === "REJECTED" &&
                  booking.rejection_reason && (
                    <p className="mt-4 text-sm text-red-400">
                      {copy.reason}: {formatReason(booking.rejection_reason)}
                    </p>
                  )}
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
