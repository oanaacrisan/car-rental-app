"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { FaqChatbot } from "./components/FaqChatbot";
import { supabase } from "./lib/supabase";
import { getLanguage, t } from "./lib/i18n";

type SortOption = "default" | "price-asc" | "price-desc";

type Car = {
  id: string;
  brand: string;
  model: string;
  horsepower: number;
  transmission: string;
  price_per_day: number;
  deposit: number;
  minimum_age: number;
  minimum_years_license: number;
  image_url: string | null;
};

type Booking = {
  car_id: string | null;
  pickup_date: string | null;
  pickup_time: string | null;
  return_date: string | null;
  return_time: string | null;
  booking_status: string | null;
};

type MaintenancePeriod = {
  car_id: string | null;
  start_date: string | null;
  end_date: string | null;
};

const carImageUrls = [
  "https://images.unsplash.com/photo-1555215695-3004980ad54e?auto=format&fit=crop&w=900&q=82",
  "https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&w=900&q=82",
  "https://images.unsplash.com/photo-1503736334956-4c8f8e92946d?auto=format&fit=crop&w=900&q=82",
  "https://images.unsplash.com/photo-1542362567-b07e54358753?auto=format&fit=crop&w=900&q=82",
  "https://images.unsplash.com/photo-1552519507-da3b142c6e3d?auto=format&fit=crop&w=900&q=82",
  "https://images.unsplash.com/photo-1525609004556-c46c7d6cf023?auto=format&fit=crop&w=900&q=82",
];

function formatDate(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");

  return `${y}-${m}-${d}`;
}

function parseDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);

  return new Date(year, month - 1, day);
}

function formatDisplayDate(value: string) {
  if (!value) return "-";

  return parseDate(value).toLocaleDateString("en-GB");
}

function formatDisplayDateForLanguage(value: string, language: string) {
  if (!value) return "-";

  const locale =
    language === "ro" ? "ro-RO" : language === "de" ? "de-DE" : "en-GB";

  return parseDate(value).toLocaleDateString(locale);
}

function getMonthDays(monthDate: Date) {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const leadingBlanks = (firstDay.getDay() + 6) % 7;

  return [
    ...Array.from({ length: leadingBlanks }, () => null),
    ...Array.from({ length: daysInMonth }, (_, index) => {
      const date = new Date(year, month, index + 1);
      return formatDate(date);
    }),
  ];
}

function overlaps(
  booking: Booking,
  pickupDate: string,
  pickupTime: string,
  returnDate: string,
  returnTime: string
) {
  if (
    !booking.pickup_date ||
    !booking.pickup_time ||
    !booking.return_date ||
    !booking.return_time
  ) {
    return false;
  }

  const requestedStart = new Date(`${pickupDate}T${pickupTime}`);
  const requestedEnd = new Date(`${returnDate}T${returnTime}`);
  const existingStart = new Date(`${booking.pickup_date}T${booking.pickup_time}`);
  const existingEnd = new Date(`${booking.return_date}T${booking.return_time}`);

  return existingStart < requestedEnd && existingEnd > requestedStart;
}

function maintenanceOverlaps(
  period: MaintenancePeriod,
  pickupDate: string,
  pickupTime: string,
  returnDate: string,
  returnTime: string
) {
  if (!period.start_date || !period.end_date) return false;

  const requestedStart = new Date(`${pickupDate}T${pickupTime}`);
  const requestedEnd = new Date(`${returnDate}T${returnTime}`);
  const maintenanceStart = new Date(`${period.start_date}T00:00`);
  const maintenanceEnd = new Date(`${period.end_date}T23:59`);

  return maintenanceStart < requestedEnd && maintenanceEnd > requestedStart;
}

function getDemandMultiplier(count: number) {
  if (count >= 4) return 1.2;
  if (count >= 2) return 1.1;
  return 1;
}

function getCarImageUrl(car: Car) {
  if (car.image_url) return car.image_url;

  const key = `${car.brand}${car.model}`.split("").reduce((sum, char) => {
    return sum + char.charCodeAt(0);
  }, 0);

  return carImageUrls[key % carImageUrls.length];
}

