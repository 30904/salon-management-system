import { seedDemoServicesAndProducts } from "./demoServicesProductsSeed.js";
import { seedDemoStaffAndShifts } from "./demoStaffShiftSeed.js";
import { seedDemoStaffEarnings } from "./demoStaffEarningsSeed.js";

/**
 * Optional demo masters for local UI development (row 25).
 * Arnav: services + products + staff earnings demo. Precious: staff + shifts (stub for now).
 */
export async function seedDemoData() {
  const servicesProducts = await seedDemoServicesAndProducts();
  const staffShifts = await seedDemoStaffAndShifts();
  const staffEarnings = await seedDemoStaffEarnings();

  return {
    servicesProducts,
    staffShifts,
    staffEarnings,
    counts: {
      categories: servicesProducts.counts.categories,
      services: servicesProducts.counts.services,
      products: servicesProducts.counts.products,
      staff: staffShifts.counts.staff + 1,
      shifts: staffShifts.counts.shifts,
      commissionSlabs: staffShifts.counts.commissionSlabs,
      commissionEntries: staffEarnings.counts.entries,
      bookings: staffEarnings.counts.bookings,
    },
  };
}

export default seedDemoData;
