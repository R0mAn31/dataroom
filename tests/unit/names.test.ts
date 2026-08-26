import { describe, expect, it } from "vitest";
import {
  isValidName,
  nextAvailableName,
  normalizeName,
  splitName,
} from "@/lib/names";

describe("splitName", () => {
  it("splits a file name into base and extension", () => {
    expect(splitName("report.pdf", true)).toEqual({ base: "report", ext: ".pdf" });
  });

  it("keeps the whole name as base when there is no extension", () => {
    expect(splitName("report", true)).toEqual({ base: "report", ext: "" });
  });

  it("does not treat a leading dot as an extension separator", () => {
    expect(splitName(".gitignore", true)).toEqual({ base: ".gitignore", ext: "" });
  });

  it("never splits folder names", () => {
    expect(splitName("Q1.2024", false)).toEqual({ base: "Q1.2024", ext: "" });
  });
});

describe("nextAvailableName", () => {
  it("returns the name unchanged when it's free", () => {
    expect(nextAvailableName("report.pdf", new Set(), true)).toBe("report.pdf");
  });

  it("suffixes a taken file name before the extension", () => {
    const taken = new Set(["report.pdf"]);
    expect(nextAvailableName("report.pdf", taken, true)).toBe("report (2).pdf");
  });

  it("keeps incrementing past existing numbered siblings", () => {
    const taken = new Set(["report.pdf", "report (2).pdf", "report (3).pdf"]);
    expect(nextAvailableName("report.pdf", taken, true)).toBe("report (4).pdf");
  });

  it("bumps from the existing suffix instead of restarting at 2", () => {
    const taken = new Set(["report (2).pdf", "report (3).pdf"]);
    expect(nextAvailableName("report (2).pdf", taken, true)).toBe("report (4).pdf");
  });

  it("suffixes folder names without an extension", () => {
    const taken = new Set(["new folder"]);
    expect(nextAvailableName("New folder", taken, false)).toBe("New folder (2)");
  });

  it("is case-insensitive against the taken set", () => {
    const taken = new Set(["report.pdf"]);
    expect(nextAvailableName("REPORT.PDF", taken, true)).toBe("REPORT (2).PDF");
  });
});

describe("normalizeName", () => {
  it("trims and collapses internal whitespace", () => {
    expect(normalizeName("  Deal   Room  ")).toBe("Deal Room");
  });
});

describe("isValidName", () => {
  it("rejects empty names", () => {
    expect(isValidName("")).toBe(false);
  });

  it("rejects names containing a path separator", () => {
    expect(isValidName("a/b")).toBe(false);
  });

  it("rejects names over 255 characters", () => {
    expect(isValidName("a".repeat(256))).toBe(false);
  });

  it("accepts an ordinary name", () => {
    expect(isValidName("Acquisition overview.pdf")).toBe(true);
  });
});
