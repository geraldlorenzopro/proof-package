// 2026 HHS Poverty Guidelines for Affidavit of Support (I-864P)
// Effective March 1, 2026
// Source: https://www.uscis.gov/i-864p (Last reviewed 02/27/2026)

export type Region = "contiguous" | "alaska" | "hawaii";
export type SponsorType = "regular" | "military";
export type FilingStatus = "single" | "married" | "married_separately" | "head_of_household" | "qualifying_surviving_spouse";

export const REGION_LABELS: Record<Region, string> = {
  contiguous: "48 Estados + DC, Puerto Rico, Guam y USVI",
  alaska: "Alaska",
  hawaii: "Hawaii",
};

// 125% Guidelines (for all other sponsors — non-military)
const GUIDELINES_125: Record<Region, { base: number[]; additional: number }> = {
  contiguous: {
    base: [27050, 34150, 41250, 48350, 55450, 62550, 69650],
    additional: 7100,
  },
  alaska: {
    base: [33813, 42688, 51563, 60438, 69313, 78188, 87063],
    additional: 8875,
  },
  hawaii: {
    base: [31113, 39275, 47438, 55600, 63763, 71925, 80088],
    additional: 8163,
  },
};

// 100% Guidelines (for military sponsors petitioning spouse or child)
const GUIDELINES_100: Record<Region, { base: number[]; additional: number }> = {
  contiguous: {
    base: [21640, 27320, 33000, 38680, 44360, 50040, 55720],
    additional: 5680,
  },
  alaska: {
    base: [27050, 34150, 41250, 48350, 55450, 62550, 69650],
    additional: 7100,
  },
  hawaii: {
    base: [24890, 31420, 37950, 44480, 51010, 57540, 64070],
    additional: 6530,
  },
};

export function getRequiredIncome(
  householdSize: number,
  region: Region,
  sponsorType: SponsorType = "regular"
): number {
  const table = sponsorType === "military" ? GUIDELINES_100 : GUIDELINES_125;
  const g = table[region];
  if (householdSize < 2) householdSize = 2;
  if (householdSize <= 8) {
    return g.base[householdSize - 2];
  }
  return g.base[6] + (householdSize - 8) * g.additional;
}

export interface CalculatorResult {
  canSponsor: number;
  baseHousehold: number;
  finalHousehold: number;
  requiredForOne: number;
  requiredForMax: number;
  income: number;
  qualifies: boolean;
  deficit: number;
  breakdown: Array<{
    sponsored: number;
    householdSize: number;
    required: number;
    qualifies: boolean;
  }>;
}

export function calculateSponsorCapacity(
  income: number,
  filingStatus: FilingStatus,
  dependents: number,
  region: Region,
  sponsorType: SponsorType
): CalculatorResult {
  const spouseCount = filingStatus === "married" ? 1 : 0;
  const baseHousehold = 1 + spouseCount + dependents;
  const requiredForOne = getRequiredIncome(baseHousehold + 1, region, sponsorType);

  let canSponsor = 0;
  const breakdown: CalculatorResult["breakdown"] = [];

  for (let n = 1; n <= 20; n++) {
    const totalHousehold = baseHousehold + n;
    const required = getRequiredIncome(totalHousehold, region, sponsorType);
    const qualifies = income >= required;
    breakdown.push({ sponsored: n, householdSize: totalHousehold, required, qualifies });
    if (qualifies) {
      canSponsor = n;
    } else {
      break;
    }
  }

  const finalHousehold = baseHousehold + canSponsor;
  const requiredForMax =
    canSponsor > 0
      ? getRequiredIncome(finalHousehold, region, sponsorType)
      : requiredForOne;

  return {
    canSponsor,
    baseHousehold,
    finalHousehold,
    requiredForOne,
    requiredForMax,
    income,
    qualifies: canSponsor > 0,
    deficit: Math.max(0, requiredForOne - income),
    breakdown: breakdown.slice(0, Math.min(canSponsor + 2, breakdown.length)),
  };
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);
}
