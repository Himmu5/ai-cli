import { isCancel, select, text } from "@clack/prompts";
import chalk from "chalk";
import { runAgentOnIssue, runAskOnIssue, runPlanOnIssue } from "./ai-run.ts";
import { runAssignIssue, runAssignTicket } from "./assign-ticket.ts";
import { runBrowseBoard } from "./board-tickets.ts";
import { runCreateTicket } from "./create-ticket.ts";
import { runEditIssue, runEditTicket } from "./edit-ticket.ts";
import { getIssue, searchIssues, verifyJiraConnection } from "./client.ts";
import { getJiraConfig } from "./config.ts";
import { pickIssueFromList } from "./issue-pick.ts";

async function browseIssues(config: ReturnType<typeof getJiraConfig>): Promise<void> {
  console.log(chalk.dim(`\nJQL: ${config.defaultJql}\n`));
  const { issues } = await searchIssues(config, config.defaultJql);
  const picked = await pickIssueFromList(issues);
  if (!picked) return;
  await workOnIssue(config, picked.key);
}

async function searchByJql(config: ReturnType<typeof getJiraConfig>): Promise<void> {
  const jql = await text({
    message: "Enter JQL query",
    initialValue: config.defaultJql,
  });
  if (isCancel(jql) || !jql.trim()) return;

  const { issues } = await searchIssues(config, jql.trim());
  const picked = await pickIssueFromList(issues);
  if (!picked) return;
  await workOnIssue(config, picked.key);
}

async function openByKey(config: ReturnType<typeof getJiraConfig>): Promise<void> {
  const key = await text({
    message: "Issue key",
    placeholder: "PROJ-123",
    validate: (v) => {
      if (!(v ?? "").trim()) return "Required";
    },
  });
  if (isCancel(key)) return;
  await workOnIssue(config, key.trim().toUpperCase());
}

async function workOnIssue(
  config: ReturnType<typeof getJiraConfig>,
  issueKey: string,
): Promise<void> {
  const issue = await getIssue(config, issueKey);

  console.log(chalk.bold(`\n${issue.key}: ${issue.summary}`));
  console.log(chalk.dim(`${issue.status} · ${issue.issueType} · ${issue.priority}`));
  if (issue.assignee) {
    console.log(chalk.dim(`Assignee: ${issue.assignee.displayName}`));
  }
  console.log(chalk.dim(issue.url));
  if (issue.description !== "(no description)") {
    console.log(chalk.dim("\n" + issue.description.slice(0, 400) + (issue.description.length > 400 ? "…" : "")));
  }
  console.log();

  const action = await select({
    message: `What should the AI do for ${issue.key}?`,
    options: [
      { value: "ask", label: "Ask", hint: "Question about the issue + codebase" },
      { value: "agent", label: "Agent", hint: "Implement the issue in the codebase" },
      { value: "plan", label: "Plan", hint: "Generate and execute a step-by-step plan" },
      { value: "edit", label: "Edit ticket", hint: "Update summary, description, or labels" },
      { value: "assign", label: "Assign ticket", hint: "Change or clear the assignee" },
      { value: "back", label: "<- Back" },
    ],
  });
  if (isCancel(action) || action === "back") return;

  if (action === "edit") {
    await runEditIssue(config, issue.key);
    return;
  }

  if (action === "assign") {
    await runAssignIssue(config, issue.key);
    return;
  }

  if (action === "ask") {
    const question = await text({
      message: "Your question",
      placeholder: "How should we approach this fix?",
    });
    if (isCancel(question) || !question.trim()) return;
    await runAskOnIssue(config, issue, question.trim());
    return;
  }

  if (action === "agent") {
    const extra = await text({
      message: "Extra instructions (optional)",
      placeholder: "Focus on unit tests only…",
    });
    if (isCancel(extra)) return;
    await runAgentOnIssue(config, issue, extra.trim() || undefined);
    return;
  }

  if (action === "plan") {
    await runPlanOnIssue(config, issue);
  }
}

async function jiraMenu(config: ReturnType<typeof getJiraConfig>): Promise<boolean> {
  const choice = await select({
    message: "Jira mode",
    options: [
      { value: "create", label: "Create ticket with AI", hint: "Draft and file a new Jira issue" },
      { value: "edit", label: "Edit ticket", hint: "Update an existing issue" },
      { value: "assign", label: "Assign ticket", hint: "Set or clear the assignee" },
      { value: "browse", label: "Browse my issues" },
      { value: "board", label: "Browse board", hint: "Fetch all tickets from a Jira board" },
      { value: "jql", label: "Search with JQL" },
      { value: "back", label: "<- Back to main menu" },
    ],
  });
  if (isCancel(choice) || choice === "back") return false;

  if (choice === "create") await runCreateTicket(config);
  else if (choice === "edit") await runEditTicket(config);
  else if (choice === "assign") await runAssignTicket(config);
  else if (choice === "browse") await browseIssues(config);
  else if (choice === "board") await runBrowseBoard(config, workOnIssue);
  else if (choice === "jql") await searchByJql(config);

  return true;
}

export async function runJiraMode(): Promise<void> {
  console.log(chalk.bold("\n🎫 Jira Mode\n"));

  let config: ReturnType<typeof getJiraConfig>;
  try {
    config = getJiraConfig();
  } catch (err) {
    console.log(chalk.red(`\n${err instanceof Error ? err.message : String(err)}\n`));
    console.log(
      chalk.dim(
        "Set JIRA_BASE_URL, JIRA_EMAIL, and JIRA_API_TOKEN in your .env file.\n" +
          "Optional: JIRA_PROJECT_KEY, JIRA_BOARD_ID, or JIRA_DEFAULT_JQL\n",
      ),
    );
    return;
  }

  try {
    const name = await verifyJiraConnection(config);
    console.log(chalk.green(`Connected as ${name}\n`));
  } catch (err) {
    console.log(
      chalk.red(`\nCould not connect to Jira: ${err instanceof Error ? err.message : String(err)}\n`),
    );
    return;
  }

  let stay = true;
  while (stay) {
    stay = await jiraMenu(config);
  }
}
