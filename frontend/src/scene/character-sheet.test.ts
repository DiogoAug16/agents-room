import { describe, expect, it } from "vitest";
import { isCheckerboardPixel } from "./character-sheet";

describe("isCheckerboardPixel", () => {
  it("removes only pale grayscale backdrop pixels", () => {
    expect(isCheckerboardPixel(255, 255, 255)).toBe(true);
    expect(isCheckerboardPixel(200, 198, 201)).toBe(true);
    expect(isCheckerboardPixel(195, 180, 195)).toBe(false);
    expect(isCheckerboardPixel(170, 170, 170)).toBe(false);
  });
});
