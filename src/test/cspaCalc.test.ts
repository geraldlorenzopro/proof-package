import { describe, it, expect } from "vitest";

// Pure calculation logic extracted from CSPACalculator
function diffInDays(a: Date, b: Date): number {
  return Math.floor((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

function daysToYears(days: number): number {
  return days / 365.25;
}

function calculateCSPA(params: {
  dob: string;
  priorityDate: string;
  approvalDate: string;
  visaAvailableDate: string;
  isFrozen?: boolean;
}) {
  const dob = new Date(params.dob);
  const pd = new Date(params.priorityDate);
  const ad = new Date(params.approvalDate);
  const vad = new Date(params.visaAvailableDate);

  let biologicalAge: number, pendingTime: number, cspaAgeDays: number, cspaAgeYears: number;

  if (params.isFrozen) {
    biologicalAge = diffInDays(dob, pd);
    pendingTime = 0;
    cspaAgeDays = biologicalAge;
    cspaAgeYears = daysToYears(cspaAgeDays);
  } else {
    biologicalAge = diffInDays(dob, vad);
    pendingTime = diffInDays(pd, ad);
    cspaAgeDays = biologicalAge - pendingTime;
    cspaAgeYears = daysToYears(cspaAgeDays);
  }

  return { biologicalAge, pendingTime, cspaAgeDays, cspaAgeYears, qualifies: cspaAgeYears < 21 };
}

describe("CSPA Calculator", () => {
  it("F2B Mexico normal case: DOB 2003-06-15, PD 2010-01-20, AD 2012-08-10, VAD 2024-03-01", () => {
    const r = calculateCSPA({
      dob: "2003-06-15",
      priorityDate: "2010-01-20",
      approvalDate: "2012-08-10",
      visaAvailableDate: "2024-03-01",
    });
    // Biological age at visa available: ~20.7 years
    expect(r.biologicalAge).toBeGreaterThan(7500);
    // Pending time: ~933 days (2010-01-20 to 2012-08-10)
    expect(r.pendingTime).toBeGreaterThan(900);
    expect(r.pendingTime).toBeLessThan(970);
    // CSPA age should be well under 21
    expect(r.cspaAgeYears).toBeLessThan(21);
    expect(r.qualifies).toBe(true);
    console.log("F2B Mexico result:", {
      biologicalAgeDays: r.biologicalAge,
      biologicalAgeYears: daysToYears(r.biologicalAge).toFixed(2),
      pendingTimeDays: r.pendingTime,
      pendingTimeYears: daysToYears(r.pendingTime).toFixed(2),
      cspaAgeDays: r.cspaAgeDays,
      cspaAgeYears: r.cspaAgeYears.toFixed(2),
      qualifies: r.qualifies,
    });
  });

  it("Derivative child born after PD: F1, DOB 2024-12-31, PD 2022-01-31, AD 2025-02-01", () => {
    const r = calculateCSPA({
      dob: "2024-12-31",
      priorityDate: "2022-01-31",
      approvalDate: "2025-02-01",
      visaAvailableDate: "2026-03-08", // today
    });
    // Biological age: ~1.2 years, pending time: ~3 years → negative CSPA age
    expect(r.cspaAgeYears).toBeLessThan(0);
    expect(r.qualifies).toBe(true);
    console.log("Derivative child result:", {
      biologicalAgeYears: daysToYears(r.biologicalAge).toFixed(2),
      pendingTimeYears: daysToYears(r.pendingTime).toFixed(2),
      cspaAgeYears: r.cspaAgeYears.toFixed(2),
      qualifies: r.qualifies,
    });
  });

  it("Age-frozen IR category: DOB 2005-03-15, PD 2025-01-10", () => {
    const r = calculateCSPA({
      dob: "2005-03-15",
      priorityDate: "2025-01-10",
      approvalDate: "",
      visaAvailableDate: "",
      isFrozen: true,
    });
    // Age at PD: ~19.8 years
    expect(r.cspaAgeYears).toBeGreaterThan(19);
    expect(r.cspaAgeYears).toBeLessThan(21);
    expect(r.qualifies).toBe(true);
    expect(r.pendingTime).toBe(0);
    console.log("IR frozen result:", {
      cspaAgeYears: r.cspaAgeYears.toFixed(2),
      qualifies: r.qualifies,
    });
  });

  it("Does NOT qualify: F2B, DOB 1998-01-01, PD 2010-01-01, AD 2011-06-01, VAD 2025-01-01", () => {
    const r = calculateCSPA({
      dob: "1998-01-01",
      priorityDate: "2010-01-01",
      approvalDate: "2011-06-01",
      visaAvailableDate: "2025-01-01",
    });
    // Bio age ~27, pending ~1.4y → CSPA ~25.6 → does not qualify
    expect(r.cspaAgeYears).toBeGreaterThan(21);
    expect(r.qualifies).toBe(false);
    console.log("Not qualifying result:", {
      cspaAgeYears: r.cspaAgeYears.toFixed(2),
      qualifies: r.qualifies,
    });
  });
});
