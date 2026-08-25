/**
 * Unit tests for target-hit + Raksha salon commission bonuses.
 *
 * Usage:
 *   npm run test:target-commission
 */
import {
  calculateTargetCommissionBonuses,
  calculateManagerSalonBonus,
  isManagerForSalonBonus,
} from "../services/targetCommissionService.js";
import {
  TARGET_COMMISSION_RATE,
  MANAGER_SALON_TARGET_1,
  MANAGER_SALON_TARGET_2,
  MANAGER_SALON_RATE_1,
  MANAGER_SALON_RATE_2,
  SALON_BONUS_STAFF_NAME_MATCH,
} from "../constants/payrollConstants.js";

function assertEq(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${expected}, got ${actual}`);
  }
  console.log(`  PASS: ${label}`);
}

function assert(cond, label) {
  if (!cond) throw new Error(label);
  console.log(`  PASS: ${label}`);
}

console.log("[test] Target commission bonuses\n");

assertEq(TARGET_COMMISSION_RATE, 0.1, "rate is 10%");
assertEq(MANAGER_SALON_TARGET_1, 900000, "manager T1 is 9L");
assertEq(MANAGER_SALON_TARGET_2, 1200000, "manager T2 is 12L");
assertEq(MANAGER_SALON_RATE_1, 0.01, "manager rate 1 is 1%");
assertEq(MANAGER_SALON_RATE_2, 0.02, "manager rate 2 is 2%");
assertEq(SALON_BONUS_STAFF_NAME_MATCH, "raksha", "salon bonus only for Raksha");

const miss = calculateTargetCommissionBonuses({
  salesAchieved: 40000,
  target1Amount: 50000,
  target2Amount: 70000,
});
assertEq(miss.target_1_hit, false, "below T1 → T1 not hit");
assertEq(miss.target_2_hit, false, "below T1 → T2 not hit");
assertEq(miss.target_1_bonus, 0, "below T1 → T1 bonus 0");
assertEq(miss.target_commission_total, 0, "below T1 → total bonus 0");
assertEq(miss.bonus_basis, "staff_target", "staff bonus_basis");

const hitT1 = calculateTargetCommissionBonuses({
  salesAchieved: 50000,
  target1Amount: 50000,
  target2Amount: 70000,
});
assert(hitT1.target_1_hit, "exactly T1 → T1 hit");
assertEq(hitT1.target_2_hit, false, "exactly T1 → T2 not hit");
assertEq(hitT1.target_1_bonus, 5000, "T1 hit → 10% of 50000 = 5000");
assertEq(hitT1.target_2_bonus, 0, "T1 only → T2 bonus 0");
assertEq(hitT1.target_commission_total, 5000, "T1 only → total 5000");

const hitBoth = calculateTargetCommissionBonuses({
  salesAchieved: 80000,
  target1Amount: 50000,
  target2Amount: 70000,
});
assert(hitBoth.target_2_hit, "above T2 → T2 hit");
assertEq(hitBoth.target_1_hit, false, "above T2 → T1 bonus not paid (replaced by T2)");
assertEq(hitBoth.target_1_bonus, 0, "T2 hit → T1 bonus 0");
assertEq(hitBoth.target_2_bonus, 7000, "T2 hit → 10% of 70000 = 7000");
assertEq(hitBoth.target_commission_total, 7000, "T2 hit → total is T2 only (7000)");

const zeroTargets = calculateTargetCommissionBonuses({
  salesAchieved: 999999,
  target1Amount: 0,
  target2Amount: 0,
});
assertEq(zeroTargets.target_commission_total, 0, "zero targets → no bonus even with sales");

console.log("\n[test] Raksha salon bonuses\n");

assert(isManagerForSalonBonus({}, "Raksha"), "Raksha → salon bonus");
assert(isManagerForSalonBonus({}, "Raksha Sharma"), "Raksha full name → salon bonus");
assert(
  !isManagerForSalonBonus({ designation: "Front Manager" }, "Mansi Govalkar"),
  "Mansi Front Manager → no salon bonus"
);
assert(
  !isManagerForSalonBonus({ designation: "Manager" }, "Someone Else"),
  "other manager → no salon bonus"
);
assert(
  !isManagerForSalonBonus({ designation: "Senior Stylist" }, "Sarang Devkar"),
  "stylist → no salon bonus"
);

const mgrMiss = calculateManagerSalonBonus({ salonSales: 800000 });
assertEq(mgrMiss.target_1_hit, false, "salon below 9L → T1 not hit");
assertEq(mgrMiss.target_commission_total, 0, "salon below 9L → bonus 0");
assertEq(mgrMiss.bonus_basis, "manager_salon", "manager bonus_basis");

const mgrT1 = calculateManagerSalonBonus({ salonSales: 900000 });
assert(mgrT1.target_1_hit, "salon exactly 9L → T1 hit");
assertEq(mgrT1.target_2_hit, false, "salon 9L → T2 not hit");
assertEq(mgrT1.target_1_bonus, 9000, "9L → 1% = 9000");
assertEq(mgrT1.target_commission_total, 9000, "9L total bonus 9000");

const mgrMid = calculateManagerSalonBonus({ salonSales: 1050000 });
assert(mgrMid.target_1_hit, "salon 10.5L → T1 hit");
assertEq(mgrMid.target_1_bonus, 10500, "10.5L → 1% of actual sales = 10500");
assertEq(mgrMid.target_2_bonus, 0, "10.5L → no 2% tier");

const mgrT2 = calculateManagerSalonBonus({ salonSales: 1200000 });
assert(mgrT2.target_2_hit, "salon 12L → T2 hit");
assertEq(mgrT2.target_1_hit, false, "salon 12L → T1 replaced");
assertEq(mgrT2.target_1_bonus, 0, "12L → 1% not paid");
assertEq(mgrT2.target_2_bonus, 24000, "12L → 2% = 24000");
assertEq(mgrT2.target_commission_total, 24000, "12L total is 2% only");

const mgrAbove = calculateManagerSalonBonus({ salonSales: 1500000 });
assertEq(mgrAbove.target_2_bonus, 30000, "15L → 2% of actual = 30000");
assertEq(mgrAbove.target_commission_total, 30000, "15L total 30000 (not 1%+2%)");

console.log("\n[test] All target commission unit tests passed.\n");
