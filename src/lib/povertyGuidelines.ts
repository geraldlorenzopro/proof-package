// 2025 HHS Poverty Guidelines for Affidavit of Support (I-864P)
// Effective March 1, 2025

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
    base: [26437, 33312, 40187, 47062, 53937, 60812, 67687],
    additional: 6875,
  },
  alaska: {
    base: [33037, 41637, 50237, 58837, 67437, 76037, 84637],
    additional: 8600,
  },
  hawaii: {
    base: [30400, 38313, 46225, 54137, 62050, 69963, 77875],
    additional: 7913,
  },
};

// 100% Guidelines (for military sponsors petitioning spouse or child)
const GUIDELINES_100: Record<Region, { base: number[]; additional: number }> = {
  contiguous: {
    base: [21150, 26650, 32150, 37650, 43150, 48650, 54150],
    additional: 5500,
  },
  alaska: {
    base: [26430, 33310, 40190, 47070, 53950, 60830, 67710],
    additional: 6880,
  },
  hawaii: {
    base: [24320, 30650, 36980, 43310, 49640, 55970, 62300],
    additional: 6330,
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
