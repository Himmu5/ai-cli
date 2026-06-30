import type { JiraConfig } from "./config.ts";
import { adfToText, textToAdf } from "./adf.ts";
import type {
  CreatedIssue,
  JiraIssueDetail,
  JiraIssueSummary,
  JiraIssueType,
  JiraProject,
  JiraSearchResult,
  TicketDraft,
  TicketUpdate,
} from "./types.ts";

type JiraFieldValue = {
  name?: string;
  summary?: string;
  description?: unknown;
  status?: { name?: string };
  priority?: { name?: string };
  issuetype?: { name?: string };
  labels?: string[];
};

type JiraApiIssue = {
  key: string;
  fields: JiraFieldValue;
};

function authHeader(config: JiraConfig): string {
  const creds = `${config.email}:${config.apiToken}`;
  return `Basic ${btoa(creds)}`;
}

async function jiraFetch<T>(
  config: JiraConfig,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(`${config.baseUrl}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: authHeader(config),
      ...init?.headers,
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Jira API ${res.status}: ${body.slice(0, 300)}`);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

function toSummary(issue: JiraApiIssue): JiraIssueSummary {
  return {
    key: issue.key,
    summary: issue.fields.summary ?? "(no summary)",
    status: issue.fields.status?.name ?? "Unknown",
    priority: issue.fields.priority?.name ?? "None",
  };
}

function toDetail(config: JiraConfig, issue: JiraApiIssue): JiraIssueDetail {
  const summary = toSummary(issue);
  return {
    ...summary,
    description: adfToText(issue.fields.description).trim() || "(no description)",
    issueType: issue.fields.issuetype?.name ?? "Task",
    labels: issue.fields.labels ?? [],
    url: `${config.baseUrl}/browse/${issue.key}`,
  };
}

export async function verifyJiraConnection(config: JiraConfig): Promise<string> {
  const me = await jiraFetch<{ displayName?: string; emailAddress?: string }>(
    config,
    "/rest/api/3/myself",
  );
  return me.displayName ?? me.emailAddress ?? config.email;
}

export async function searchIssues(
  config: JiraConfig,
  jql: string,
  maxResults = 25,
): Promise<JiraSearchResult> {
  const data = await jiraFetch<{ issues?: JiraApiIssue[]; total?: number }>(
    config,
    "/rest/api/3/search/jql",
    {
      method: "POST",
      body: JSON.stringify({
        jql,
        maxResults,
        fields: ["summary", "status", "priority"],
      }),
    },
  );

  return {
    issues: (data.issues ?? []).map(toSummary),
    total: data.total ?? 0,
  };
}

export async function getIssue(
  config: JiraConfig,
  issueKey: string,
): Promise<JiraIssueDetail> {
  const issue = await jiraFetch<JiraApiIssue>(
    config,
    `/rest/api/3/issue/${encodeURIComponent(issueKey)}?fields=summary,description,status,priority,issuetype,labels`,
  );
  return toDetail(config, issue);
}

export async function addComment(
  config: JiraConfig,
  issueKey: string,
  body: string,
): Promise<void> {
  await jiraFetch(config, `/rest/api/3/issue/${encodeURIComponent(issueKey)}/comment`, {
    method: "POST",
    body: JSON.stringify({ body: textToAdf(body) }),
  });
}

export function formatIssueContext(issue: JiraIssueDetail): string {
  const lines = [
    `Issue: ${issue.key}`,
    `Summary: ${issue.summary}`,
    `Type: ${issue.issueType}`,
    `Status: ${issue.status}`,
    `Priority: ${issue.priority}`,
    `URL: ${issue.url}`,
  ];
  if (issue.labels.length) lines.push(`Labels: ${issue.labels.join(", ")}`);
  lines.push("", "Description:", issue.description);
  return lines.join("\n");
}

export async function listProjects(config: JiraConfig): Promise<JiraProject[]> {
  const data = await jiraFetch<{ values?: { key: string; name: string }[] }>(
    config,
    "/rest/api/3/project/search?maxResults=50&orderBy=name",
  );
  return (data.values ?? []).map((p) => ({ key: p.key, name: p.name }));
}

export async function getIssueTypes(
  config: JiraConfig,
  projectKey: string,
): Promise<JiraIssueType[]> {
  const data = await jiraFetch<{ issueTypes?: { id: string; name: string }[] }>(
    config,
    `/rest/api/3/issue/createmeta/${encodeURIComponent(projectKey)}/issuetypes`,
  );
  return (data.issueTypes ?? []).map((t) => ({ id: t.id, name: t.name }));
}

export async function createIssue(
  config: JiraConfig,
  projectKey: string,
  draft: TicketDraft,
  issueTypeId: string,
): Promise<CreatedIssue> {
  const fields: Record<string, unknown> = {
    project: { key: projectKey },
    summary: draft.summary,
    description: textToAdf(draft.description),
    issuetype: { id: issueTypeId },
  };
  if (draft.labels.length) fields.labels = draft.labels;

  const created = await jiraFetch<{ id: string; key: string }>(config, "/rest/api/3/issue", {
    method: "POST",
    body: JSON.stringify({ fields }),
  });

  return {
    id: created.id,
    key: created.key,
    url: `${config.baseUrl}/browse/${created.key}`,
  };
}

export async function updateIssue(
  config: JiraConfig,
  issueKey: string,
  update: TicketUpdate,
): Promise<void> {
  const fields: Record<string, unknown> = {};
  if (update.summary !== undefined) fields.summary = update.summary;
  if (update.description !== undefined) fields.description = textToAdf(update.description);
  if (update.labels !== undefined) fields.labels = update.labels;

  if (Object.keys(fields).length === 0) {
    throw new Error("No fields to update");
  }

  await jiraFetch(config, `/rest/api/3/issue/${encodeURIComponent(issueKey)}`, {
    method: "PUT",
    body: JSON.stringify({ fields }),
  });
}
