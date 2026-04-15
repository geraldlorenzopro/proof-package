import { describe, it, expect } from "vitest";

/**
 * Unit test for the isIncomplete detection logic used in IntakeWizard step 3.
 * This mirrors the exact logic from IntakeWizard.tsx lines 456-459.
 */

interface IntakeData {
  client_profile_id?: string;
  client_first_name?: string;
  client_last_name?: string;
  client_email?: string;
  client_phone?: string;
}

function shouldShowBanner(data: IntakeData): boolean {
  return !!(data.client_first_name || data.client_last_name || data.client_phone || data.client_profile_id);
}

function isIncomplete(data: IntakeData): boolean {
  return !!data.client_profile_id && (
    (!data.client_first_name && !data.client_last_name) || !data.client_email || !data.client_phone
  );
}

function displayName(data: IntakeData): string {
  return [data.client_first_name, data.client_last_name].filter(Boolean).join(" ") || data.client_phone || "Contacto";
}

describe("IntakeWizard isIncomplete logic", () => {
  it("shows banner + warning for contact with only phone (no name, no email)", () => {
    const data: IntakeData = {
      client_profile_id: "abc-123",
      client_phone: "+14064708387",
    };
    expect(shouldShowBanner(data)).toBe(true);
    expect(isIncomplete(data)).toBe(true);
    expect(displayName(data)).toBe("+14064708387");
  });

  it("shows banner + warning for contact with name but no email", () => {
    const data: IntakeData = {
      client_profile_id: "abc-123",
      client_first_name: "Laura",
      client_last_name: "Patricia",
      client_phone: "+1234567890",
    };
    expect(shouldShowBanner(data)).toBe(true);
    expect(isIncomplete(data)).toBe(true);
    expect(displayName(data)).toBe("Laura Patricia");
  });

  it("shows banner WITHOUT warning for complete contact", () => {
    const data: IntakeData = {
      client_profile_id: "abc-123",
      client_first_name: "Laura",
      client_last_name: "Patricia",
      client_email: "laura@test.com",
      client_phone: "+1234567890",
    };
    expect(shouldShowBanner(data)).toBe(true);
    expect(isIncomplete(data)).toBe(false);
  });

  it("does NOT show warning for new contact (no client_profile_id)", () => {
    const data: IntakeData = {
      client_first_name: "Nuevo",
      client_last_name: "Cliente",
    };
    expect(shouldShowBanner(data)).toBe(true);
    expect(isIncomplete(data)).toBe(false);
  });

  it("does NOT show banner when no data at all", () => {
    const data: IntakeData = {};
    expect(shouldShowBanner(data)).toBe(false);
  });

  it("shows banner for profile_id only (edge case)", () => {
    const data: IntakeData = {
      client_profile_id: "abc-123",
    };
    expect(shouldShowBanner(data)).toBe(true);
    expect(isIncomplete(data)).toBe(true);
    expect(displayName(data)).toBe("Contacto");
  });
});
