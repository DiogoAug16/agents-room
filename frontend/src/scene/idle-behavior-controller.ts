export type IdleBehaviorType = "remain_seated" | "typing" | "look_around" | "short_walk" | "visit_rest_area" | "sit_on_sofa" | "join_idle_meeting" | "return_to_workstation";
export type IdleBehaviorHooks = { canRun: (agentId: string) => boolean; execute: (agentId: string, behavior: IdleBehaviorType) => Promise<void> };
export class IdleBehaviorController {
  private readonly timers = new Map<string, ReturnType<typeof setTimeout>>();
  constructor(private readonly hooks: IdleBehaviorHooks, private readonly minDelayMs = 15_000, private readonly maxDelayMs = 45_000, private readonly random = Math.random) {}
  scheduleNextBehavior(agentId: string) { this.cancelBehavior(agentId); const delay = this.minDelayMs + Math.floor(this.random() * (this.maxDelayMs - this.minDelayMs)); this.timers.set(agentId, setTimeout(async () => { this.timers.delete(agentId); if (this.hooks.canRun(agentId)) await this.hooks.execute(agentId, this.chooseBehavior(agentId)); this.scheduleNextBehavior(agentId); }, delay)); }
  chooseBehavior(_agentId: string): IdleBehaviorType { return ["remain_seated", "typing", "look_around", "short_walk", "visit_rest_area", "sit_on_sofa", "join_idle_meeting"][Math.floor(this.random() * 7)] as IdleBehaviorType; }
  cancelBehavior(agentId: string) { const timer = this.timers.get(agentId); if (timer !== undefined) clearTimeout(timer); this.timers.delete(agentId); }
  cancelAll() { [...this.timers.keys()].forEach((agentId) => this.cancelBehavior(agentId)); }
}
