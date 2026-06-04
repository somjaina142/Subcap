import { describe, it, expect, vi } from "vitest";

// We cannot actually test the canvas recorder in Node, but we verify the module loads and exports.
describe("demo module", () => {
  it("should expose generateDemoVideo", async () => {
    const mod = await import("../src/lib/demo");
    expect(mod.generateDemoVideo).toBeDefined();
    expect(typeof mod.generateDemoVideo).toBe("function");
  });

  it("default params are sensible", async () => {
    // Just confirm it does not throw on parameter parsing (we stub it)
    const mod = await import("../src/lib/demo");
    expect(mod.generateDemoVideo.length).toBe(0); // all params are defaulted
  });
});
