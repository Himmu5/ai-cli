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
import { createIssue, getIssueTypes, listProjects } from "./client.ts";
import type { JiraConfig } from "./config.ts";
import type { JiraIssueType, TicketDraft } from "./types.ts";

const ticketDraftSchema = z.object({
  summary: z.string().describe("Concise ticket title, max ~120 chars"),
  description: z
    .string()
    .describe("Detailed description: context, steps to reproduce or requirements, acceptance criteria"),
  issueType: z.string().describe("Issue type name, e.g. Bug, Task, Story"),
  labels: z.array(z.string()).optional().default([]),
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

function matchIssueType(suggested: string, types: JiraIssueType[]): JiraIssueType {
  const lower = suggested.toLowerCase();
  return (
    types.find((t) => t.name.toLowerCase() === lower) ??
    types.find((t) => t.name.toLowerCase().includes(lower) || lower.includes(t.name.toLowerCase())) ??
    types.find((t) => t.name.toLowerCase() === "task") ??
    types[0]!
  );
}

async function pickProject(config: JiraConfig): Promise<string | null> {
  if (config.projectKey) {
    try {
      const types = await getIssueTypes(config, config.projectKey);
      if (types.length > 0) return config.projectKey;
    } catch {
      console.log(
        chalk.yellow(
          `\nJIRA_PROJECT_KEY "${config.projectKey}" is invalid — pick a project.\n`,
        ),
      );
    }
  }

  const projects = await listProjects(config);
  if (projects.length === 0) {
    console.log(chalk.yellow("\nNo Jira projects found.\n"));
    return null;
  }

  const picked = await select({
    message: "Select project",
    options: projects.map((p) => ({
      value: p.key,
      label: `${p.key} — ${p.name}`,
    })),
  });
  if (isCancel(picked)) return null;
  return picked;
}

async function draftTicketWithAi(
  userRequest: string,
  issueTypes: JiraIssueType[],
  useCodebase: boolean,
): Promise<TicketDraft> {
  const config = defaultAgentConfig();
  const tracker = new ActionTracker();
  const executor = new ToolExecutor(tracker, config);
  const hasWeb = !!process.env.FIRECRAWL_API_KEY;

  const typeNames = issueTypes.map((t) => t.name).join(", ");
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

  console.log(chalk.cyan("\n✨ AI is drafting your ticket…\n"));

  const result = await generateText({
    model,
    tools,
    stopWhen: stepCountIs(useCodebase ? 15 : 1),
    system: [
      "You draft Jira tickets from user requests.",
      `Available issue types: ${typeNames}. Pick the best match for issueType.`,
      "Write a clear summary and a structured description.",
      "Description should use sections when helpful: Context, Requirements, Steps to Reproduce, Acceptance Criteria.",
      "Labels should be short lowercase tags when useful, or an empty array.",
      "Output must match the JSON schema.",
    ].join("\n"),
    prompt: userRequest,
    output: Output.object({ schema: ticketDraftSchema }),
  });

  const parsed = ticketDraftSchema.parse(result.output);
  return {
    summary: parsed.summary.trim(),
    description: parsed.description.trim(),
    issueType: parsed.issueType.trim(),
    labels: parsed.labels ?? [],
  };
}

async function reviewDraft(
  draft: TicketDraft,
  issueTypes: JiraIssueType[],
): Promise<{ draft: TicketDraft; issueType: JiraIssueType } | null> {
  const matched = matchIssueType(draft.issueType, issueTypes);

  console.log(chalk.bold("\nDraft ticket\n"));
  console.log(chalk.dim("Type:"), matched.name);
  console.log(chalk.dim("Summary:"), draft.summary);
  if (draft.labels.length) console.log(chalk.dim("Labels:"), draft.labels.join(", "));
  console.log(chalk.dim("\nDescription:\n"));
  console.log(renderTerminalMarkdown(draft.description));
  console.log();

  const edit = await confirm({
    message: "Edit before creating?",
    initialValue: false,
  });
  if (isCancel(edit)) return null;

  let finalDraft = draft;
  let finalType = matched;

  if (edit) {
    const summary = await text({
      message: "Summary",
      initialValue: draft.summary,
      validate: (v) => {
        if (!(v ?? "").trim()) return "Required";
      },
    });
    if (isCancel(summary)) return null;

    const description = await text({
      message: "Description",
      initialValue: draft.description,
      validate: (v) => {
        if (!(v ?? "").trim()) return "Required";
      },
    });
    if (isCancel(description)) return null;

    const otherTypes = issueTypes.filter((t) => t.id !== matched.id);
    const typePick = await select({
      message: "Issue type",
      options: [
        { value: matched.id, label: `${matched.name} (suggested)` },
        ...otherTypes.map((t) => ({ value: t.id, label: t.name })),
      ],
    });
    if (isCancel(typePick)) return null;

    finalDraft = {
      summary: summary.trim(),
      description: description.trim(),
      issueType: issueTypes.find((t) => t.id === typePick)!.name,
      labels: draft.labels,
    };
    finalType = issueTypes.find((t) => t.id === typePick)!;
  }

  const proceed = await confirm({
    message: `Create ${finalType.name}: "${finalDraft.summary}"?`,
    initialValue: true,
  });
  if (isCancel(proceed) || !proceed) return null;

  return { draft: finalDraft, issueType: finalType };
}

export async function runCreateTicket(config: JiraConfig): Promise<void> {
  const projectKey = await pickProject(config);
  if (!projectKey) return;

  const issueTypes = await getIssueTypes(config, projectKey);
  if (issueTypes.length === 0) {
    console.log(chalk.red(`\nNo issue types available for project ${projectKey}.\n`));
    return;
  }

  const userRequest = await text({
    message: "Describe the ticket",
    placeholder: "Bug: login fails when email has a plus sign…",
  });
  if (isCancel(userRequest) || !userRequest.trim()) return;

  const useCodebase = await confirm({
    message: "Let AI inspect the codebase for context?",
    initialValue: true,
  });
  if (isCancel(useCodebase)) return;

  let draft: TicketDraft;
  try {
    draft = await draftTicketWithAi(userRequest.trim(), issueTypes, useCodebase);
  } catch (err) {
    console.log(
      chalk.red(`\nAI draft failed: ${err instanceof Error ? err.message : String(err)}\n`),
    );
    return;
  }

  const reviewed = await reviewDraft(draft, issueTypes);
  if (!reviewed) return;

  try {
    const created = await createIssue(
      config,
      projectKey,
      reviewed.draft,
      reviewed.issueType.id,
    );
    console.log(chalk.green(`\n✓ Created ${created.key}`));
    console.log(chalk.dim(created.url + "\n"));
  } catch (err) {
    console.log(
      chalk.red(`\nFailed to create ticket: ${err instanceof Error ? err.message : String(err)}\n`),
    );
  }
}
