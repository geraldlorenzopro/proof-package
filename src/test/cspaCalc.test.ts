import { describe, it, expect } from "vitest";

// Pure calculation logic extracted from CSPACalculator — must match exactly
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

// ─── Real Visa Bulletin reference (F2B Mexico cutoff: 15FEB2009) ───
// The visa_bulletin table returns FAD = 2024-10-01 for F2B/Mexico current bulletin.
// All tests below use real bulletin-aligned dates.

describe("CSPA Calculator", () => {
  // ── Scenario 1: F2B Mexico — does NOT qualify ──
  // PD 2005-06-01 < cutoff 15FEB2009 → visa IS available
  // VAD = 2024-10-01 (real bulletin FAD for F2B/Mexico)
  it("F2B Mexico not qualifying: DOB 2000-03-10, PD 2005-06-01, AD 2007-11-15, VAD 2024-10-01", () => {
    const r = calculateCSPA({
      dob: "2000-03-10",
      priorityDate: "2005-06-01",
      approvalDate: "2007-11-15",
      visaAvailableDate: "2024-10-01",
    });
    // Bio age: 2000-03-10 → 2024-10-01 = ~24.56 years
    // Pending: 2005-06-01 → 2007-11-15 = 898 days = ~2.46 years
    // CSPA = ~24.56 - 2.46 = ~22.10 → does NOT qualify
    expect(r.cspaAgeYears).toBeGreaterThan(21);
    expect(r.cspaAgeYears).toBeLessThan(23);
    expect(r.qualifies).toBe(false);
  });

  // ── Scenario 2: F2B Mexico — qualifies (matches UI screenshot: 16.69) ──
  // Derivative child born after PD, VAD from real bulletin
  it("F2B Mexico qualifying: DOB 2005-06-15, PD 2005-01-10, AD 2007-08-20, VAD 2024-10-01 → ~16.69", () => {
    const r = calculateCSPA({
      dob: "2005-06-15",
      priorityDate: "2005-01-10",
      approvalDate: "2007-08-20",
      visaAvailableDate: "2024-10-01",
    });
    // Bio age: 2005-06-15 → 2024-10-01 = ~19.30 years
    // Pending: 2005-01-10 → 2007-08-20 = 953 days = ~2.61 years
    // CSPA = ~19.30 - 2.61 = ~16.69 → qualifies ✅
    expect(r.cspaAgeYears).toBeGreaterThan(16.5);
    expect(r.cspaAgeYears).toBeLessThan(17);
    expect(r.qualifies).toBe(true);
  });

  // ── Scenario 3: Derivative child born AFTER PD — negative CSPA age ──
  it("Derivative child born after PD: DOB 2024-12-31, PD 2022-01-31, AD 2025-02-01, VAD 2026-03-08", () => {
    const r = calculateCSPA({
      dob: "2024-12-31",
      priorityDate: "2022-01-31",
      approvalDate: "2025-02-01",
      visaAvailableDate: "2026-03-08",
    });
    // Bio age: ~1.19 years, pending: ~3.00 years → CSPA negative
    expect(r.cspaAgeYears).toBeLessThan(0);
    expect(r.qualifies).toBe(true);
  });

  // ── Scenario 4: Age-frozen IR category ──
  it("Age-frozen IR: DOB 2005-03-15, PD 2025-01-10 → ~19.83 years", () => {
    const r = calculateCSPA({
      dob: "2005-03-15",
      priorityDate: "2025-01-10",
      approvalDate: "",
      visaAvailableDate: "",
      isFrozen: true,
    });
    // Age at PD: ~19.83 years
    expect(r.cspaAgeYears).toBeGreaterThan(19.5);
    expect(r.cspaAgeYears).toBeLessThan(20.5);
    expect(r.qualifies).toBe(true);
    expect(r.pendingTime).toBe(0);
  });

  // ── Scenario 5: Classic not qualifying — old beneficiary ──
  it("Does NOT qualify: DOB 1998-01-01, PD 2010-01-01, AD 2011-06-01, VAD 2025-01-01", () => {
    const r = calculateCSPA({
      dob: "1998-01-01",
      priorityDate: "2010-01-01",
      approvalDate: "2011-06-01",
      visaAvailableDate: "2025-01-01",
    });
    // Bio age ~27, pending ~1.4y → CSPA ~25.6 → does not qualify
    expect(r.cspaAgeYears).toBeGreaterThan(21);
    expect(r.qualifies).toBe(false);
  });

  // ── Scenario 6: Edge case — turns 21 exactly at CSPA cutoff ──
  it("Edge case: CSPA age exactly around 21", () => {
    // Craft dates so CSPA age ≈ 21.0
    // Bio age = 22 years, pending = 365 days = ~1 year → CSPA ≈ 21
    const r = calculateCSPA({
      dob: "2002-01-01",
      priorityDate: "2020-01-01",
      approvalDate: "2021-01-01",
      visaAvailableDate: "2024-01-01",
    });
    // Bio: 22.00y, Pending: 366d = 1.00y → CSPA ≈ 21.00
    expect(r.cspaAgeYears).toBeGreaterThan(20.5);
    expect(r.cspaAgeYears).toBeLessThan(21.5);
  });
});
