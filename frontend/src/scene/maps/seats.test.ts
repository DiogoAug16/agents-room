import { describe, expect, it } from "vitest";
import { SeatRegistry, seatedWorldPosition } from "./seats";
import { STATIC_SEATS, type SeatAnchor } from "./office-layout";

const seat: SeatAnchor = { id: "sofa", type: "sofa_seat", gridPosition: { x: 5, y: 14 }, approachPosition: { x: 5, y: 13 }, seatedSpriteOffset: { x: 7, y: -18 }, facing: "north" };
describe("seat reservations", () => {
  it("prevents two agents from occupying the same seat and releases it", () => {
    const registry = new SeatRegistry();
    expect(registry.occupy(seat, "ana")).toBe(true);
    expect(registry.occupy(seat, "bruno")).toBe(false);
    registry.release(seat, "ana");
    expect(registry.occupy(seat, "bruno")).toBe(true);
  });
  it("applies each seat offset to the visual anchor", () => expect(seatedWorldPosition(seat)).toEqual({ x: 487, y: 586 }));
  it("keeps sofa positions independent", () => {
    const registry = new SeatRegistry(); const [left, center] = STATIC_SEATS.filter((item) => item.type === "sofa_seat");
    expect(registry.occupy(left, "ana")).toBe(true);
    expect(registry.occupy(center, "bruno")).toBe(true);
  });
});
