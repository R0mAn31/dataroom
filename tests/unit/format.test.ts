import { describe, expect, it } from "vitest";
import { formatBytes, formatItemCount } from "@/lib/format";

describe("formatBytes", () => {
  it("formats zero", () => {
    expect(formatBytes(0)).toBe("0 B");
  });

  it("formats bytes below 1 KB", () => {
    expect(formatBytes(512)).toBe("512 B");
  });

  it("formats kilobytes with one decimal", () => {
    expect(formatBytes(1536)).toBe("1.5 KB");
  });

  it("drops the decimal at 100+ units", () => {
    expect(formatBytes(150 * 1024)).toBe("150 KB");
  });

  it("formats megabytes and gigabytes", () => {
    expect(formatBytes(5 * 1024 * 1024)).toBe("5.0 MB");
    expect(formatBytes(2 * 1024 * 1024 * 1024)).toBe("2.0 GB");
  });
});

describe("formatItemCount", () => {
  it("uses the singular for exactly one item", () => {
    expect(formatItemCount(1)).toBe("1 item");
  });

  it("uses the plural otherwise", () => {
    expect(formatItemCount(0)).toBe("0 items");
    expect(formatItemCount(2)).toBe("2 items");
  });
});
