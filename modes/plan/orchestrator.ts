import { z } from "zod";
import chalk from "chalk";
import { confirm, isCancel, text } from "@clack/prompts";
import { ToolLoopAgent, stepCountIs, tool } from "ai";
import { getAgentModel } from "../../ai/ai.config.ts";
import { ActionTracker } from "../agent/action-tracker.ts";
import { ToolExecutor } from "../agent/tool-executor.ts";
import { createAgentTools } from "../agent/agent-tools.ts";
import { defaultAgentConfig } from "../agent/config.ts";
import { runApprovalFlow } from "../agent/approval.ts";
import { renderTerminalMarkdown } from "../../tui/terminal-md.ts";


export function createAskTools(executor: ToolExecutor) {
    return {
        read_file: tool({
            description: "Read a file in the codebase",
            inputSchema: z.object({
                path: z.string(),
            }),
            execute: async ({ path }) => executor.readFile(path),
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
    }
}

export async function runAskMode(){
    console.log(chalk.bold("\n 💬 Ask Mode \n")); 
    const questions = await text({ message: "What do you want to ask?" })    
    const config = defaultAgentConfig()
    config.tools.allowFileCreation = true
    config.tools.allowFileModification = false;
    config.tools.allowFolderCreation = false;
    config.tools.allowShellExecution = false;

}