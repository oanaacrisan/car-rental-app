"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { supabase } from "../../../lib/supabase";
import { getLanguage, t } from "../../../lib/i18n";
import { getInsurancePlans } from "../../../lib/insurance";

type Car = {
  id: string;
  brand: string;
  model: string;
  price_per_day: number;
  deposit: number;
  minimum_age: number;
  minimum_years_license: number;
  track_allowed: boolean | null;
  image_url: string | null;
};

export default function BookingPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const language = getLanguage(searchParams.get("lang"));
  const copy = t[language];

  const carId = params.id;

  const startDateFromUrl = searchParams.get("startDate") || "";
  const endDateFromUrl = searchParams.get("endDate") || "";
  const pickupTimeFromUrl = searchParams.get("pickupTime") || "10:00";
  const returnTimeFromUrl = searchParams.get("returnTime") || "10:00";
  const dailyPriceFromUrl = Number(searchParams.get("dailyPrice") || "");

  const [car, setCar] = useState<Car | null>(null);
  const [loading, setLoading] = useState(true);
  const [isUnavailable, setIsUnavailable] = useState(false);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [licenseYears, setLicenseYears] = useState("");

  const [pickupDate, setPickupDate] = useState(startDateFromUrl);
  const [pickupTime, setPickupTime] = useState(pickupTimeFromUrl);
  const [returnDate, setReturnDate] = useState(endDateFromUrl);
  const [returnTime, setReturnTime] = useState(returnTimeFromUrl);

  const [driverLicenseFile, setDriverLicenseFile] = useState<File | null>(null);
  const [idCardFile, setIdCardFile] = useState<File | null>(null);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [selectedInsuranceId, setSelectedInsuranceId] = useState("");

  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  const rentalDays = useMemo(() => {
    if (!pickupDate || !returnDate) return 1;

    const start = new Date(`${pickupDate}T${pickupTime || "00:00"}`);
    const end = new Date(`${returnDate}T${returnTime || "00:00"}`);

    const diffMs = end.getTime() - start.getTime();
    const days = diffMs / (1000 * 60 * 60 * 24);

    if (days <= 0) return 1;
    return Math.ceil(days);
  }, [pickupDate, pickupTime, returnDate, returnTime]);

  const dailyPrice = car
    ? Number.isFinite(dailyPriceFromUrl) && dailyPriceFromUrl > 0
      ? dailyPriceFromUrl
      : car.price_per_day
    : 0;
  const insurancePlans = car ? getInsurancePlans(Boolean(car.track_allowed)) : [];
  const selectedInsurance =
    insurancePlans.find((plan) => plan.id === selectedInsuranceId) ||
    insurancePlans[0];
  const vehicleRentalPrice = dailyPrice * rentalDays;
  const insuranceTotal = selectedInsurance
    ? selectedInsurance.pricePerDay * rentalDays
    : 0;
  const rentalPrice = vehicleRentalPrice + insuranceTotal;
  const depositAmount = car ? car.deposit : 0;

  useEffect(() => {
    async function fetchData() {
      const { data: carData } = await supabase
        .from("cars")
        .select(
          "id, brand, model, price_per_day, deposit, minimum_age, minimum_years_license, track_allowed, image_url"
        )
        .eq("id", carId)
        .single();

      if (carData) {
        setCar(carData);
      }

      setLoading(false);
    }

    fetchData();
  }, [carId]);

  useEffect(() => {
    if (!car) return;

    const plans = getInsurancePlans(Boolean(car.track_allowed));
    setSelectedInsuranceId((current) =>
      plans.some((plan) => plan.id === current) ? current : plans[0]?.id || ""
    );
  }, [car]);

  useEffect(() => {
    async function checkAvailability() {
      if (!pickupDate || !pickupTime || !returnDate || !returnTime) {
        setIsUnavailable(false);
        return;
      }

      const requestedStart = new Date(`${pickupDate}T${pickupTime}`);
      const requestedEnd = new Date(`${returnDate}T${returnTime}`);

      const { data: overlappingBookings } = await supabase
        .from("bookings")
        .select("pickup_date, pickup_time, return_date, return_time, booking_status")
        .eq("car_id", carId)
        .in("booking_status", ["PENDING", "CONFIRMED"]);

      const hasOverlap = (overlappingBookings || []).some((booking) => {
        const existingStart = new Date(`${booking.pickup_date}T${booking.pickup_time}`);
        const existingEnd = new Date(`${booking.return_date}T${booking.return_time}`);

        return existingStart < requestedEnd && existingEnd > requestedStart;
      });

      const { data: maintenancePeriods } = await supabase
        .from("maintenance_periods")
        .select("start_date, end_date")
        .eq("car_id", carId);

      const hasMaintenanceOverlap = (maintenancePeriods || []).some((period) => {
        const maintenanceStart = new Date(`${period.start_date}T00:00`);
        const maintenanceEnd = new Date(`${period.end_date}T23:59`);

        return maintenanceStart < requestedEnd && maintenanceEnd > requestedStart;
      });

      setIsUnavailable(hasOverlap || hasMaintenanceOverlap);
    }

    checkAvailability();
  }, [carId, pickupDate, pickupTime, returnDate, returnTime]);

  async function uploadFile(file: File, kind: "driver-license" | "id-card") {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("kind", kind);
    formData.append("bookingId", carId);

    const response = await fetch("/api/uploads", {
      method: "POST",
      body: formData,
    });
    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "Upload failed.");
    }

    return result.url as string;
  }

  async function handleBooking() {
    setMessage("");

    if (!car) {
      setMessage(copy.carNotFound);
      return;
    }

    if (isUnavailable) {
      setMessage(copy.alreadyBooked);
      return;
    }

    if (
      !firstName.trim() ||
      !lastName.trim() ||
      !email.trim() ||
      !phone.trim() ||
      !dateOfBirth ||
      !licenseYears ||
      !selectedInsurance ||
      !pickupDate ||
      !pickupTime ||
      !returnDate ||
      !returnTime
    ) {
      setMessage(copy.completeRequiredFields);
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setMessage(copy.invalidEmail);
      return;
    }

    if (!/^\+?[0-9\s-]{7,20}$/.test(phone.trim())) {
      setMessage(copy.invalidPhone);
      return;
    }

    if (!driverLicenseFile || !idCardFile) {
      setMessage(copy.uploadDocuments);
      return;
    }

    if (!acceptedTerms) {
      setMessage(copy.termsRequired);
      return;
    }

    const pickup = new Date(`${pickupDate}T${pickupTime}`);
    const dropoff = new Date(`${returnDate}T${returnTime}`);

    if (dropoff <= pickup) {
      setMessage(copy.returnAfterPickup);
      return;
    }

    const birthDate = new Date(`${dateOfBirth}T00:00:00`);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();

    if (
      monthDiff < 0 ||
      (monthDiff === 0 && today.getDate() < birthDate.getDate())
    ) {
      age -= 1;
    }

    if (age < car.minimum_age) {
      setMessage(copy.minimumAgeValidation);
      return;
    }

    if (Number(licenseYears) < car.minimum_years_license) {
      setMessage(copy.minimumLicenseValidation);
      return;
    }

    setSaving(true);

    try {
      const driverLicenseUrl = await uploadFile(driverLicenseFile, "driver-license");
      const idCardUrl = await uploadFile(idCardFile, "id-card");

      const response = await fetch("/api/admin/bookings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          carId,
          firstName,
          lastName,
          email,
          phone,
          dateOfBirth,
          licenseYears,
          pickupDate,
          pickupTime,
          returnDate,
          returnTime,
          rentalPrice,
          depositAmount,
          insurancePlanId: selectedInsurance.id,
          insurancePlanName: selectedInsurance.name,
          insuranceCategory: selectedInsurance.category,
          insurancePricePerDay: selectedInsurance.pricePerDay,
          insuranceDeductible: selectedInsurance.deductible,
          insuranceCoverage:
            copy[selectedInsurance.coverageKey as keyof typeof copy],
          insuranceTotal,
          driverLicenseImageUrl: driverLicenseUrl,
          idCardImageUrl: idCardUrl,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setMessage(result.error || copy.failedCreateBooking);
        return;
      }

      const tokenQuery = result.bookingToken
        ? `&token=${encodeURIComponent(result.bookingToken)}`
        : "";
      router.push(`/booking-success?id=${result.booking.id}&lang=${language}${tokenQuery}`);
      setFirstName("");
      setLastName("");
      setEmail("");
      setPhone("");
      setDateOfBirth("");
      setLicenseYears("");
      setDriverLicenseFile(null);
      setIdCardFile(null);
      setAcceptedTerms(false);
    } catch (error) {
      console.error("BOOKING ERROR:", error);
      setMessage(
        error instanceof Error
          ? error.message
          : copy.uploadOrBookingFailed
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="premium-page p-8">{copy.loading}</main>
    );
  }

  if (!car) {
    return (
      <main className="premium-page p-8">{copy.carNotFound}</main>
    );
  }

  return (
    <main className="premium-page px-6 py-12">
      <div className="premium-container">
        <p className="eyebrow">{copy.bookingRequest}</p>
        <h1 className="section-heading mb-10">{copy.bookingRequest}</h1>

        <div className="grid lg:grid-cols-[1fr_1.2fr] gap-8 items-start">
          <div className="app-card p-6">
            <div
              className="mb-6 h-64 rounded-2xl border border-white/10 bg-cover bg-center"
              style={{
                backgroundImage:
                  `linear-gradient(180deg, transparent, rgba(0,0,0,.72)), url(${car.image_url || "https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&w=1000&q=82"})`,
              }}
            />
            <h2 className="text-3xl font-semibold mb-3">
              {car.brand} {car.model}
            </h2>

            <p className="text-2xl font-bold mb-4">
              EUR {dailyPrice}{" "}
              <span className="text-base font-medium text-gray-400">{copy.perDay}</span>
            </p>

            <div className="space-y-2 text-gray-300">
              <p>{copy.minimumAge}: {car.minimum_age}</p>
              <p>{copy.minimumLicenseYears}: {car.minimum_years_license}</p>
              <p>
                {copy.vehicleUse}:{" "}
                {car.track_allowed ? copy.trackAllowed : copy.roadOnly}
              </p>
            </div>

            <div className="mt-6 border-t border-zinc-800 pt-6">
              <h3 className="text-lg font-semibold mb-2">{copy.returnConditions}</h3>
              <p className="text-sm text-gray-400 leading-6">
                {copy.returnConditionsText}
              </p>
            </div>

            <div className="mt-6 border-t border-zinc-800 pt-6 space-y-2">
              <p className="text-gray-300">
                {copy.vehicleRental}: EUR {vehicleRentalPrice}
              </p>
              <p className="text-gray-300">
                {copy.insurance}: EUR {insuranceTotal}
              </p>
              <p className="text-lg font-semibold">
                {copy.totalPrice}: EUR {rentalPrice}
              </p>
              <p className="text-gray-300">{copy.deposit}: EUR {depositAmount}</p>
              <p className="text-sm text-gray-400">
                {copy.bookingStatusAfterSubmit}
              </p>
            </div>
          </div>

          <div className="app-card p-6 space-y-8">
            <section>
              <h3 className="text-xl font-semibold mb-4">{copy.personalInformation}</h3>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block mb-2 text-sm text-gray-300">
                    {copy.firstName}
                  </label>
                  <input
                    type="text"
                    placeholder={copy.enterFirstName}
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="w-full p-3 rounded-xl bg-black border border-gray-700 focus:outline-none focus:border-white"
                    disabled={isUnavailable}
                  />
                </div>

                <div>
                  <label className="block mb-2 text-sm text-gray-300">
                    {copy.lastName}
                  </label>
                  <input
                    type="text"
                    placeholder={copy.enterLastName}
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="w-full p-3 rounded-xl bg-black border border-gray-700 focus:outline-none focus:border-white"
                    disabled={isUnavailable}
                  />
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4 mt-4">
                <div>
                  <label className="block mb-2 text-sm text-gray-300">{copy.email}</label>
                  <input
                    type="email"
                    placeholder={copy.enterEmail}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full p-3 rounded-xl bg-black border border-gray-700 focus:outline-none focus:border-white"
                    disabled={isUnavailable}
                  />
                </div>

                <div>
                  <label className="block mb-2 text-sm text-gray-300">{copy.phone}</label>
                  <input
                    type="tel"
                    placeholder={copy.enterPhone}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full p-3 rounded-xl bg-black border border-gray-700 focus:outline-none focus:border-white"
                    disabled={isUnavailable}
                  />
                </div>
              </div>

              <div className="mt-4">
                <label className="block mb-2 text-sm text-gray-300">
                  {copy.dateOfBirth}
                </label>
                <input
                  type="date"
                  value={dateOfBirth}
                  onChange={(e) => setDateOfBirth(e.target.value)}
                  className="w-full p-3 rounded-xl bg-black border border-gray-700 focus:outline-none focus:border-white"
                  disabled={isUnavailable}
                />
                <p className="text-xs text-gray-500 mt-2">
                  {copy.ageRequirementHelp}
                </p>
              </div>

              <div className="mt-4">
                <label className="block mb-2 text-sm text-gray-300">
                  {copy.licenseYears}
                </label>
                <input
                  type="number"
                  min="0"
                  value={licenseYears}
                  onChange={(e) => setLicenseYears(e.target.value)}
                  placeholder={copy.enterLicenseYears}
                  className="w-full p-3 rounded-xl bg-black border border-gray-700 focus:outline-none focus:border-white"
                  disabled={isUnavailable}
                />
              </div>
            </section>

            <section>
              <h3 className="text-xl font-semibold mb-4">{copy.rentalPeriod}</h3>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block mb-2 text-sm text-gray-300">
                    {copy.pickupDate}
                  </label>
                  <input
                    type="date"
                    value={pickupDate}
                    onChange={(e) => setPickupDate(e.target.value)}
                    className="w-full p-3 rounded-xl bg-black border border-gray-700 focus:outline-none focus:border-white"
                    disabled={isUnavailable}
                  />
                </div>

                <div>
                  <label className="block mb-2 text-sm text-gray-300">
                    {copy.pickupTime}
                  </label>
                  <input
                    type="time"
                    value={pickupTime}
                    onChange={(e) => setPickupTime(e.target.value)}
                    className="w-full p-3 rounded-xl bg-black border border-gray-700 focus:outline-none focus:border-white"
                    disabled={isUnavailable}
                  />
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4 mt-4">
                <div>
                  <label className="block mb-2 text-sm text-gray-300">
                    {copy.returnDate}
                  </label>
                  <input
                    type="date"
                    value={returnDate}
                    onChange={(e) => setReturnDate(e.target.value)}
                    className="w-full p-3 rounded-xl bg-black border border-gray-700 focus:outline-none focus:border-white"
                    disabled={isUnavailable}
                  />
                </div>

                <div>
                  <label className="block mb-2 text-sm text-gray-300">
                    {copy.returnTime}
                  </label>
                  <input
                    type="time"
                    value={returnTime}
                    onChange={(e) => setReturnTime(e.target.value)}
                    className="w-full p-3 rounded-xl bg-black border border-gray-700 focus:outline-none focus:border-white"
                    disabled={isUnavailable}
                  />
                </div>
              </div>
            </section>

            <section>
              <h3 className="text-xl font-semibold mb-4">{copy.insurance}</h3>
              <div className="space-y-3">
                {insurancePlans.map((plan) => (
                  <label
                    key={plan.id}
                    className={`block cursor-pointer rounded-2xl border p-4 transition ${
                      selectedInsurance?.id === plan.id
                        ? "border-white bg-white/[0.04]"
                        : "border-white/10 bg-black/50 hover:border-white/30"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="radio"
                        checked={selectedInsurance?.id === plan.id}
                        onChange={() => setSelectedInsuranceId(plan.id)}
                        className="mt-1 h-4 w-4 accent-white"
                      />
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <span className="font-semibold text-white">
                            {plan.name}
                          </span>
                          <span className="text-sm font-semibold text-white">
                            EUR {plan.pricePerDay} {copy.perDay}
                          </span>
                        </div>
                        <p className="mt-2 text-sm text-gray-400">
                          {copy[plan.coverageKey as keyof typeof copy]}
                        </p>
                        <p className="mt-2 text-sm text-gray-300">
                          {copy.deductible}: EUR {plan.deductible}
                        </p>
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </section>

            <section>
              <h3 className="text-xl font-semibold mb-4">{copy.requiredDocuments}</h3>

              <div className="space-y-4">
                <div>
                  <label className="block mb-2 text-sm text-gray-300">
                    {copy.driversLicense}
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) =>
                      setDriverLicenseFile(e.target.files?.[0] || null)
                    }
                    className="w-full p-3 rounded-xl bg-black border border-gray-700 focus:outline-none focus:border-white"
                    disabled={isUnavailable}
                  />
                </div>

                <div>
                  <label className="block mb-2 text-sm text-gray-300">
                    {copy.idCard}
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setIdCardFile(e.target.files?.[0] || null)}
                    className="w-full p-3 rounded-xl bg-black border border-gray-700 focus:outline-none focus:border-white"
                    disabled={isUnavailable}
                  />
                </div>
              </div>
            </section>

            {message && (
              <p
                className={`text-sm ${
                  message === copy.bookingSuccess
                    ? "text-green-400"
                    : "text-red-400"
                }`}
              >
                {message}
              </p>
            )}

            <label className="flex items-start gap-3 rounded-2xl border border-white/10 bg-black/50 p-4 text-sm text-gray-300">
              <input
                type="checkbox"
                checked={acceptedTerms}
                onChange={(event) => setAcceptedTerms(event.target.checked)}
                className="mt-1 h-4 w-4 accent-white"
              />
              {copy.termsAgreement}
            </label>

            <div className="rounded-2xl border border-white/10 bg-black/50 p-4 text-sm leading-6 text-gray-400">
              <p className="font-semibold text-white">{copy.cancellationPolicy}</p>
              <p className="mt-1">{copy.cancellationPolicyText}</p>
              <a
                href={`/terms?lang=${language}`}
                className="mt-3 inline-block font-semibold text-white underline"
              >
                {copy.termsTitle}
              </a>
            </div>

            <button
              onClick={handleBooking}
              disabled={saving || isUnavailable}
              className="btn-primary w-full py-4 text-lg disabled:opacity-50"
            >
              {isUnavailable
                ? copy.unavailable
                : saving
                ? copy.saving
                : copy.submitBooking}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
