import Link from "next/link";
import { supabase } from "../lib/supabase";
import { getLanguage, t } from "../lib/i18n";

type Booking = {
  car_id: string;
  pickup_date: string;
  return_date: string;
  booking_status: string;
};

type Car = {
  id: string;
  brand: string;
  model: string;
  horsepower: number;
  transmission: string;
  price_per_day: number;
  image_url: string | null;
};

export default async function CarsPage({
  searchParams,
}: {
  searchParams: Promise<{ startDate?: string; endDate?: string; lang?: string }>;
}) {
  const params = await searchParams;
  const startDate = params.startDate;
  const endDate = params.endDate;
  const language = getLanguage(params.lang);
  const copy = t[language];

  const { data: cars, error } = await supabase
    .from("cars")
    .select("*")
    .order("price_per_day", { ascending: true });

  if (error || !cars) {
    return (
      <main className="min-h-screen bg-black text-white p-8">
        <h1 className="text-4xl font-bold mb-4">{copy.availableCars}</h1>
        <p>{copy.failedLoadCars}</p>
      </main>
    );
  }

  let unavailableCarIds = new Set<string>();

  if (startDate && endDate) {
    const { data: bookings } = await supabase
      .from("bookings")
      .select("car_id, pickup_date, return_date, booking_status")
      .in("booking_status", ["PENDING", "CONFIRMED"])
      .lte("pickup_date", endDate)
      .gte("return_date", startDate);

    const { data: maintenancePeriods } = await supabase
      .from("maintenance_periods")
      .select("car_id, start_date, end_date")
      .lte("start_date", endDate)
      .gte("end_date", startDate);

    if (bookings) {
      unavailableCarIds = new Set(
        (bookings as Booking[]).map((booking) => booking.car_id)
      );
    }

    (maintenancePeriods || []).forEach((period) => {
      if (period.car_id) unavailableCarIds.add(period.car_id);
    });
  }

  return (
    <main className="min-h-screen bg-black text-white p-8">
      <h1 className="text-4xl font-bold mb-2">{copy.availableCars}</h1>

      {startDate && endDate && (
        <p className="mb-6 text-gray-400">
          {copy.selectedPeriod}: {startDate} - {endDate}
        </p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {(cars as Car[]).map((car) => {
          const isUnavailable = unavailableCarIds.has(car.id);

          return (
            <div
              key={car.id}
              className={`rounded-xl p-5 border transition ${
                isUnavailable
                  ? "bg-zinc-900/50 border-zinc-800 opacity-60"
                  : "bg-zinc-900 border-zinc-800"
              }`}
            >
              <div
                className="mb-4 h-48 rounded-xl border border-white/10 bg-cover bg-center"
                style={{
                  backgroundImage: `linear-gradient(180deg, transparent, rgba(0,0,0,.68)), url(${car.image_url || "https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&w=900&q=82"})`,
                }}
              />
              <div className="flex items-start justify-between gap-3 mb-2">
                <h2 className="text-2xl font-semibold">
                  {car.brand} {car.model}
                </h2>

                {isUnavailable && (
                  <span className="text-xs font-semibold px-3 py-1 rounded-full bg-red-900/60 text-red-300 border border-red-800">
                    {copy.unavailable}
                  </span>
                )}
              </div>

              <p className="mb-1">{car.horsepower} HP</p>
              <p className="mb-1">{car.transmission}</p>
              <p className="mb-4 text-lg font-bold">
                EUR {car.price_per_day} {copy.perDay}
              </p>

              {isUnavailable ? (
                <button
                  disabled
                  className="bg-zinc-700 text-zinc-300 px-4 py-2 rounded font-semibold inline-block cursor-not-allowed"
                >
                  {copy.unavailable}
                </button>
              ) : (
                <Link
                  href={`/cars/${car.id}?startDate=${startDate ?? ""}&endDate=${endDate ?? ""}&lang=${language}`}
                  className="bg-white text-black px-4 py-2 rounded font-semibold inline-block"
                >
                  {copy.viewDetails}
                </Link>
              )}
            </div>
          );
        })}
      </div>
    </main>
  );
}