function HomeContent() {
  const searchParams = useSearchParams();
  const language = getLanguage(searchParams.get("lang"));
  const copy = t[language];

  const [cars, setCars] = useState<Car[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [maintenancePeriods, setMaintenancePeriods] = useState<MaintenancePeriod[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const today = useMemo(() => formatDate(new Date()), []);

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [calendarMonth, setCalendarMonth] = useState(() => new Date());
  const [pickupTime, setPickupTime] = useState("10:00");
  const [returnTime, setReturnTime] = useState("10:00");
  const [driverAge, setDriverAge] = useState("");
  const [selectedBrand, setSelectedBrand] = useState("all");
  const [sortBy, setSortBy] = useState<SortOption>("default");
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    async function loadCatalog() {
      setLoading(true);

      const [{ data: carsData, error: carsError }, availabilityResponse] =
        await Promise.all([
        supabase
          .from("cars")
          .select(
            "id, brand, model, horsepower, transmission, price_per_day, deposit, minimum_age, minimum_years_license, image_url"
          )
          .order("brand", { ascending: true }),
        fetch("/api/catalog-availability", { cache: "no-store" }),
      ]);

      const availabilityData = availabilityResponse.ok
        ? ((await availabilityResponse.json()) as {
            bookings: Booking[];
            maintenancePeriods: MaintenancePeriod[];
          })
        : null;

      if (carsError || !carsData || !availabilityData) {
        setError(copy.failedLoadCars);
      } else {
        setCars(carsData as Car[]);
        setBookings(availabilityData.bookings);
        setMaintenancePeriods(availabilityData.maintenancePeriods);
      }

      setLoading(false);
    }

    loadCatalog();
  }, [copy.failedLoadCars]);

  const pickupDate = startDate;
  const dropoffDate = endDate;
  const hasPeriod = Boolean(pickupDate && dropoffDate && pickupTime && returnTime);

  const periodIsInvalid =
    hasPeriod &&
    new Date(`${dropoffDate}T${returnTime}`) <=
      new Date(`${pickupDate}T${pickupTime}`);

  const periodBookings = useMemo(() => {
    if (!hasPeriod || periodIsInvalid) return [];

    return bookings.filter((booking) =>
      overlaps(booking, pickupDate, pickupTime, dropoffDate, returnTime)
    );
  }, [
    bookings,
    dropoffDate,
    hasPeriod,
    periodIsInvalid,
    pickupDate,
    pickupTime,
    returnTime,
  ]);

  const demandMultiplier = getDemandMultiplier(periodBookings.length);
  const demandLabel =
    demandMultiplier === 1.2
      ? copy.demandHigh
      : demandMultiplier === 1.1
      ? copy.demandMedium
      : copy.demandLow;

  const brands = useMemo(
    () => Array.from(new Set(cars.map((car) => car.brand))).sort(),
    [cars]
  );

  const cheaperPeriodSuggestions = useMemo(() => {
    if (!hasPeriod || periodIsInvalid) return [];

    const requestedStart = new Date(`${pickupDate}T${pickupTime}`);
    const requestedEnd = new Date(`${dropoffDate}T${returnTime}`);
    const rangeDuration = requestedEnd.getTime() - requestedStart.getTime();

    if (rangeDuration <= 0) return [];

    const suggestions: string[] = [];

    for (let offset = 1; offset <= 21; offset += 1) {
      const candidateStart = new Date(requestedStart.getTime() + offset * 86400000);
      const candidateEnd = new Date(candidateStart.getTime() + rangeDuration);
      const candidatePickupDate = formatDate(candidateStart);
      const candidateReturnDate = formatDate(candidateEnd);
      const candidatePickupTime = `${String(candidateStart.getHours()).padStart(2, "0")}:${String(
        candidateStart.getMinutes()
      ).padStart(2, "0")}`;
      const candidateReturnTime = `${String(candidateEnd.getHours()).padStart(2, "0")}:${String(
        candidateEnd.getMinutes()
      ).padStart(2, "0")}`;

      const candidateCount = bookings.filter((booking) =>
        overlaps(
          booking,
          candidatePickupDate,
          candidatePickupTime,
          candidateReturnDate,
          candidateReturnTime
        )
      ).length;

      const candidateMultiplier = getDemandMultiplier(candidateCount);

      if (candidateMultiplier < demandMultiplier) {
        suggestions.push(
          `${formatDisplayDateForLanguage(candidatePickupDate, language)} - ${formatDisplayDateForLanguage(
            candidateReturnDate,
            language
          )}`
        );
      }

      if (suggestions.length === 3) break;
    }

    return suggestions;
  }, [
    bookings,
    demandMultiplier,
    dropoffDate,
    hasPeriod,
    language,
    periodIsInvalid,
    pickupDate,
    pickupTime,
    returnTime,
  ]);

  const visibleCars = useMemo(() => {
    const age = Number(driverAge);

    const filtered = cars.filter((car) => {
      const brandMatches = selectedBrand === "all" || car.brand === selectedBrand;
      const ageMatches = !driverAge || age >= car.minimum_age;

      return brandMatches && ageMatches;
    });

    return filtered.sort((a, b) => {
      const priceA = Math.round(a.price_per_day * demandMultiplier);
      const priceB = Math.round(b.price_per_day * demandMultiplier);

      if (sortBy === "price-asc") return priceA - priceB;
      if (sortBy === "price-desc") return priceB - priceA;
      return `${a.brand} ${a.model}`.localeCompare(`${b.brand} ${b.model}`);
    });
  }, [cars, demandMultiplier, driverAge, selectedBrand, sortBy]);

  const carsPerPage = 6;
  const totalPages = Math.max(1, Math.ceil(visibleCars.length / carsPerPage));
  const activePage = Math.min(currentPage, totalPages);
  const paginatedCars = visibleCars.slice(
    (activePage - 1) * carsPerPage,
    activePage * carsPerPage
  );

  function resetFilters() {
    setStartDate("");
    setEndDate("");
    setPickupTime("10:00");
    setReturnTime("10:00");
    setDriverAge("");
    setSelectedBrand("all");
    setSortBy("default");
    setCurrentPage(1);
  }

  function selectCalendarDate(value: string) {
    setError("");
    setCurrentPage(1);

    if (!startDate || (startDate && endDate)) {
      setStartDate(value);
      setEndDate("");
      return;
    }

    if (value < startDate) {
      setStartDate(value);
      setEndDate("");
      return;
    }

    setEndDate(value);
  }

  function changeMonth(offset: number) {
    setCalendarMonth(
      new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + offset, 1)
    );
  }

  const monthDays = getMonthDays(calendarMonth);
  const monthLabel = calendarMonth.toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
  });

  function openChatbot() {
    window.dispatchEvent(new Event("open-faq-chatbot"));
  }

  return (
    <main className="premium-page">
      <section className="premium-hero">
        <div className="premium-container">
          <nav className="premium-nav">
            <span className="brand-mark">{copy.brand}</span>
            <div className="flex flex-wrap gap-3">
              <Link href={`/client-login?lang=${language}`} className="btn-secondary text-sm">
                {copy.clientLogin}
              </Link>
              <a href="#contact" className="btn-primary text-sm">
                {copy.contact}
              </a>
            </div>
          </nav>

          <div className="hero-copy">
            <p className="eyebrow">Premium car rental</p>
            <h1 className="hero-title">{copy.brand}</h1>
            <p className="hero-subtitle">{copy.tagline}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href="#fleet" className="btn-primary">
                {copy.browseFleet}
              </a>
              <a href="#contact" className="btn-secondary">
                {copy.contact}
              </a>
              <button type="button" onClick={openChatbot} className="btn-secondary">
                {copy.help}
              </button>
            </div>
          </div>

          <div className="premium-panel booking-panel">
            <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="eyebrow">{copy.searchCriteria}</p>
                <h2 className="mt-2 text-2xl font-black md:text-3xl">
                  {copy.browseFleetText}
                </h2>
              </div>

              <button type="button" onClick={resetFilters} className="btn-secondary text-sm">
                {copy.resetFilters}
              </button>
            </div>

            <div className="grid gap-5 lg:grid-cols-[minmax(300px,0.82fr)_1fr]">
              <div className="calendar-shell">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => changeMonth(-1)}
                    className="btn-secondary min-h-9 px-3 text-sm"
                    aria-label={copy.previousMonth}
                  >
                    {"<"}
                  </button>
                  <div className="text-center">
                    <p className="text-base font-bold">{monthLabel}</p>
                    <p className="text-xs text-zinc-400">
                      {!startDate
                        ? copy.chooseStartDate
                        : !endDate
                        ? copy.chooseEndDate
                        : `${copy.selectedPeriod}: ${formatDisplayDate(startDate)} - ${formatDisplayDate(endDate)}`}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => changeMonth(1)}
                    className="btn-secondary min-h-9 px-3 text-sm"
                    aria-label={copy.nextMonth}
                  >
                    {">"}
                  </button>
                </div>

                <div className="grid grid-cols-7 gap-1.5 text-center text-[11px] font-bold uppercase text-zinc-500">
                  {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
                    <span key={day}>{day}</span>
                  ))}
                </div>

                <div className="mt-2 grid grid-cols-7 gap-1.5">
                  {monthDays.map((dateValue, index) => {
                    if (!dateValue) {
                      return <div key={`blank-${index}`} className="aspect-square" />;
                    }

                    const isPast = dateValue < today;
                    const isStart = dateValue === startDate;
                    const isEnd = dateValue === endDate;
                    const isBetween =
                      Boolean(startDate && endDate) &&
                      dateValue > startDate &&
                      dateValue < endDate;

                    return (
                      <button
                        key={dateValue}
                        type="button"
                        disabled={isPast}
                        onClick={() => selectCalendarDate(dateValue)}
                        className={`aspect-square rounded-xl border text-xs font-bold transition ${
                          isStart || isEnd
                            ? "border-white bg-white text-black"
                            : isBetween
                            ? "border-zinc-500 bg-zinc-800 text-white"
                            : isPast
                            ? "border-zinc-900 bg-black/50 text-zinc-700"
                            : "border-white/10 bg-white/[0.03] text-zinc-200 hover:border-white/60"
                        }`}
                      >
                        {parseDate(dateValue).getDate()}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="control-label">{copy.pickupTime}</span>
                  <input
                    type="time"
                    value={pickupTime}
                    onChange={(event) => {
                      setPickupTime(event.target.value);
                      setCurrentPage(1);
                    }}
                    className="control-field"
                  />
                </label>

                <label className="block">
                  <span className="control-label">{copy.returnTime}</span>
                  <input
                    type="time"
                    value={returnTime}
                    onChange={(event) => {
                      setReturnTime(event.target.value);
                      setCurrentPage(1);
                    }}
                    className="control-field"
                  />
                </label>

                <label className="block">
                  <span className="control-label">{copy.driverAge}</span>
                  <input
                    type="number"
                    min="18"
                    value={driverAge}
                    onChange={(event) => {
                      setDriverAge(event.target.value);
                      setCurrentPage(1);
                    }}
                    placeholder={copy.enterDriverAge}
                    className="control-field"
                  />
                </label>

                <label className="block">
                  <span className="control-label">{copy.brandFilter}</span>
                  <select
                    value={selectedBrand}
                    onChange={(event) => {
                      setSelectedBrand(event.target.value);
                      setCurrentPage(1);
                    }}
                    className="control-field"
                  >
                    <option value="all">{copy.allBrands}</option>
                    {brands.map((brand) => (
                      <option key={brand} value={brand}>
                        {brand}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block md:col-span-2">
                  <span className="control-label">{copy.sortBy}</span>
                  <select
                    value={sortBy}
                    onChange={(event) => {
                      setSortBy(event.target.value as SortOption);
                      setCurrentPage(1);
                    }}
                    className="control-field"
                  >
                    <option value="default">{copy.defaultSort}</option>
                    <option value="price-asc">{copy.priceAscending}</option>
                    <option value="price-desc">{copy.priceDescending}</option>
                  </select>
                </label>
              </div>
            </div>

            {periodIsInvalid && (
              <p className="mt-5 text-sm text-red-300">{copy.endAfterStart}</p>
            )}

            {!periodIsInvalid && hasPeriod && (
              <div className="mt-5 flex flex-wrap gap-3 text-sm">
                <span className="status-pill">
                  {copy.selectedPeriod}: {pickupDate} {pickupTime} - {dropoffDate}{" "}
                  {returnTime}
                </span>
                <span className="status-pill">{copy.dynamicPricing}: {demandLabel}</span>
              </div>
            )}

            {error && <p className="mt-5 text-sm text-red-300">{error}</p>}
          </div>
        </div>
      </section>

      <section id="fleet" className="section-block">
        <div className="premium-container">
          <div className="mb-10">
            <p className="eyebrow">{copy.availableCars}</p>
            <h2 className="section-heading">{copy.browseFleet}</h2>
            <p className="section-copy">{copy.browseFleetText}</p>
          </div>

          {loading ? (
            <div className="info-tile">{copy.loading}</div>
          ) : visibleCars.length === 0 ? (
            <div className="info-tile text-zinc-300">{copy.noCarsMatch}</div>
          ) : (
            <>
              <div className="car-grid">
                {paginatedCars.map((car) => {
                const carBookings = periodBookings.filter(
                  (booking) => booking.car_id === car.id
                );
                const carMaintenance = hasPeriod
                  ? maintenancePeriods.filter(
                      (period) =>
                        period.car_id === car.id &&
                        maintenanceOverlaps(
                          period,
                          pickupDate,
                          pickupTime,
                          dropoffDate,
                          returnTime
                        )
                    )
                  : [];
                const isUnavailable =
                  hasPeriod && (carBookings.length > 0 || carMaintenance.length > 0);
                const adjustedDailyPrice = Math.round(
                  car.price_per_day * demandMultiplier
                );
                const href = `/cars/${car.id}/book?startDate=${pickupDate}&endDate=${dropoffDate}&pickupTime=${pickupTime}&returnTime=${returnTime}&driverAge=${driverAge}&dailyPrice=${adjustedDailyPrice}&lang=${language}`;

                return (
                  <article
                    key={car.id}
                    className={`car-card ${isUnavailable ? "opacity-75" : ""}`}
                  >
                    <div
                      className="car-media"
                      style={{ backgroundImage: `url(${getCarImageUrl(car)})` }}
                    >
                      <span
                        className={`status-pill absolute left-4 top-4 z-10 ${
                          isUnavailable ? "unavailable" : "available"
                        }`}
                      >
                        {isUnavailable ? copy.unavailable : copy.available}
                      </span>
                    </div>

                    <div className="p-5">
                      <div className="mb-4">
                        <h3 className="text-2xl font-black">
                          {car.brand} {car.model}
                        </h3>
                        <p className="mt-1 text-sm text-zinc-400">
                          {car.horsepower} HP · {car.transmission}
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-3 text-sm text-zinc-300">
                        <p>
                          {copy.minimumAge}: {car.minimum_age}
                        </p>
                        <p>
                          {copy.minimumLicenseYears}: {car.minimum_years_license}
                        </p>
                        <p className="col-span-2">
                          {copy.deposit}: EUR {car.deposit}
                        </p>
                      </div>

                      <div className="mt-5 rounded-2xl border border-white/10 bg-black/55 p-4">
                        <p className="text-sm text-zinc-400">
                          {copy.basePrice}: EUR {car.price_per_day} {copy.perDay}
                        </p>
                        <p className="mt-1 text-2xl font-black">
                          {copy.adjustedPrice}: EUR {adjustedDailyPrice} {copy.perDay}
                        </p>
                      </div>

                      {isUnavailable ? (
                        <button
                          type="button"
                          disabled
                          className="mt-5 w-full rounded-full bg-zinc-700 px-4 py-3 font-bold text-zinc-300"
                        >
                          {copy.unavailable}
                        </button>
                      ) : (
                        <Link href={href} className="btn-primary mt-5 w-full">
                          {copy.bookThisCar}
                        </Link>
                      )}
                    </div>
                  </article>
                );
                })}
              </div>

              {totalPages > 1 && (
                <div className="fleet-pagination">
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => setCurrentPage(Math.max(1, activePage - 1))}
                    disabled={activePage === 1}
                  >
                    {copy.previousCars}
                  </button>
                  <span className="fleet-page-indicator">
                    {copy.pageLabel} {activePage} / {totalPages}
                  </span>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => setCurrentPage(Math.min(totalPages, activePage + 1))}
                    disabled={activePage === totalPages}
                  >
                    {copy.nextCars}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </section>

      <section className="section-block pt-0">
        <div className="premium-container">
          <div className="grid items-center gap-8 lg:grid-cols-[0.95fr_1.05fr]">
            <div className="feature-image about-track-image" />
            <div>
              <p className="eyebrow">{copy.aboutUs}</p>
              <h2 className="section-heading">{copy.aboutUs}</h2>
              <p className="section-copy">{copy.aboutUsText}</p>
              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                {[copy.aboutPointOne, copy.aboutPointTwo, copy.aboutPointThree].map(
                  (point) => (
                    <div key={point} className="info-tile text-sm font-bold text-zinc-200">
                      {point}
                    </div>
                  )
                )}
              </div>
            </div>

            <div id="contact" className="app-card p-6">
              <h2 className="text-3xl font-black">{copy.contact}</h2>
              <div className="location-map-image mt-5" />
              <div className="mt-5 space-y-4 text-sm">
                <p>
                  <span className="block text-zinc-400">{copy.phone}</span>
                  <a
                    href="tel:+40770122982"
                    className="text-lg font-bold text-white hover:text-zinc-300"
                  >
                    +40 770 122 982
                  </a>
                </p>
                <p>
                  <span className="block text-zinc-400">{copy.email}</span>
                  <a
                    href="mailto:contact@nurburgringcarrentals.ro"
                    className="text-lg font-bold text-white hover:text-zinc-300"
                  >
                    contact@nurburgringcarrentals.ro
                  </a>
                </p>
                <p>
                  <span className="block text-zinc-400">{copy.location}</span>
                  <span className="text-lg font-bold">
                    Nurburg, Rhineland-Palatinate, Germany
                  </span>
                </p>
                <p>
                  <span className="block text-zinc-400">{copy.openingHours}</span>
                  <span className="text-lg font-bold">{copy.openingHoursText}</span>
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <FaqChatbot
        language={language}
        pricingContext={{
          hasPeriod,
          pickupDate,
          dropoffDate,
          pickupTime,
          returnTime,
          overlappingBookings: periodBookings.length,
          demandMultiplier,
          cheaperSuggestions: cheaperPeriodSuggestions,
        }}
      />

      <section className="section-block pt-0">
        <div className="premium-container">
          <h2 className="section-heading mb-6">{copy.policies}</h2>
          <Link href={`/terms?lang=${language}`} className="btn-primary mb-6">
            {copy.termsTitle}
          </Link>
          <div className="grid gap-4 md:grid-cols-2">
            {[
              [copy.fuelPolicy, copy.fuelPolicyText],
              [copy.damagePolicy, copy.damagePolicyText],
              [copy.cancellationPolicy, copy.cancellationPolicyText],
              [copy.trackPolicy, copy.trackPolicyText],
            ].map(([title, text]) => (
              <div key={title} className="info-tile">
                <h3 className="font-bold">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-zinc-400">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={null}>
      <HomeContent />
    </Suspense>
  );
}
