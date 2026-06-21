import {
  isMutationType,
  type ActionLog,
  type ActionLogInput,
  type ActionStatus,
} from "./types.ts";

export class ActionTracker {
  private actions: ActionLog[] = [];

  log(entry: ActionLogInput): ActionLog {
    const action: ActionLog = {
      id: entry.id ?? crypto.randomUUID(),
      timestamp: entry.timestamp ?? new Date(),
      type: entry.type,
      path: entry.path,
      details: { ...entry.details },
      status: entry.status,
      userApproved: entry.userApproved,
    };
    this.actions.push(action);
    return action;
  }

  getPendingMutation(): ActionLog[] {
    return this.actions.filter(
      (a) => isMutationType(a.type) && a.status === "pending",
    );
  }

  updateStatus(
    id: string,
    status: ActionStatus,
    userApproved = false,
  ): ActionLog | undefined {
    const action = this.actions.find((a) => a.id === id);
    if (!action) return undefined;
    action.status = status;
    action.userApproved = userApproved;
    return action;
  }

  getActions(): readonly ActionLog[] {
    return this.actions;
  }
}
