import { confirm, isCancel, select, text } from "@clack/prompts";
import chalk from "chalk";
import {
  assignIssue,
  getCurrentUser,
  getIssue,
  searchAssignableUsers,
} from "./client.ts";
import type { JiraConfig } from "./config.ts";
import { selectIssueKey } from "./issue-pick.ts";
import type { JiraIssueDetail, JiraUser } from "./types.ts";

function formatUser(user: JiraUser): string {
  return user.emailAddress ? `${user.displayName} (${user.emailAddress})` : user.displayName;
}

function printIssue(issue: JiraIssueDetail): void {
  console.log(chalk.bold(`\n${issue.key}: ${issue.summary}`));
  console.log(chalk.dim(`${issue.status} · ${issue.issueType} · ${issue.priority}`));
  console.log(
    chalk.dim(`Assignee: ${issue.assignee ? formatUser(issue.assignee) : "Unassigned"}`),
  );
  console.log(chalk.dim(issue.url));
  console.log();
}

async function pickAssignee(
  config: JiraConfig,
  issue: JiraIssueDetail,
  currentUser: JiraUser,
): Promise<JiraUser | null | undefined> {
  const method = await select({
    message: `Assign ${issue.key} to whom?`,
    options: [
      {
        value: "me",
        label: `Assign to me (${currentUser.displayName})`,
        hint: "Set yourself as assignee",
      },
      { value: "search", label: "Search users", hint: "Find someone by name or email" },
      { value: "unassign", label: "Unassign", hint: "Clear the current assignee" },
      { value: "back", label: "<- Back" },
    ],
  });
  if (isCancel(method) || method === "back") return undefined;

  if (method === "me") return currentUser;
  if (method === "unassign") return null;

  const query = await text({
    message: "Search assignable users",
    placeholder: "Name or email…",
  });
  if (isCancel(query)) return undefined;

  let users: JiraUser[];
  try {
    users = await searchAssignableUsers(config, issue.key, query.trim());
  } catch (err) {
    console.log(
      chalk.red(
        `\nUser search failed: ${err instanceof Error ? err.message : String(err)}\n`,
      ),
    );
    return undefined;
  }

  if (users.length === 0) {
    console.log(chalk.yellow("\nNo assignable users found.\n"));
    return undefined;
  }

  const picked = await select({
    message: "Select assignee",
    options: [
      ...users.map((user) => ({
        value: user.accountId,
        label: formatUser(user),
        hint:
          user.accountId === issue.assignee?.accountId
            ? "Current assignee"
            : user.accountId === currentUser.accountId
              ? "You"
              : undefined,
      })),
      { value: "__back", label: "<- Back" },
    ],
  });
  if (isCancel(picked) || picked === "__back") return undefined;
  return users.find((u) => u.accountId === picked) ?? undefined;
}

export async function runAssignIssue(config: JiraConfig, issueKey: string): Promise<void> {
  let issue: JiraIssueDetail;
  try {
    issue = await getIssue(config, issueKey);
  } catch (err) {
    console.log(
      chalk.red(`\nCould not load ${issueKey}: ${err instanceof Error ? err.message : String(err)}\n`),
    );
    return;
  }

  let currentUser: JiraUser;
  try {
    currentUser = await getCurrentUser(config);
  } catch (err) {
    console.log(
      chalk.red(
        `\nCould not resolve your Jira account: ${err instanceof Error ? err.message : String(err)}\n`,
      ),
    );
    return;
  }

  printIssue(issue);

  const assignee = await pickAssignee(config, issue, currentUser);
  if (assignee === undefined) return;

  const before = issue.assignee ? formatUser(issue.assignee) : "Unassigned";
  const after =
    assignee === null ? "Unassigned" : formatUser(assignee);

  if (before === after) {
    console.log(chalk.yellow(`\n${issue.key} is already assigned to ${after}.\n`));
    return;
  }

  console.log(chalk.bold("\nAssignment change\n"));
  console.log(chalk.dim("  Before:"), before);
  console.log(chalk.green("  After: "), after);
  console.log();

  const proceed = await confirm({
    message: `Update assignee for ${issue.key}?`,
    initialValue: true,
  });
  if (isCancel(proceed) || !proceed) return;

  try {
    await assignIssue(config, issue.key, assignee?.accountId ?? null);
    console.log(chalk.green(`\n✓ Assigned ${issue.key} to ${after}`));
    console.log(chalk.dim(issue.url + "\n"));
  } catch (err) {
    console.log(
      chalk.red(`\nFailed to assign: ${err instanceof Error ? err.message : String(err)}\n`),
    );
  }
}

export async function runAssignTicket(config: JiraConfig): Promise<void> {
  const issueKey = await selectIssueKey(config);
  if (!issueKey) return;
  await runAssignIssue(config, issueKey);
}
