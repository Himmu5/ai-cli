export interface JiraIssueSummary {
  key: string;
  summary: string;
  status: string;
  priority: string;
}

export interface JiraUser {
  accountId: string;
  displayName: string;
  emailAddress?: string;
}

export interface JiraIssueDetail extends JiraIssueSummary {
  description: string;
  issueType: string;
  labels: string[];
  assignee?: JiraUser;
  url: string;
}

export interface JiraBoard {
  id: number;
  name: string;
  type: string;
}

export interface JiraBoardIssuesResult {
  board: JiraBoard;
  issues: JiraIssueSummary[];
  total: number;
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
