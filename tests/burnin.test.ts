import { describe, it, expect } from "vitest";

describe("Burn-in module", () => {
  it("exports expected functions", async () => {
    const mod = await import("../src/lib/burnin");
    expect(typeof mod.exportBurnIn).toBe("function");
    expect(typeof mod.downloadBlob).toBe("function");
  });
});
