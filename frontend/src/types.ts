export type Direction = "north" | "south" | "east" | "west";
export type VisualStatus = "offline" | "idle" | "seated" | "queued" | "standing_up" | "walking" | "interacting" | "returning" | "sitting_down" | "working" | "waiting_approval" | "cancelling" | "completed" | "error";

export type GridPoint = { x: number; y: number };
export type Agent = {
  id: string;
  name: string;
  role: string;
  description: string;
  color: number;
  status: VisualStatus;
  direction: Direction;
  position: GridPoint;
  basePosition: GridPoint;
  skills: string[];
  task?: string;
};

export type Skill = { id: string; name: string; description: string; category: string };
