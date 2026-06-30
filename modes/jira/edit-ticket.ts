import { confirm, isCancel, select, text } from "@clack/prompts";
import chalk from "chalk";
import {
  Output,
  extractJsonMiddleware,
  generateText,
  stepCountIs,
  tool,
  wrapLanguageModel,
} from "ai";
import { z } from "zod";
import { getAgentModel } from "../../ai/ai.config.ts";
import { renderTerminalMarkdown } from "../../tui/terminal-md.ts";
import { ActionTracker } from "../agent/action-tracker.ts";
import { defaultAgentConfig } from "../agent/config.ts";
import { ToolExecutor } from "../agent/tool-executor.ts";
import { createWebTools } from "../plan/web-tools.ts";
import { formatIssueContext, getIssue, updateIssue } from "./client.ts";
import type { JiraConfig } from "./config.ts";
import { selectIssueKey } from "./issue-pick.ts";
import type { JiraIssueDetail, TicketUpdate } from "./types.ts";

const aiEditSchema = z.object({
  summary: z.string().optional().describe("Updated summary, only if it should change"),
  description: z.string().optional().describe("Updated full description, only if it should change"),
  labels: z.array(z.string()).optional().describe("Updated labels, only if they should change"),
  notes: z.string().optional().describe("Brief note of what you changed"),
});

