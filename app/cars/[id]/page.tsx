import Link from "next/link";
import { supabase } from "../../lib/supabase";
import { getLanguage, t } from "../../lib/i18n";

function formatDate(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getMonthDays() {
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const leadingBlanks = (firstDay.getDay() + 6) % 7;

  return [
    ...Array.from({ length: leadingBlanks }, () => null),
    ...Array.from({ length: daysInMonth }, (_, index) =>
      formatDate(new Date(now.getFullYear(), now.getMonth(), index + 1))
    ),
  ];
}

export default async function CarDetailsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ startDate?: string; endDate?: string; lang?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;

  const startDate = query.startDate;
  const endDate = query.endDate;
  const language = getLanguage(query.lang);
  const copy = t[language];

  const { data: car, error } = await supabase
    .from("cars")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !car) {
    return (
      <main className="min-h-screen bg-black text-white p-8">
        <h1 className="text-4xl font-bold mb-4">{copy.carNotFound}</h1>
      </main>
    );
  }

  let isUnavailable = false;
  const bookedDates = new Set<string>();

  if (startDate && endDate) {
    const { data: overlappingBookings } = await supabase
      .from("bookings")
      .select("id, pickup_date, pickup_time, return_date, return_time")
      .eq("car_id", id)
      .in("booking_status", ["PENDING", "CONFIRMED"]);

    isUnavailable = (overlappingBookings || []).some((booking) => {
      const requestedStart = new Date(`${startDate}T00:00`);
      const requestedEnd = new Date(`${endDate}T23:59`);
      const existingStart = new Date(`${booking.pickup_date}T${booking.pickup_time}`);
      const existingEnd = new Date(`${booking.return_date}T${booking.return_time}`);

      return existingStart < requestedEnd && existingEnd > requestedStart;
    });

    const { data: overlappingMaintenance } = await supabase
      .from("maintenance_periods")
      .select("start_date, end_date")
      .eq("car_id", id);

    const hasMaintenanceOverlap = (overlappingMaintenance || []).some((period) => {
      const requestedStart = new Date(`${startDate}T00:00`);
      const requestedEnd = new Date(`${endDate}T23:59`);
      const maintenanceStart = new Date(`${period.start_date}T00:00`);
      const maintenanceEnd = new Date(`${period.end_date}T23:59`);

      return maintenanceStart < requestedEnd && maintenanceEnd > requestedStart;
    });

    isUnavailable = isUnavailable || hasMaintenanceOverlap;
  }

  const { data: carBookings } = await supabase
    .from("bookings")
    .select("pickup_date, return_date")
    .eq("car_id", id)
    .in("booking_status", ["PENDING", "CONFIRMED"]);

  (carBookings || []).forEach((booking) => {
    if (!booking.pickup_date || !booking.return_date) return;

    const cursor = new Date(`${booking.pickup_date}T00:00`);
    const end = new Date(`${booking.return_date}T00:00`);

    while (cursor <= end) {
      bookedDates.add(formatDate(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
  });

  const { data: maintenancePeriods } = await supabase
    .from("maintenance_periods")
    .select("start_date, end_date")
    .eq("car_id", id);

  (maintenancePeriods || []).forEach((period) => {
    if (!period.start_date || !period.end_date) return;

    const cursor = new Date(`${period.start_date}T00:00`);
    const end = new Date(`${period.end_date}T00:00`);

    while (cursor <= end) {
      bookedDates.add(formatDate(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
  });

  return (
    <main className="min-h-screen bg-black text-white p-8">
      <div className="max-w-3xl">
        <div className="flex items-center gap-4 mb-4">
          <h1 className="text-4xl font-bold">
            {car.brand} {car.model}
          </h1>

          {isUnavailable && (
            <span className="text-sm font-semibold px-3 py-1 rounded-full bg-red-900/60 text-red-300 border border-red-800">
              {copy.unavailable}
            </span>
          )}
        </div>

        {startDate && endDate && (
          <p className="text-gray-400 mb-6">
            {copy.selectedPeriod}: {startDate} - {endDate}
          </p>
        )}

        <div className="bg-zinc-900 rounded-xl p-6 max-w-2xl">
          <div
            className="mb-6 h-72 rounded-xl border border-white/10 bg-cover bg-center"
            style={{
              backgroundImage: `linear-gradient(180deg, transparent, rgba(0,0,0,.68)), url(${car.image_url || "https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&w=1000&q=82"})`,
            }}
          />
          <p className="mb-2">{car.horsepower} HP</p>
          <p className="mb-2">{car.transmission}</p>
          <p className="mb-2">{copy.topSpeed}: {car.top_speed} km/h</p>
          <p className="mb-2">0-100 km/h: {car.zero_to_hundred}s</p>
          <p className="mb-2">{copy.drivetrain}: {car.drivetrain}</p>
          <p className="mb-2">{copy.fuel}: {car.fuel_type}</p>
          <p className="mb-2">{copy.seats}: {car.seats}</p>
          <p className="mb-2">{copy.minimumAge}: {car.minimum_age}</p>
          <p className="mb-4">
            {copy.minimumLicenseYears}: {car.minimum_years_license}
          </p>

          <p className="mb-6 text-lg">{car.description}</p>

          <p className="text-2xl font-bold mb-6">
            EUR {car.price_per_day} {copy.perDay}
          </p>

          {isUnavailable ? (
            <div className="space-y-4">
              <p className="text-red-400 font-medium">
                {copy.notAvailablePeriod}
              </p>
              <button
                disabled
                className="bg-zinc-700 text-zinc-300 px-4 py-2 rounded font-semibold cursor-not-allowed"
              >
                {copy.unavailable}
              </button>
            </div>
          ) : (
            <Link
              href={`/cars/${car.id}/book?startDate=${startDate ?? ""}&endDate=${endDate ?? ""}&lang=${language}`}
              className="bg-white text-black px-4 py-2 rounded font-semibold inline-block"
            >
              {copy.bookNow}
            </Link>
          )}
        </div>

        <div className="mt-6 bg-zinc-900 rounded-xl p-6 max-w-2xl">
          <h2 className="mb-4 text-xl font-semibold">
            {copy.availabilityCalendar}
          </h2>
          <div className="grid grid-cols-7 gap-2 text-center text-xs font-semibold uppercase text-gray-500">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
              <span key={day}>{day}</span>
            ))}
          </div>
          <div className="mt-2 grid grid-cols-7 gap-2">
            {getMonthDays().map((dateValue, index) =>
              dateValue ? (
                <div
                  key={dateValue}
                  className={`rounded-lg border p-2 text-center text-sm ${
                    bookedDates.has(dateValue)
                      ? "border-red-800 bg-red-900/40 text-red-300"
                      : "border-green-800 bg-green-900/30 text-green-300"
                  }`}
                  title={bookedDates.has(dateValue) ? copy.booked : copy.available}
                >
                  {new Date(`${dateValue}T00:00`).getDate()}
                </div>
              ) : (
                <div key={`blank-${index}`} />
              )
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
