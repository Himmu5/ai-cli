export type ActionType =
  | "code_analysis"
  | "file_create"
  | "file_modify"
  | "file_delete"
  | "folder_create"
  | "tool_execute";

export type ActionStatus = "pending" | "approved" | "rejected" | "executed";

export interface ActionDetails {
  before?: string;
  after?: string;
  command?: string;
  toolName?: string;
}

export interface ActionLog {
  id: string;
  timestamp: Date;
  type: ActionType;
  path: string;
  details: ActionDetails;
  status: ActionStatus;
  userApproved?: boolean;
}

export interface AgentToolsConfig {
  allowFileCreation: boolean;
  allowFileModification: boolean;
  allowFolderCreation: boolean;
  allowShellExecution: boolean;
}

export interface AgentConfig {
  codebasePath: string;
  excludePatterns: string[];
  maxFileSizeToRead: number;
  tools: AgentToolsConfig;
}

export type ActionLogInput = Omit<ActionLog, "id" | "timestamp"> &
  Partial<Pick<ActionLog, "id" | "timestamp">>;

const MUTATION_TYPES = new Set<ActionType>([
  "file_create",
  "file_modify",
  "file_delete",
  "folder_create",
  "tool_execute",
]);

export function isMutationType(type: ActionType): boolean {
  return MUTATION_TYPES.has(type);
}

export const defaultAgentConfig = (): AgentConfig => ({
  codebasePath: process.cwd(),
  maxFileSizeToRead: 1024 * 1024 ,
  excludePatterns: [
    'node_modules',
    '.git',
    'dist',
    'build',
    '.next',
    '*.log',
    '.env*',
  ],
  tools: {
    allowShellExecution: true,
    allowFileModification: true,
    allowFileCreation: true,
    allowFolderCreation: true,
  },
});
