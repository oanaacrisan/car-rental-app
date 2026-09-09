import { NextResponse } from "next/server";
import { createBookingAccessToken } from "@/app/lib/booking-auth";
import { sendPendingBookingEmail } from "@/app/lib/email";
import { findInsurancePlan } from "@/app/lib/insurance";
import { serverSupabase } from "@/app/lib/server-supabase";
import {
  enforceRateLimit,
  getClientIp,
  isValidEmail,
  isValidIsoDate,
  isValidPhone,
  isValidTime,
  isValidUuid,
  normalizeEmail,
  sameOriginRequest,
  sanitizeText,
} from "@/app/lib/security";
import { logAuditEvent } from "@/app/lib/audit";

function getAge(dateOfBirth: string) {
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

  return age;
}

function getDemandMultiplier(count: number) {
  if (count >= 4) return 1.2;
  if (count >= 2) return 1.1;
  return 1;
}

export async function POST(req: Request) {
  if (!sameOriginRequest(req)) {
    return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
  }

  const ip = getClientIp(req);
  const rateLimit = enforceRateLimit(`booking-create:${ip}`, {
    limit: 6,
    windowMs: 15 * 60 * 1000,
    blockMs: 15 * 60 * 1000,
  });

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many booking attempts. Please try again later." },
      { status: 429 }
    );
  }

  try {
    const body = await req.json();

    const carId = sanitizeText(body.carId, 80);
    const firstName = sanitizeText(body.firstName, 80);
    const lastName = sanitizeText(body.lastName, 80);
    const email = normalizeEmail(body.email);
    const phone = sanitizeText(body.phone, 30);
    const dateOfBirth = sanitizeText(body.dateOfBirth, 20);
    const licenseYears = Number(body.licenseYears);
    const pickupDate = sanitizeText(body.pickupDate, 20);
    const pickupTime = sanitizeText(body.pickupTime, 10);
    const returnDate = sanitizeText(body.returnDate, 20);
    const returnTime = sanitizeText(body.returnTime, 10);
    const insurancePlanId = sanitizeText(body.insurancePlanId, 40);
    const driverLicenseImageUrl = sanitizeText(body.driverLicenseImageUrl, 500);
    const idCardImageUrl = sanitizeText(body.idCardImageUrl, 500);

    if (
      !carId ||
      !firstName ||
      !lastName ||
      !email ||
      !phone ||
      !dateOfBirth ||
      !Number.isFinite(licenseYears) ||
      !insurancePlanId ||
      !pickupDate ||
      !pickupTime ||
      !returnDate ||
      !returnTime ||
      !driverLicenseImageUrl ||
      !idCardImageUrl
    ) {
      return NextResponse.json(
        { error: "Please complete all required fields." },
        { status: 400 }
      );
    }

    if (!isValidUuid(carId)) {
      return NextResponse.json({ error: "Invalid vehicle identifier." }, { status: 400 });
    }

    if (!isValidEmail(email)) {
      return NextResponse.json(
        { error: "Please enter a valid email address." },
        { status: 400 }
      );
    }

    if (!isValidPhone(phone)) {
      return NextResponse.json(
        { error: "Please enter a valid phone number." },
        { status: 400 }
      );
    }

    if (!isValidIsoDate(pickupDate) || !isValidIsoDate(returnDate) || !isValidIsoDate(dateOfBirth)) {
      return NextResponse.json({ error: "Invalid date provided." }, { status: 400 });
    }

    if (!isValidTime(pickupTime) || !isValidTime(returnTime)) {
      return NextResponse.json({ error: "Invalid time provided." }, { status: 400 });
    }

    const requestedStart = new Date(`${pickupDate}T${pickupTime}`);
    const requestedEnd = new Date(`${returnDate}T${returnTime}`);

    if (requestedEnd <= requestedStart) {
      return NextResponse.json(
        { error: "Return date and time must be after pickup date and time." },
        { status: 400 }
      );
    }

    const { data: carRequirements, error: carError } = await serverSupabase
      .from("cars")
      .select("brand, model, minimum_age, minimum_years_license, track_allowed, price_per_day, deposit")
      .eq("id", carId)
      .single();

    if (carError || !carRequirements) {
      return NextResponse.json({ error: "Car not found." }, { status: 404 });
    }

    const driverAge = getAge(dateOfBirth);

    if (driverAge < Number(carRequirements.minimum_age || 0)) {
      return NextResponse.json(
        { error: "Driver does not meet the minimum age requirement." },
        { status: 400 }
      );
    }

    if (
      licenseYears < Number(carRequirements.minimum_years_license || 0)
    ) {
      return NextResponse.json(
        { error: "Driver does not meet the minimum license experience requirement." },
        { status: 400 }
      );
    }

    const insurancePlan = findInsurancePlan(
      Boolean(carRequirements.track_allowed),
      insurancePlanId
    );

    if (!insurancePlan) {
      return NextResponse.json(
        { error: "Selected insurance plan is not valid for this vehicle." },
        { status: 400 }
      );
    }

    const { data: carBookings, error: availabilityError } = await serverSupabase
      .from("bookings")
      .select("pickup_date, pickup_time, return_date, return_time, booking_status")
      .eq("car_id", carId)
      .in("booking_status", ["PENDING", "CONFIRMED"]);

    if (availabilityError) {
      return NextResponse.json(
        { error: availabilityError.message },
        { status: 500 }
      );
    }

    const hasOverlap = (carBookings || []).some((booking) => {
      const existingStart = new Date(`${booking.pickup_date}T${booking.pickup_time}`);
      const existingEnd = new Date(`${booking.return_date}T${booking.return_time}`);
      return existingStart < requestedEnd && existingEnd > requestedStart;
    });

    if (hasOverlap) {
      return NextResponse.json(
        {
          error:
            "This car has just been booked for the selected period. Please choose another car or period.",
        },
        { status: 409 }
      );
    }

    const { data: maintenancePeriods, error: maintenanceError } = await serverSupabase
      .from("maintenance_periods")
      .select("start_date, end_date")
      .eq("car_id", carId);

    if (maintenanceError) {
      return NextResponse.json(
        { error: maintenanceError.message },
        { status: 500 }
      );
    }

    const hasMaintenanceOverlap = (maintenancePeriods || []).some((period) => {
      const maintenanceStart = new Date(`${period.start_date}T00:00`);
      const maintenanceEnd = new Date(`${period.end_date}T23:59`);
      return maintenanceStart < requestedEnd && maintenanceEnd > requestedStart;
    });

    if (hasMaintenanceOverlap) {
      return NextResponse.json(
        {
          error:
            "This car is unavailable because it is scheduled for maintenance during the selected period.",
        },
        { status: 409 }
      );
    }

    const { data: fleetBookings, error: demandError } = await serverSupabase
      .from("bookings")
      .select("pickup_date, pickup_time, return_date, return_time, booking_status")
      .in("booking_status", ["PENDING", "CONFIRMED"]);

    if (demandError) {
      return NextResponse.json(
        { error: demandError.message },
        { status: 500 }
      );
    }

    const overlappingDemandBookings = (fleetBookings || []).filter((booking) => {
      const existingStart = new Date(`${booking.pickup_date}T${booking.pickup_time}`);
      const existingEnd = new Date(`${booking.return_date}T${booking.return_time}`);
      return existingStart < requestedEnd && existingEnd > requestedStart;
    }).length;

    const demandMultiplier = getDemandMultiplier(overlappingDemandBookings);
    const diffMs = requestedEnd.getTime() - requestedStart.getTime();
    const rentalDays = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
    const dynamicDailyPrice = Math.round(Number(carRequirements.price_per_day || 0) * demandMultiplier);
    const insuranceTotal = insurancePlan.pricePerDay * rentalDays;
    const totalRentalPrice = dynamicDailyPrice * rentalDays + insuranceTotal;
    const depositAmount = Number(carRequirements.deposit || 0);

    const { data, error } = await serverSupabase
      .from("bookings")
      .insert([
        {
          car_id: carId,
          first_name: firstName,
          last_name: lastName,
          customer_email: email,
          phone,
          date_of_birth: dateOfBirth,
          license_years: licenseYears,
          pickup_date: pickupDate,
          pickup_time: pickupTime,
          return_date: returnDate,
          return_time: returnTime,
          rental_price: totalRentalPrice,
          deposit_amount: depositAmount,
          insurance_plan_id: insurancePlan.id,
          insurance_plan_name: insurancePlan.name,
          insurance_category: insurancePlan.category,
          insurance_price_per_day: insurancePlan.pricePerDay,
          insurance_deductible: insurancePlan.deductible,
          insurance_coverage: insurancePlan.coverageKey,
          insurance_total: insuranceTotal,
          driver_license_image_url: driverLicenseImageUrl,
          id_card_image_url: idCardImageUrl,
          booking_status: "PENDING",
          status: "PENDING",
        },
      ])
      .select()
      .single();

    if (error || !data) {
      return NextResponse.json({ error: error?.message || "Booking could not be created." }, { status: 500 });
    }

    const bookingToken = createBookingAccessToken(data.id, email);

    try {
      await sendPendingBookingEmail({
        to: email,
        firstName,
        carName: `${carRequirements.brand} ${carRequirements.model}`,
        bookingId: data.id,
        insurancePlanName: insurancePlan.name,
        insurancePricePerDay: insurancePlan.pricePerDay,
        insuranceDeductible: insurancePlan.deductible,
        pickupDate,
        pickupTime,
        returnDate,
        returnTime,
      });
    } catch (emailError) {
      console.error("EMAIL ERROR:", emailError);
    }

    await logAuditEvent({
      action: "booking_created",
      actorRole: "user",
      actorIdentifier: email,
      targetType: "booking",
      targetId: data.id,
      status: "success",
      details: `Booking created for ${carRequirements.brand} ${carRequirements.model}.`,
      req,
    });

    return NextResponse.json({
      success: true,
      booking: data,
      bookingToken,
    });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
