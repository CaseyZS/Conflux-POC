import { describe, expect, it } from "vitest";
import { parseTaskInput } from "./validate";

describe("parseTaskInput", () => {
  it("accepts a name with the checkbox checked", () => {
    const result = parseTaskInput({ name: "Development", defaultBillable: "on" });
    expect(result).toEqual({
      ok: true,
      data: { name: "Development", defaultBillable: true },
    });
  });

  it("treats an absent checkbox as unchecked", () => {
    const result = parseTaskInput({ name: "Meetings", defaultBillable: null });
    expect(result).toEqual({
      ok: true,
      data: { name: "Meetings", defaultBillable: false },
    });
  });

  it("trims the name", () => {
    const result = parseTaskInput({ name: "  Design  ", defaultBillable: "on" });
    expect(result.ok && result.data.name).toBe("Design");
  });

  it("rejects an empty name", () => {
    const result = parseTaskInput({ name: "", defaultBillable: "on" });
    expect(result).toEqual({
      ok: false,
      errors: { name: "Name is required." },
    });
  });

  it("rejects a whitespace-only name", () => {
    const result = parseTaskInput({ name: "   ", defaultBillable: null });
    expect(result.ok).toBe(false);
  });

  it("rejects a non-string name (e.g. a File from a crafted request)", () => {
    const result = parseTaskInput({ name: 42, defaultBillable: "on" });
    expect(result.ok).toBe(false);
  });
});
