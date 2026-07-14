import Role, { ROLE_NAMES } from "../models/Role.js";
import User from "../models/User.js";
import StaffProfile from "../models/StaffProfile.js";
import Booking from "../models/Booking.js";
import Customer from "../models/Customer.js";
import CommissionEntry from "../models/CommissionEntry.js";
import ServiceMaster from "../models/ServiceMaster.js";
import { hashPassword } from "../services/userService.js";
import { seedDefaultBranch } from "./branchSeed.js";
import { DEV_STYLIST_CONFIG } from "./demoStaffEarningsSeed.js";

export const DASHBOARD_DEMO_NOTE = "dashboard-demo";
const DEMO_CUSTOMER_PHONE_PREFIX = "9100000";

const EXTRA_STYLISTS = [
  {
    name: "Priya Desai",
    phone: "7777777771",
    email: "priya.stylist@salon.dev",
    password: "Stylist@123",
    designation: "Color Specialist",
    specialization: ["hair", "color"],
  },
  {
    name: "Rahul Verma",
    phone: "7777777772",
    email: "rahul.stylist@salon.dev",
    password: "Stylist@123",
    designation: "Spa Therapist",
    specialization: ["spa", "massage"],
  },
];

const SERVICE_CATALOG = [
  { label: "Women's Haircut", duration: 45, weight: 24, price: 700 },
  { label: "Men's Haircut", duration: 30, weight: 20, price: 400 },
  { label: "Premium Facial", duration: 60, weight: 18, price: 1500 },
  { label: "Blow Dry & Styling", duration: 30, weight: 15, price: 600 },
  { label: "Hair Color (Global)", duration: 90, weight: 12, price: 3000 },
  { label: "Manicure", duration: 35, weight: 10, price: 500 },
  { label: "Full Body Massage", duration: 60, weight: 8, price: 2000 },
  { label: "Basic Cleanup", duration: 45, weight: 7, price: 800 },
  { label: "Pedicure", duration: 45, weight: 6, price: 700 },
  { label: "Head Massage", duration: 30, weight: 5, price: 400 },
];

const SALES_INVOICE_PREFIX = "DASH-";

const CUSTOMER_NAMES = [
  "Ananya Sharma",
  "Neha Kapoor",
  "Riya Mehta",
  "Pooja Nair",
  "Kavya Iyer",
  "Sneha Reddy",
  "Aisha Khan",
  "Meera Joshi",
  "Divya Pillai",
  "Tanvi Shah",
  "Ishita Bose",
  "Nandini Rao",
  "Shruti Menon",
  "Aditi Chawla",
  "Lakshmi Nambiar",
  "Zara Sheikh",
  "Simran Kaur",
  "Fatima Ali",
  "Gauri Deshmukh",
  "Pallavi Sinha",
  "Arjun Malhotra",
  "Vikram Singh",
  "Rohan Gupta",
  "Karan Patel",
  "Amit Dubey",
  "Suresh Nair",
  "Deepak Mehta",
  "Nikhil Rao",
  "Sanjay Iyer",
  "Manish Kapoor",
  "Vivek Sharma",
  "Harsh Verma",
  "Yash Joshi",
  "Abhishek Das",
  "Rahul Chatterjee",
  "Siddharth Banerjee",
  "Kunal Agarwal",
  "Varun Khanna",
  "Tarun Bhatia",
  "Gaurav Saxena",
];

const LAST_SEVEN_DAY_COUNTS = [4, 7, 5, 9, 6, 11, 8];

function startOfDay(date = new Date()) {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
}

function addDays(date, days) {
  const value = new Date(date);
  value.setDate(value.getDate() + days);
  return value;
}

function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

function atTime(baseDate, hour, minute = 0) {
  const value = new Date(baseDate);
  value.setHours(hour, minute, 0, 0);
  return value;
}

function pickWeightedService() {
  const totalWeight = SERVICE_CATALOG.reduce((sum, item) => sum + item.weight, 0);
  let roll = Math.random() * totalWeight;

  for (const service of SERVICE_CATALOG) {
    roll -= service.weight;
    if (roll <= 0) {
      return service;
    }
  }

  return SERVICE_CATALOG[0];
}

function statusForDayOffset(dayOffset) {
  if (dayOffset > 0) {
    return "booked";
  }

  if (dayOffset === 0) {
    const roll = Math.random();
    if (roll < 0.35) return "completed";
    if (roll < 0.55) return "in_progress";
    if (roll < 0.85) return "confirmed";
    return "cancelled";
  }

  const roll = Math.random();
  if (roll < 0.82) return "completed";
  if (roll < 0.92) return "cancelled";
  return "no_show";
}

function bookingsNeededForDay(dayOffset) {
  if (dayOffset >= -6 && dayOffset <= 0) {
    return LAST_SEVEN_DAY_COUNTS[dayOffset + 6];
  }

  if (dayOffset > 0 && dayOffset <= 7) {
    return 3 + Math.floor(Math.random() * 4);
  }

  return 3 + Math.floor(Math.random() * 8);
}

