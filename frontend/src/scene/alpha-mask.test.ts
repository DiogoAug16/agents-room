import { describe, expect, it } from "vitest";
import { clearEdgeConnectedBackdrop } from "./alpha-mask";

describe("clearEdgeConnectedBackdrop", () => {
  it("clears edge-connected checkerboard without clearing a bordered object", () => {
    const pixels = new Uint8ClampedArray(3 * 3 * 4).fill(255);
    for (let index = 0; index < 9; index++) pixels.set([195, 195, 195, 255], index * 4);
    pixels.set([40, 40, 40, 255], 4 * 4);
    clearEdgeConnectedBackdrop(3, 3, pixels);
    expect(pixels[3]).toBe(0);
    expect(pixels[4 * 4 + 3]).toBe(255);
  });
});
