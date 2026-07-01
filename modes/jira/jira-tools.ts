import { tool } from "ai";
import { z } from "zod";
import {
  assignIssue,
  getAllBoardIssues,
  getIssue,
  listBoards,
  searchAssignableUsers,
  searchIssues,
} from "./client.ts";
import type { JiraConfig } from "./config.ts";

function formatIssueList(
  issues: { key: string; summary: string; status: string; priority: string }[],
): string {
  if (issues.length === 0) return "No issues found.";
  return issues
    .map((i) => `${i.key}: ${i.summary} (${i.status}, ${i.priority})`)
    .join("\n");
}

export function createJiraTools(config: JiraConfig) {
  return {
    jira_search_issues: tool({
      description:
        "Search Jira issues with JQL. Use to find tickets by assignee, status, project, etc.",
      inputSchema: z.object({
        jql: z.string().describe("JQL query string"),
        max_results: z.number().int().min(1).max(100).optional().default(25),
      }),
      execute: async ({ jql, max_results }) => {
        const { issues, total } = await searchIssues(config, jql, max_results);
        return { total, issues, formatted: formatIssueList(issues) };
      },
    }),

    jira_get_board_tickets: tool({
      description:
        "Fetch all tickets from a Jira board. Uses JIRA_BOARD_ID when board_id is omitted.",
      inputSchema: z.object({
        board_id: z
          .number()
          .int()
          .optional()
          .describe("Board ID; defaults to JIRA_BOARD_ID or the only project board"),
      }),
      execute: async ({ board_id }) => {
        let boardId = board_id ?? config.boardId;
        if (!boardId) {
          const boards = await listBoards(config, config.projectKey);
          if (boards.length === 1) boardId = boards[0]!.id;
          else if (boards.length === 0) {
            return { error: "No boards found. Set JIRA_BOARD_ID or pass board_id." };
          } else {
            return {
              error: "Multiple boards found. Pass board_id.",
              boards: boards.map((b) => ({ id: b.id, name: b.name, type: b.type })),
            };
          }
        }

        const { board, issues, total } = await getAllBoardIssues(config, boardId);
        return {
          board: { id: board.id, name: board.name, type: board.type },
          total,
          issues,
          formatted: formatIssueList(issues),
        };
      },
    }),

    jira_get_issue: tool({
      description: "Get full details for a Jira issue by key.",
      inputSchema: z.object({
        issue_key: z.string().describe("Issue key, e.g. PROJ-123"),
      }),
      execute: async ({ issue_key }) => {
        const issue = await getIssue(config, issue_key.trim().toUpperCase());
        return {
          key: issue.key,
          summary: issue.summary,
          status: issue.status,
          priority: issue.priority,
          issueType: issue.issueType,
          assignee: issue.assignee?.displayName ?? "Unassigned",
          labels: issue.labels,
          url: issue.url,
          description: issue.description,
        };
      },
    }),

    jira_assign_issue: tool({
      description:
        "Assign a Jira issue to a user, yourself, or unassign it. Use jira_search_assignable_users to find account IDs.",
      inputSchema: z.object({
        issue_key: z.string().describe("Issue key, e.g. PROJ-123"),
        account_id: z
          .string()
          .nullable()
          .describe("Assignee account ID, or null to unassign"),
      }),
      execute: async ({ issue_key, account_id }) => {
        const key = issue_key.trim().toUpperCase();
        await assignIssue(config, key, account_id);
        const issue = await getIssue(config, key);
        return {
          key: issue.key,
          assignee: issue.assignee?.displayName ?? "Unassigned",
          url: issue.url,
        };
      },
    }),

    jira_search_assignable_users: tool({
      description: "Search users who can be assigned to a Jira issue.",
      inputSchema: z.object({
        issue_key: z.string().describe("Issue key, e.g. PROJ-123"),
        query: z.string().optional().default("").describe("Name or email filter"),
      }),
      execute: async ({ issue_key, query }) => {
        const users = await searchAssignableUsers(
          config,
          issue_key.trim().toUpperCase(),
          query,
        );
        return {
          users: users.map((u) => ({
            accountId: u.accountId,
            displayName: u.displayName,
            emailAddress: u.emailAddress,
          })),
        };
      },
    }),

    jira_list_boards: tool({
      description: "List Jira boards, optionally filtered by project.",
      inputSchema: z.object({
        project_key: z
          .string()
          .optional()
          .describe("Project key filter; defaults to JIRA_PROJECT_KEY"),
      }),
      execute: async ({ project_key }) => {
        const boards = await listBoards(config, project_key ?? config.projectKey);
        return { boards };
      },
    }),
  };
}
