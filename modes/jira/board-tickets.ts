import { isCancel, select } from "@clack/prompts";
import chalk from "chalk";
import { getAllBoardIssues, getBoard, listBoards } from "./client.ts";
import type { JiraConfig } from "./config.ts";
import { pickIssueFromList } from "./issue-pick.ts";
import type { JiraBoard, JiraIssueSummary } from "./types.ts";

function printBoardIssues(board: JiraBoard, issues: JiraIssueSummary[]): void {
  console.log(chalk.bold(`\n${board.name}`));
  console.log(chalk.dim(`${board.type} board · ${issues.length} ticket${issues.length === 1 ? "" : "s"}\n`));

  if (issues.length === 0) {
    console.log(chalk.yellow("No tickets on this board.\n"));
    return;
  }

  const byStatus = new Map<string, JiraIssueSummary[]>();
  for (const issue of issues) {
    const group = byStatus.get(issue.status) ?? [];
    group.push(issue);
    byStatus.set(issue.status, group);
  }

  for (const [status, group] of byStatus) {
    console.log(chalk.cyan(`${status} (${group.length})`));
    for (const issue of group) {
      console.log(chalk.dim(`  ${issue.key}`), issue.summary, chalk.dim(`· ${issue.priority}`));
    }
    console.log();
  }
}

async function pickBoard(config: JiraConfig): Promise<JiraBoard | null> {
  if (config.boardId) {
    try {
      return await getBoard(config, config.boardId);
    } catch (err) {
      console.log(
        chalk.yellow(
          `\nJIRA_BOARD_ID ${config.boardId} is invalid: ${err instanceof Error ? err.message : String(err)}`,
        ),
      );
      console.log(chalk.dim("Pick a board manually.\n"));
    }
  }

  let boards: JiraBoard[];
  try {
    boards = await listBoards(config, config.projectKey);
  } catch (err) {
    console.log(
      chalk.red(`\nCould not list boards: ${err instanceof Error ? err.message : String(err)}\n`),
    );
    return null;
  }

  if (boards.length === 0) {
    console.log(chalk.yellow("\nNo boards found."));
    if (config.projectKey) {
      console.log(chalk.dim(`Checked project ${config.projectKey}.\n`));
    } else {
      console.log(chalk.dim("Set JIRA_PROJECT_KEY or JIRA_BOARD_ID to narrow the search.\n"));
    }
    return null;
  }

  if (boards.length === 1) return boards[0]!;

  const picked = await select({
    message: "Select a board",
    options: [
      ...boards.map((board) => ({
        value: String(board.id),
        label: board.name,
        hint: `${board.type} · #${board.id}`,
      })),
      { value: "__back", label: "<- Back" },
    ],
  });
  if (isCancel(picked) || picked === "__back") return null;
  return boards.find((b) => String(b.id) === picked) ?? null;
}

export async function runBrowseBoard(
  config: JiraConfig,
  onPick?: (config: JiraConfig, issueKey: string) => Promise<void>,
): Promise<void> {
  const board = await pickBoard(config);
  if (!board) return;

  console.log(chalk.dim(`\nFetching tickets from ${board.name}…`));

  let result;
  try {
    result = await getAllBoardIssues(config, board.id);
  } catch (err) {
    console.log(
      chalk.red(`\nCould not load board tickets: ${err instanceof Error ? err.message : String(err)}\n`),
    );
    return;
  }

  printBoardIssues(result.board, result.issues);
  if (result.issues.length === 0 || !onPick) return;

  const picked = await pickIssueFromList(result.issues);
  if (!picked) return;
  await onPick(config, picked.key);
}
