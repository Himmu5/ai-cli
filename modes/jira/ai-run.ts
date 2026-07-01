import { confirm, isCancel } from "@clack/prompts";
import chalk from "chalk";
import { ToolLoopAgent, stepCountIs, tool } from "ai";
import { z } from "zod";
import { getAgentModel } from "../../ai/ai.config.ts";
import { renderTerminalMarkdown } from "../../tui/terminal-md.ts";
import { ActionTracker } from "../agent/action-tracker.ts";
import { createAgentTools } from "../agent/agent-tools.ts";
import { runApprovalFlow } from "../agent/approval.ts";
import { defaultAgentConfig } from "../agent/config.ts";
import { ToolExecutor } from "../agent/tool-executor.ts";
import { generatePlan } from "../plan/planner.ts";
import { printPlan, selectSteps } from "../plan/selection.ts";
import { createWebTools } from "../plan/web-tools.ts";
import type { JiraConfig } from "./config.ts";
import { addComment, formatIssueContext } from "./client.ts";
import { createJiraTools } from "./jira-tools.ts";
import type { JiraIssueDetail } from "./types.ts";

function readOnlyConfig() {
  const c = defaultAgentConfig();
  c.tools.allowFileCreation = false;
  c.tools.allowFileModification = false;
  c.tools.allowFolderCreation = false;
  c.tools.allowShellExecution = false;
  return c;
}

function createReadOnlyTools(executor: ToolExecutor) {
  return {
    read_file: tool({
      description: "Read a workspace file (relative path).",
      inputSchema: z.object({ path: z.string() }),
      execute: async ({ path: p }) => executor.readFile(p),
    }),
    list_files: tool({
      description: "List files/dirs at a path.",
      inputSchema: z.object({
        path: z.string(),
        recursive: z.boolean().optional().default(false),
      }),
      execute: async ({ path: p, recursive }) => executor.listFiles(p, recursive),
    }),
    search_files: tool({
      description: "Find files matching a glob pattern; optional content filter.",
      inputSchema: z.object({
        root: z.string(),
        pattern: z.string(),
        content_contains: z.string().optional(),
      }),
      execute: async ({ root, pattern, content_contains }) =>
        executor.searchFiles(root, pattern, content_contains),
    }),
    analyze_codebase: tool({
      description: "Summarize the codebase structure.",
      inputSchema: z.object({ path: z.string().default(".") }),
      execute: async ({ path: p }) => executor.analyzeCodebase(p),
    }),
  };
}

function issuePrompt(issue: JiraIssueDetail, userText: string): string {
  return [formatIssueContext(issue), "", "---", "", userText].join("\n");
}

async function maybePostComment(
  config: JiraConfig,
  issue: JiraIssueDetail,
  label: string,
  body: string,
): Promise<void> {
  const post = await confirm({
    message: `Post this ${label} as a comment on ${issue.key}?`,
    initialValue: false,
  });
  if (isCancel(post) || !post) return;

  await addComment(config, issue.key, body);
  console.log(chalk.green(`\n✓ Comment posted to ${issue.key}\n`));
}

export async function runAskOnIssue(
  config: JiraConfig,
  issue: JiraIssueDetail,
  question: string,
): Promise<void> {
  const agentConfig = readOnlyConfig();
  const tracker = new ActionTracker();
  const executor = new ToolExecutor(tracker, agentConfig);
  const webTools = process.env.FIRECRAWL_API_KEY ? createWebTools(tracker) : {};
  const tools = { ...createReadOnlyTools(executor), ...webTools };

  const agent = new ToolLoopAgent({
    model: getAgentModel(),
    stopWhen: stepCountIs(20),
    instructions: `Workspace root: ${agentConfig.codebasePath}. Answer using the codebase and the Jira issue context.`,
    tools,
  });

  const { text } = await agent.generate({
    prompt: issuePrompt(issue, question),
  });

  const answer = text?.trim() || "No answer.";
  console.log("\n" + renderTerminalMarkdown(answer) + "\n");
  await maybePostComment(config, issue, "answer", answer);
}

