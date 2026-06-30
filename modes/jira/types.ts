export interface JiraIssueSummary {
  key: string;
  summary: string;
  status: string;
  priority: string;
}

export interface JiraIssueDetail extends JiraIssueSummary {
  description: string;
  issueType: string;
  labels: string[];
  url: string;
}

export interface JiraSearchResult {
  issues: JiraIssueSummary[];
  total: number;
}

export interface JiraProject {
  key: string;
  name: string;
}

export interface JiraIssueType {
  id: string;
  name: string;
}

export interface TicketDraft {
  summary: string;
  description: string;
  issueType: string;
  labels: string[];
}

export interface TicketUpdate {
  summary?: string;
  description?: string;
  labels?: string[];
}

export interface CreatedIssue {
  key: string;
  id: string;
  url: string;
}
