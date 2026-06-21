import { isCancel, select } from "@clack/prompts";
import chalk from "chalk";
import { runAgentMode } from "./agent/orchestrator.ts";

export async function runCliMode(): Promise<void> {
  const mode = await select({
    message: "Choose CLI sub-mode",
    options: [
      { value: "agent", label: "Agent Mode" },
      { value: "plan", label: "Plan Mode" },
      { value: "ask", label: "Ask Mode" },
      { value: "back", label: "<- Back to main menu" },
    ],
  });
  if (isCancel(mode) || mode === "back") return;

  if (mode === "agent") {
    await runAgentMode();
    return;
  }

  if (mode === "plan" || mode === "ask") {
    console.log(chalk.yellow("Mode is not implemented yet..."));
  }
}