export async function runAgentOnIssue(
  config: JiraConfig,
  issue: JiraIssueDetail,
  extraGoal?: string,
): Promise<void> {
  const agentConfig = defaultAgentConfig();
  const tracker = new ActionTracker();
  const executor = new ToolExecutor(tracker, agentConfig);
  const tools = { ...createAgentTools(executor), ...createJiraTools(config) };

  const goal = [
    "Implement the following Jira issue in the codebase.",
    "Use jira_search_issues or jira_get_board_tickets to browse related tickets when needed.",
    "Use jira_assign_issue to assign or reassign tickets when appropriate.",
    extraGoal?.trim() ? `Additional instructions: ${extraGoal.trim()}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const agent = new ToolLoopAgent({
    model: getAgentModel(),
    stopWhen: stepCountIs(40),
    instructions: [
      `Workspace root: ${agentConfig.codebasePath}`,
      "All file changes are staged until user approval.",
      "Jira browse and assign actions run immediately via jira_* tools (not staged for approval).",
    ].join("\n"),
    tools,
  });

  const { text } = await agent.generate({
    prompt: issuePrompt(issue, goal),
    onStepFinish: ({ toolCalls }) => {
      for (const tc of toolCalls) {
        const preview = JSON.stringify(tc.input).slice(0, 120);
        console.log(
          chalk.green("  ✓"),
          chalk.bold(String(tc.toolName)),
          chalk.dim(preview + (preview.length >= 120 ? "..." : "")),
        );
      }
    },
  });

  if (text?.trim()) console.log("\n" + renderTerminalMarkdown(text.trim()) + "\n");

  const ok = await runApprovalFlow(tracker);
  if (!ok) {
    executor.clearStaging();
    return;
  }

  const { errors } = executor.applyApprovedFromTracker();
  if (errors.length) {
    console.log(chalk.red("\nSome operations reported errors:\n"));
    for (const e of errors) console.log(chalk.red(`  • ${e}`));
  } else {
    console.log(chalk.green("\n✓ Changes applied.\n"));
    const summary = text?.trim() || `Implemented ${issue.key}: ${issue.summary}`;
    await maybePostComment(config, issue, "implementation summary", summary);
  }
  executor.clearStaging();
}

export async function runPlanOnIssue(config: JiraConfig, issue: JiraIssueDetail): Promise<void> {
  const goal = `Resolve Jira issue ${issue.key}: ${issue.summary}\n\n${issue.description}`;
  const plan = await generatePlan(goal);
  printPlan(plan);

  const selected = await selectSteps(plan);
  if (selected.length === 0) return;

  const proceed = await confirm({
    message: `Execute ${selected.length} step(s) for ${issue.key}?`,
    initialValue: true,
  });
  if (isCancel(proceed) || !proceed) return;

  const agentConfig = defaultAgentConfig();
  const tracker = new ActionTracker();
  const executor = new ToolExecutor(tracker, agentConfig);
  const tools = {
    ...createAgentTools(executor),
    ...(process.env.FIRECRAWL_API_KEY ? createWebTools(tracker) : {}),
  };

  for (const step of selected) {
    console.log(chalk.bold(`\n🔧 ${step.title}\n`));
    const agent = new ToolLoopAgent({
      model: getAgentModel(),
      stopWhen: stepCountIs(30),
      tools,
    });
    const prompt = [
      formatIssueContext(issue),
      "",
      `Goal: ${plan.goal}`,
      `Step: ${step.title}`,
      step.description,
    ].join("\n");
    const { text } = await agent.generate({ prompt });
    if (text?.trim()) console.log(renderTerminalMarkdown(text.trim()));
  }

  const ok = await runApprovalFlow(tracker);
  if (!ok) {
    executor.clearStaging();
    return;
  }

  const { errors } = executor.applyApprovedFromTracker();
  if (errors.length) {
    console.log(chalk.red("\nSome operations reported errors:\n"));
    for (const e of errors) console.log(chalk.red(`  • ${e}`));
  } else {
    console.log(chalk.green("\n✓ All steps applied.\n"));
    await maybePostComment(
      config,
      issue,
      "plan execution summary",
      `Completed ${selected.length} plan step(s) for ${issue.key}.`,
    );
  }
  executor.clearStaging();
}
