export type PrimaryPanel = "overview" | "agents" | "tasks" | "capabilities" | "furniture" | "activity" | "settings" | null;

export function toggledPanel(current: PrimaryPanel, next: Exclude<PrimaryPanel, null>): PrimaryPanel {
  return current === next ? null : next;
}

export function panelForShortcut(key: string): Exclude<PrimaryPanel, null> | undefined {
  return ({ a: "agents", t: "tasks", s: "capabilities", g: "furniture" } as const)[key.toLowerCase()];
}

export function ignoresWorkspaceShortcut(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && Boolean(target.closest("input, textarea, select, [contenteditable=true]"));
}
