import { seedDemoServicesAndProducts } from "./demoServicesProductsSeed.js";
import { seedDemoStaffAndShifts } from "./demoStaffShiftSeed.js";

/**
 * Optional demo masters for local UI development (row 25).
 * Arnav: services + products. Precious: staff + shifts (stub for now).
 */
export async function seedDemoData() {
  const servicesProducts = await seedDemoServicesAndProducts();
  const staffShifts = await seedDemoStaffAndShifts();

  return {
    servicesProducts,
    staffShifts,
    counts: {
      categories: servicesProducts.counts.categories,
      services: servicesProducts.counts.services,
      products: servicesProducts.counts.products,
      staff: staffShifts.counts.staff,
      shifts: staffShifts.counts.shifts,
      commissionSlabs: staffShifts.counts.commissionSlabs,
    },
  };
}

export default seedDemoData;
