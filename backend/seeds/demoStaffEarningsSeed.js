import Role, { ROLE_NAMES } from "../models/Role.js";
import User from "../models/User.js";
import StaffProfile from "../models/StaffProfile.js";
import CommissionEntry from "../models/CommissionEntry.js";
import Booking from "../models/Booking.js";
import { hashPassword } from "../services/userService.js";
import { seedDefaultBranch } from "./branchSeed.js";

export const DEV_STYLIST_CONFIG = {
  name: "Demo Stylist",
  phone: "8888888888",
  email: "stylist@salon.dev",
  password: "Stylist@123",
};

function daysAgo(days) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  date.setHours(11, 30, 0, 0);
  return date;
}

function daysFromNow(days, hour, minute = 0) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(hour, minute, 0, 0);
  return date;
}

function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

/**
 * Demo stylist user, staff profile, calendar bookings, and earnings data.
 */
export async function seedDemoStaffEarnings() {
  const branch = await seedDefaultBranch();
  const stylistRole = await Role.findOne({ name: ROLE_NAMES.STYLIST });

  if (!stylistRole) {
    throw new Error("Stylist role not found — run npm run seed:dev first");
  }

  const password_hash = await hashPassword(DEV_STYLIST_CONFIG.password);

  const user = await User.findOneAndUpdate(
    { phone: DEV_STYLIST_CONFIG.phone },
    {
      name: DEV_STYLIST_CONFIG.name,
      phone: DEV_STYLIST_CONFIG.phone,
      email: DEV_STYLIST_CONFIG.email,
      password_hash,
      role_id: stylistRole._id,
      branch_id: branch._id,
      is_active: true,
      created_by: null,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  const profile = await StaffProfile.findOneAndUpdate(
    { user_id: user._id },
    {
      user_id: user._id,
      designation: "Senior Stylist",
      specialization: ["hair", "bridal"],
      base_salary: 18000,
      joining_date: new Date(new Date().getFullYear(), 0, 15),
      is_active: true,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  await Booking.deleteMany({ staff_id: profile._id });
  await CommissionEntry.deleteMany({ staff_id: profile._id });

  const demoBookings = [
    {
      customer_name: "Ananya Sharma",
      customer_phone: "9000000001",
      service_label: "Haircut + Blowdry",
      start_time: daysFromNow(0, 11, 0),
      duration_minutes: 60,
      status: "scheduled",
      notes: "Prefers senior stylist.",
    },
    {
      customer_name: "Neha Kapoor",
      customer_phone: "9000000002",
      service_label: "Hair Color Consultation",
      start_time: daysFromNow(0, 14, 30),
      duration_minutes: 45,
      status: "checked_in",
      notes: "Patch test already completed.",
    },
    {
      customer_name: "Riya Mehta",
      customer_phone: "9000000003",
      service_label: "Bridal Trial",
      start_time: daysFromNow(1, 12, 0),
      duration_minutes: 120,
      status: "scheduled",
      notes: "Carry reference photos.",
    },
    {
      customer_name: "Pooja Nair",
      customer_phone: "9000000004",
      service_label: "Keratin Treatment",
      start_time: daysFromNow(3, 10, 30),
      duration_minutes: 150,
      status: "scheduled",
      notes: null,
    },
  ];

  const bookings = await Booking.insertMany(
    demoBookings.map((booking) => ({
      customer_name: booking.customer_name,
      customer_phone: booking.customer_phone,
      service_label: booking.service_label,
      staff_id: profile._id,
      branch_id: branch._id,
      start_time: booking.start_time,
      end_time: addMinutes(booking.start_time, booking.duration_minutes),
      status: booking.status,
      notes: booking.notes,
    }))
  );

  const demoEntries = [
    {
      service_label: "Haircut + Blowdry",
      invoice_reference: "INV-2407-101",
      line_amount: 1800,
      commission_amount: 360,
      calculated_at: daysAgo(2),
    },
    {
      service_label: "Hair Color",
      invoice_reference: "INV-2407-098",
      line_amount: 4200,
      commission_amount: 840,
      calculated_at: daysAgo(4),
    },
    {
      service_label: "Bridal Trial",
      invoice_reference: "INV-2407-090",
      line_amount: 6500,
      commission_amount: 1300,
      calculated_at: daysAgo(7),
    },
    {
      service_label: "Keratin Treatment",
      invoice_reference: "INV-2407-081",
      line_amount: 5500,
      commission_amount: 1100,
      calculated_at: daysAgo(10),
    },
    {
      service_label: "Hair Spa",
      invoice_reference: "INV-2407-072",
      line_amount: 2200,
      commission_amount: 440,
      calculated_at: daysAgo(14),
    },
  ];

  const entries = await CommissionEntry.insertMany(
    demoEntries.map((entry) => ({
      ...entry,
      staff_id: profile._id,
    }))
  );

  return {
    user,
    profile,
    bookings,
    entries,
    counts: {
      bookings: bookings.length,
      entries: entries.length,
    },
    config: DEV_STYLIST_CONFIG,
  };
}

export default seedDemoStaffEarnings;