async function ensureExtraStylists(branch, stylistRole) {
  const profiles = [];

  for (const stylistDef of EXTRA_STYLISTS) {
    const password_hash = await hashPassword(stylistDef.password);

    const user = await User.findOneAndUpdate(
      { phone: stylistDef.phone },
      {
        name: stylistDef.name,
        phone: stylistDef.phone,
        email: stylistDef.email,
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
        designation: stylistDef.designation,
        specialization: stylistDef.specialization,
        base_salary: 16000,
        joining_date: addDays(new Date(), -120),
        is_active: true,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    profiles.push(profile);
  }

  return profiles;
}

async function seedDemoCustomers(staffProfiles) {
  await Customer.deleteMany({
    phone: { $regex: `^${DEMO_CUSTOMER_PHONE_PREFIX}` },
  });

  const customers = CUSTOMER_NAMES.map((name, index) => {
    const phone = `${DEMO_CUSTOMER_PHONE_PREFIX}${String(101 + index).padStart(3, "0")}`;
    const createdDaysAgo = index % 14;

    return {
      name,
      phone,
      gender: index % 3 === 0 ? "male" : "female",
      preferred_stylist_id: staffProfiles[index % staffProfiles.length]._id,
      notes: DASHBOARD_DEMO_NOTE,
      createdAt: startOfDay(addDays(new Date(), -createdDaysAgo)),
      updatedAt: startOfDay(addDays(new Date(), -createdDaysAgo)),
    };
  });

  return Customer.insertMany(customers);
}

function buildDemoBookings({ branch, staffProfiles, customers, serviceByLabel }) {
  const bookings = [];
  let customerIndex = 0;

  for (let dayOffset = -29; dayOffset <= 7; dayOffset += 1) {
    const count = bookingsNeededForDay(dayOffset);

    for (let slot = 0; slot < count; slot += 1) {
      const service = pickWeightedService();
      const serviceDoc = serviceByLabel.get(service.label);

      if (!serviceDoc) {
        continue;
      }

      const customer = customers[customerIndex % customers.length];
      customerIndex += 1;

      const staff = staffProfiles[slot % staffProfiles.length];
      const hour = 9 + (slot % 9);
      const minute = (slot % 4) * 15;
      const startTime = atTime(addDays(new Date(), dayOffset), hour, minute);

      bookings.push({
        customer_id: customer._id,
        stylist_id: staff._id,
        service_ids: [serviceDoc._id],
        branch_id: branch._id,
        booking_date: startOfDay(startTime),
        start_time: startTime,
        end_time: addMinutes(startTime, service.duration),
        status: statusForDayOffset(dayOffset),
        source: "internal",
        notes: DASHBOARD_DEMO_NOTE,
      });
    }
  }

  return bookings;
}

function randomTime(baseDate) {
  const hour = 9 + Math.floor(Math.random() * 10);
  const minute = Math.floor(Math.random() * 60);
  return atTime(baseDate, hour, minute);
}

/**
 * Invoiced sales history (CommissionEntry.line_amount) from Jan 1 to today so
 * the dashboard can show year-to-date, month-to-date, and today's sales.
 */
function buildDemoSalesHistory(staffProfiles) {
  const entries = [];
  const today = startOfDay();
  let sequence = 1000;

  for (
    let cursor = new Date(today.getFullYear(), 0, 1);
    cursor <= today;
    cursor = addDays(cursor, 1)
  ) {
    const isWeekend = [0, 6].includes(cursor.getDay());
    const baseCount = isWeekend ? 4 : 3;
    const count = baseCount + Math.floor(Math.random() * 2);

    for (let slot = 0; slot < count; slot += 1) {
      const service = pickWeightedService();
      const staff = staffProfiles[sequence % staffProfiles.length];
      sequence += 1;

      entries.push({
        staff_id: staff._id,
        service_label: service.label,
        line_amount: service.price,
        commission_amount: Math.round(service.price * 0.2),
        calculated_at: randomTime(cursor),
        invoice_reference: `${SALES_INVOICE_PREFIX}${sequence}`,
      });
    }
  }

  return entries;
}

/**
 * Rich booking + customer history for dashboard charts (7-day trend, bar, doughnut).
 */
export async function seedDemoDashboard() {
  const branch = await seedDefaultBranch();
  const stylistRole = await Role.findOne({ name: ROLE_NAMES.STYLIST });

  if (!stylistRole) {
    throw new Error("Stylist role not found — run npm run seed:dev first");
  }

  const primaryStylistUser = await User.findOne({ phone: DEV_STYLIST_CONFIG.phone });

  if (!primaryStylistUser) {
    throw new Error("Demo stylist missing — run demo staff earnings seed first");
  }

  const primaryProfile = await StaffProfile.findOne({ user_id: primaryStylistUser._id });

  if (!primaryProfile) {
    throw new Error("Demo stylist profile missing — run demo staff earnings seed first");
  }

  const extraProfiles = await ensureExtraStylists(branch, stylistRole);
  const staffProfiles = [primaryProfile, ...extraProfiles];

  await Booking.deleteMany({ notes: DASHBOARD_DEMO_NOTE });

  const customers = await seedDemoCustomers(staffProfiles);
  const serviceDocs = await ServiceMaster.find({
    name: { $in: SERVICE_CATALOG.map((service) => service.label) },
  }).select("name duration_minutes price");
  const serviceByLabel = new Map(
    serviceDocs.map((service) => [service.name, service])
  );

  const bookingPayload = buildDemoBookings({
    branch,
    staffProfiles,
    customers,
    serviceByLabel,
  });

  const bookings = await Booking.insertMany(bookingPayload);

  await CommissionEntry.deleteMany({
    invoice_reference: { $regex: `^${SALES_INVOICE_PREFIX}` },
  });

  const salesPayload = buildDemoSalesHistory(staffProfiles);
  const salesEntries = await CommissionEntry.insertMany(salesPayload);

  const lastSevenCounts = LAST_SEVEN_DAY_COUNTS;

  return {
    staffProfiles,
    customers,
    bookings,
    salesEntries,
    counts: {
      stylists: staffProfiles.length,
      customers: customers.length,
      bookings: bookings.length,
      salesEntries: salesEntries.length,
      lastSevenDayBookings: lastSevenCounts.reduce((sum, value) => sum + value, 0),
    },
  };
}

export default seedDemoDashboard;
