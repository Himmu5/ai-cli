import { isCancel } from "@clack/core";
import chalk from "chalk";
import { text } from "@clack/prompts";
import { ToolLoopAgent, stepCountIs } from "ai";
import { getAgentModel } from "../../ai/ai.config.ts";
import { renderTerminalMarkdown } from "../../tui/terminal-md.ts";
import { ActionTracker } from "./action-tracker.ts";
import { createAgentTools } from "./agent-tools.ts";
import { defaultAgentConfig } from "./config.ts";
import { ToolExecutor } from "./tool-executor.ts";
import { runApprovalFlow } from "./approval.ts";

export async function runAgentMode(): Promise<void> {
  console.log(chalk.bold("Agent Mode"));

  const goal = await text({
    message: "What would you like the agent to do?",
    placeholder: "Concrete task for this codebase...",
  });
  if (isCancel(goal) || !goal.trim()) return;

  const config = defaultAgentConfig();
  const tracker = new ActionTracker();
  const executor = new ToolExecutor(tracker, config);
  const tools = createAgentTools(executor);
  const agent = new ToolLoopAgent({
    model: getAgentModel(),
    stopWhen: stepCountIs(20),
    instructions: [
      `Workspace root: ${config.codebasePath}`,
      "All mutations are staged until approval.",
    ].join("\n"),
    tools,
  });

  const result = await agent.generate({
    prompt: goal.trim(),
    onStepFinish: ({ toolCalls }) => {
      for (const tc of toolCalls) {
        const preview = JSON.stringify(tc.input).slice(0, 160);
        console.log(
          chalk.green("  ✓"),
          chalk.bold(String(tc.toolName)),
          chalk.dim(preview + (preview.length >= 160 ? "..." : "")),
        );
      }
    },
  });

  if (result.text?.trim()) console.log(renderTerminalMarkdown(result.text));
  
  const ok = await runApprovalFlow(tracker);
  if (!ok) return executor.clearStaging();

  const { errors } = executor.applyApprovedFromTracker();

  if (errors.length) {
    console.log(chalk.red("\nSome operations reported errors:\n"));
    for (const e of errors) console.log(chalk.red(`  • ${e}`));
  }
  else{
   console.log(chalk.green('\n✓ Applied.\n'));
  }

  executor.clearStaging()
}