function readOnlyTools(executor: ToolExecutor) {
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

function printIssue(issue: JiraIssueDetail): void {
  console.log(chalk.bold(`\n${issue.key}: ${issue.summary}`));
  console.log(chalk.dim(`${issue.status} · ${issue.issueType} · ${issue.priority}`));
  console.log(chalk.dim(issue.url));
  if (issue.labels.length) console.log(chalk.dim(`Labels: ${issue.labels.join(", ")}`));
  if (issue.description !== "(no description)") {
    console.log(chalk.dim("\nDescription:\n"));
    console.log(renderTerminalMarkdown(issue.description));
  }
  console.log();
}

function diffField(label: string, before: string, after: string): void {
  if (before === after) return;
  console.log(chalk.yellow(`\n${label} (changed)`));
  console.log(chalk.dim("  Before:"), before.slice(0, 200) + (before.length > 200 ? "…" : ""));
  console.log(chalk.green("  After: "), after.slice(0, 200) + (after.length > 200 ? "…" : ""));
}

function buildUpdate(
  issue: JiraIssueDetail,
  patch: TicketUpdate,
): { update: TicketUpdate; next: JiraIssueDetail } {
  const next: JiraIssueDetail = {
    ...issue,
    summary: patch.summary ?? issue.summary,
    description: patch.description ?? issue.description,
    labels: patch.labels ?? issue.labels,
  };
  const update: TicketUpdate = {};
  if (patch.summary !== undefined && patch.summary !== issue.summary) {
    update.summary = patch.summary;
  }
  if (patch.description !== undefined && patch.description !== issue.description) {
    update.description = patch.description;
  }
  if (patch.labels !== undefined && patch.labels.join(",") !== issue.labels.join(",")) {
    update.labels = patch.labels;
  }
  return { update, next };
}

async function confirmAndSave(
  config: JiraConfig,
  issue: JiraIssueDetail,
  patch: TicketUpdate,
): Promise<boolean> {
  const { update, next } = buildUpdate(issue, patch);
  if (Object.keys(update).length === 0) {
    console.log(chalk.yellow("\nNo changes to save.\n"));
    return false;
  }

  console.log(chalk.bold("\nChanges to apply\n"));
  if (update.summary) diffField("Summary", issue.summary, next.summary);
  if (update.description) diffField("Description", issue.description, next.description);
  if (update.labels) {
    console.log(chalk.yellow("\nLabels (changed)"));
    console.log(chalk.dim("  Before:"), issue.labels.join(", ") || "(none)");
    console.log(chalk.green("  After: "), next.labels.join(", ") || "(none)");
  }
  console.log();

  const proceed = await confirm({
    message: `Update ${issue.key} in Jira?`,
    initialValue: true,
  });
  if (isCancel(proceed) || !proceed) return false;

  try {
    await updateIssue(config, issue.key, update);
    console.log(chalk.green(`\n✓ Updated ${issue.key}`));
    console.log(chalk.dim(issue.url + "\n"));
    return true;
  } catch (err) {
    console.log(
      chalk.red(`\nFailed to update: ${err instanceof Error ? err.message : String(err)}\n`),
    );
    return false;
  }
}

async function manualEdit(config: JiraConfig, issue: JiraIssueDetail): Promise<void> {
  const fields = await select({
    message: "Which fields do you want to edit?",
    options: [
      { value: "summary", label: "Summary" },
      { value: "description", label: "Description" },
      { value: "labels", label: "Labels" },
      { value: "all", label: "All fields" },
      { value: "back", label: "<- Back" },
    ],
  });
  if (isCancel(fields) || fields === "back") return;

  const patch: TicketUpdate = {};
  const editSummary = fields === "summary" || fields === "all";
  const editDescription = fields === "description" || fields === "all";
  const editLabels = fields === "labels" || fields === "all";

  if (editSummary) {
    const summary = await text({
      message: "Summary",
      initialValue: issue.summary,
      validate: (v) => {
        if (!(v ?? "").trim()) return "Required";
      },
    });
    if (isCancel(summary)) return;
    patch.summary = summary.trim();
  }

  if (editDescription) {
    const description = await text({
      message: "Description",
      initialValue: issue.description === "(no description)" ? "" : issue.description,
      validate: (v) => {
        if (!(v ?? "").trim()) return "Required";
      },
    });
    if (isCancel(description)) return;
    patch.description = description.trim();
  }

  if (editLabels) {
    const labels = await text({
      message: "Labels (comma-separated)",
      initialValue: issue.labels.join(", "),
    });
    if (isCancel(labels)) return;
    patch.labels = labels
      .split(",")
      .map((l) => l.trim())
      .filter(Boolean);
  }

  await confirmAndSave(config, issue, patch);
}

async function aiEdit(config: JiraConfig, issue: JiraIssueDetail): Promise<void> {
  const instruction = await text({
    message: "What should change on this ticket?",
    placeholder: "Add acceptance criteria and clarify the bug steps…",
  });
  if (isCancel(instruction) || !instruction.trim()) return;

  const useCodebase = await confirm({
    message: "Let AI inspect the codebase for context?",
    initialValue: false,
  });
  if (isCancel(useCodebase)) return;

  const agentConfig = defaultAgentConfig();
  const tracker = new ActionTracker();
  const executor = new ToolExecutor(tracker, agentConfig);
  const hasWeb = !!process.env.FIRECRAWL_API_KEY;

  const model = wrapLanguageModel({
    model: getAgentModel(),
    middleware: extractJsonMiddleware(),
  });

  const tools = useCodebase
    ? {
        ...readOnlyTools(executor),
        ...(hasWeb ? createWebTools(tracker) : {}),
      }
    : undefined;

  console.log(chalk.cyan("\n✨ AI is revising the ticket…\n"));

  let parsed: z.infer<typeof aiEditSchema>;
  try {
    const result = await generateText({
      model,
      tools,
      stopWhen: stepCountIs(useCodebase ? 15 : 1),
      system: [
        "You edit existing Jira tickets based on user instructions.",
        "Only include fields that should change — omit unchanged fields.",
        "When updating description, return the full new description (not a diff).",
        "Preserve useful existing content unless the user asks to replace it.",
        "Output must match the JSON schema.",
      ].join("\n"),
      prompt: [
        formatIssueContext(issue),
        "",
        "Edit instructions:",
        instruction.trim(),
      ].join("\n"),
      output: Output.object({ schema: aiEditSchema }),
    });
    parsed = aiEditSchema.parse(result.output);
  } catch (err) {
    console.log(
      chalk.red(`\nAI edit failed: ${err instanceof Error ? err.message : String(err)}\n`),
    );
    return;
  }

  if (parsed.notes) {
    console.log(chalk.dim(`AI notes: ${parsed.notes}\n`));
  }

  const patch: TicketUpdate = {};
  if (parsed.summary?.trim()) patch.summary = parsed.summary.trim();
  if (parsed.description?.trim()) patch.description = parsed.description.trim();
  if (parsed.labels) patch.labels = parsed.labels;

  const edit = await confirm({
    message: "Review and edit before saving?",
    initialValue: false,
  });
  if (isCancel(edit)) return;

  if (edit) {
    const summary = await text({
      message: "Summary",
      initialValue: patch.summary ?? issue.summary,
      validate: (v) => {
        if (!(v ?? "").trim()) return "Required";
      },
    });
    if (isCancel(summary)) return;

    const description = await text({
      message: "Description",
      initialValue: patch.description ?? (issue.description === "(no description)" ? "" : issue.description),
      validate: (v) => {
        if (!(v ?? "").trim()) return "Required";
      },
    });
    if (isCancel(description)) return;

    const labels = await text({
      message: "Labels (comma-separated)",
      initialValue: (patch.labels ?? issue.labels).join(", "),
    });
    if (isCancel(labels)) return;

    patch.summary = summary.trim();
    patch.description = description.trim();
    patch.labels = labels
      .split(",")
      .map((l) => l.trim())
      .filter(Boolean);
  }

  await confirmAndSave(config, issue, patch);
}

export async function runEditIssue(config: JiraConfig, issueKey: string): Promise<void> {
  let issue: JiraIssueDetail;
  try {
    issue = await getIssue(config, issueKey);
  } catch (err) {
    console.log(
      chalk.red(`\nCould not load ${issueKey}: ${err instanceof Error ? err.message : String(err)}\n`),
    );
    return;
  }

  printIssue(issue);

  const mode = await select({
    message: `How do you want to edit ${issue.key}?`,
    options: [
      { value: "ai", label: "AI-assisted edit", hint: "Describe changes in plain language" },
      { value: "manual", label: "Manual edit", hint: "Edit summary, description, or labels" },
      { value: "back", label: "<- Back" },
    ],
  });
  if (isCancel(mode) || mode === "back") return;

  if (mode === "manual") await manualEdit(config, issue);
  else if (mode === "ai") await aiEdit(config, issue);
}

export async function runEditTicket(config: JiraConfig): Promise<void> {
  const issueKey = await selectIssueKey(config);
  if (!issueKey) return;
  await runEditIssue(config, issueKey);
}
