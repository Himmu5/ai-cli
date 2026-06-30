import { isCancel, select, text } from "@clack/prompts";
import chalk from "chalk";
import { searchIssues } from "./client.ts";
import type { JiraConfig } from "./config.ts";
import type { JiraIssueSummary } from "./types.ts";

export async function pickIssueFromList(
  issues: JiraIssueSummary[],
): Promise<JiraIssueSummary | null> {
  if (issues.length === 0) {
    console.log(chalk.yellow("\nNo issues found.\n"));
    return null;
  }

  const picked = await select({
    message: "Select an issue",
    options: [
      ...issues.map((issue) => ({
        value: issue.key,
        label: `${issue.key} — ${issue.summary}`,
        hint: `${issue.status} · ${issue.priority}`,
      })),
      { value: "__back", label: "<- Back" },
    ],
  });
  if (isCancel(picked) || picked === "__back") return null;
  return issues.find((i) => i.key === picked) ?? null;
}

export async function selectIssueKey(config: JiraConfig): Promise<string | null> {
  const method = await select({
    message: "How do you want to find the ticket?",
    options: [
      { value: "browse", label: "Browse my issues" },
      { value: "jql", label: "Search with JQL" },
      { value: "key", label: "Enter issue key" },
      { value: "back", label: "<- Back" },
    ],
  });
  if (isCancel(method) || method === "back") return null;

  if (method === "browse") {
    console.log(chalk.dim(`\nJQL: ${config.defaultJql}\n`));
    const { issues } = await searchIssues(config, config.defaultJql);
    const picked = await pickIssueFromList(issues);
    return picked?.key ?? null;
  }

  if (method === "jql") {
    const jql = await text({
      message: "Enter JQL query",
      initialValue: config.defaultJql,
    });
    if (isCancel(jql) || !jql.trim()) return null;
    const { issues } = await searchIssues(config, jql.trim());
    const picked = await pickIssueFromList(issues);
    return picked?.key ?? null;
  }

  const key = await text({
    message: "Issue key",
    placeholder: "KAN-123",
    validate: (v) => {
      if (!(v ?? "").trim()) return "Required";
    },
  });
  if (isCancel(key)) return null;
  return key.trim().toUpperCase();
}
