import { seedDemoServicesAndProducts } from "./demoServicesProductsSeed.js";
import { seedDemoStaffAndShifts } from "./demoStaffShiftSeed.js";
import { seedDemoStaffEarnings } from "./demoStaffEarningsSeed.js";
import { seedDemoDashboard } from "./demoDashboardSeed.js";

/**
 * Optional demo masters for local UI development (row 25).
 * Arnav: services + products + staff earnings + dashboard chart data.
 * Precious: staff + shifts (stub for now).
 */
export async function seedDemoData() {
  const servicesProducts = await seedDemoServicesAndProducts();
  const staffShifts = await seedDemoStaffAndShifts();
  const staffEarnings = await seedDemoStaffEarnings();
  const dashboard = await seedDemoDashboard();

  return {
    servicesProducts,
    staffShifts,
    staffEarnings,
    dashboard,
    counts: {
      categories: servicesProducts.counts.categories,
      services: servicesProducts.counts.services,
      products: servicesProducts.counts.products,
      staff: staffShifts.counts.staff + dashboard.counts.stylists,
      shifts: staffShifts.counts.shifts,
      commissionSlabs: staffShifts.counts.commissionSlabs,
      commissionEntries: staffEarnings.counts.entries,
      bookings: staffEarnings.counts.bookings + dashboard.counts.bookings,
      dashboardCustomers: dashboard.counts.customers,
      dashboardBookings: dashboard.counts.bookings,
    },
  };
}

export default seedDemoData;
