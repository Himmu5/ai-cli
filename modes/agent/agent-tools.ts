import { tool } from "ai";
import { z } from "zod";
import type { ToolExecutor } from "./tool-executor.ts";

export function createAgentTools(executor: ToolExecutor) {
  return {
    read_file: tool({
      description: "Read a file in the codebase",
      inputSchema: z.object({
        path: z.string(),
      }),
      execute: async ({ path }) => executor.readFile(path),
    }),
    create_file: tool({
      description: "Create a new file in the codebase",
      inputSchema: z.object({
        path: z.string(),
        content: z.string(),
      }),
      execute: async ({ path, content }) => executor.createFile(path, content),
    }),
    modify_file: tool({
      description: "Modify an existing file in the codebase",
      inputSchema: z.object({
        path: z.string(),
        content: z.string(),
      }),
      execute: async ({ path, content }) => executor.modifyFile(path, content),
    }),
    delete_file: tool({
      description: "Delete a file in the codebase",
      inputSchema: z.object({
        path: z.string(),
      }),
      execute: async ({ path }) => executor.deleteFile(path),
    }),
    search_files: tool({
      description: "Search for files in the codebase",
      inputSchema: z.object({
        root: z.string().default("."),
        glob: z.string().default("**/*"),
        query: z.string().optional(),
      }),
      execute: async ({ root, glob, query }) =>
        executor.searchFiles(root, glob, query),
    }),
    list_skills: tool({
      description: "List all available agent skills",
      inputSchema: z.object({}),
      execute: async () => executor.listSkills(),
    }),
    read_skill: tool({
      description: "Read a skill file by path",
      inputSchema: z.object({
        path: z.string(),
      }),
      execute: async ({ path }) => executor.readSkill(path),
    }),
  };
}
