export interface JiraConfig {
  baseUrl: string;
  email: string;
  apiToken: string;
  defaultJql: string;
  projectKey?: string;
  boardId?: number;
}

export function getJiraConfig(): JiraConfig {
  const baseUrl = process.env.JIRA_BASE_URL?.replace(/\/$/, "");
  const email = process.env.JIRA_EMAIL;
  const apiToken = process.env.JIRA_API_TOKEN;

  if (!baseUrl) {
    throw new Error("JIRA_BASE_URL is required (e.g. https://your-org.atlassian.net)");
  }
  if (!email) {
    throw new Error("JIRA_EMAIL is required (your Atlassian account email)");
  }
  if (!apiToken) {
    throw new Error("JIRA_API_TOKEN is required (create one at id.atlassian.com)");
  }

  const project = process.env.JIRA_PROJECT_KEY?.trim();
  const boardRaw = process.env.JIRA_BOARD_ID?.trim();
  const boardId = boardRaw ? Number(boardRaw) : undefined;
  if (boardRaw && (!boardId || Number.isNaN(boardId))) {
    throw new Error("JIRA_BOARD_ID must be a numeric board ID");
  }

  const defaultJql =
    process.env.JIRA_DEFAULT_JQL?.trim() ||
    (project
      ? `project = ${project} AND assignee = currentUser() AND status != Done ORDER BY updated DESC`
      : "assignee = currentUser() AND status != Done ORDER BY updated DESC");

  return { baseUrl, email, apiToken, defaultJql, projectKey: project || undefined, boardId };
}
