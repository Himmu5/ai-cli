import chalk from "chalk";
import { confirm, isCancel, text } from "@clack/prompts";
import { ToolLoopAgent, stepCountIs, tool } from "ai";
import { z } from "zod";
import { getAgentModel } from "../../ai/ai.config";
import { ActionTracker } from "../agent/action-tracker";
import { ToolExecutor } from "../agent/tool-executor";
import { defaultAgentConfig } from "../agent/config";
import { renderTerminalMarkdown } from "../../tui/terminal-md";
import { runApprovalFlow } from "../agent/approval";
import { createWebTools } from '../plan/web-tools'


function createAskTools(executor: ToolExecutor) {
    return {
        read_file: tool({
            description: "Read a file in the codebase",
            inputSchema: z.object({
                path: z.string(),
            }),
            execute: async ({ path }) => executor.readFile(path),
        }),
        list_files: tool({
            description: "List files and directories under a path.",
            inputSchema: z.object({
                path: z.string(),
                recursive: z.boolean().optional().default(false),
            }),
            execute: async ({ path: p, recursive }) =>
                executor.listFiles(p, recursive),
        }),

        search_files: tool({
            description:
                'Find files matching a glob pattern (e.g. "*.ts", "**/*.md"). Optional content substring filter.',
            inputSchema: z.object({
                root: z.string().describe("Directory to search, relative to root"),
                pattern: z
                    .string()
                    .describe("Glob-like pattern using * and ** (forward slashes)"),
                content_contains: z.string().optional(),
            }),
            execute: async ({ root, pattern, content_contains }) =>
                executor.searchFiles(root, pattern, content_contains),
        }),

        analyze_codebase: tool({
            description:
                "Summarize structure: file counts, size, extensions. Read-only.",
            inputSchema: z.object({
                path: z.string().default("."),
            }),
            execute: async ({ path: p }) => executor.analyzeCodebase(p),
        }),
        list_skills: tool({
            description:
              "List absolute paths to SKILL.md files under configured skill directories (Cursor / Claude).",
            inputSchema: z.object({}),
            execute: async () => executor.listSkills(),
          }),
      
        read_skill: tool({
            description:
              "Read a SKILL.md file. Path must be absolute and under skill roots, or use a path returned by list_skills.",
            inputSchema: z.object({
              path: z.string(),
            }),
            execute: async ({ path: p }) => executor.readSkill(p),
        }),
    }
}


function asMd(question: string, answer: string): string {
    return `# Ask Mode\n\n## Question\n\n${question.trim()}\n\n## Answer\n\n${answer.trim()}\n`;
}
  

export async function runAskMode(){
    console.log(chalk.bold("\n ? Ask Mode\n"))
    
    const question = await text({ message: "What do you want to ask?" })
    if(isCancel(question) || !question.trim()) return;
    
    const config = defaultAgentConfig();
    
    config.tools.allowFileCreation = true;
    config.tools.allowFileModification = false;
    config.tools.allowFolderCreation = false;
    config.tools.allowShellExecution = false;
    
    const tracker = new ActionTracker();
    const executor = new ToolExecutor(tracker, config)

    const tools = {
        ...createAskTools(executor)
    }
    const agent = new ToolLoopAgent({
        model: getAgentModel(),
        stopWhen: stepCountIs(20),
        tools
    })
    const result = await agent.generate({ prompt: question.trim() })
    const answer = result.text.trim() || "No Answer"
    console.log("\n"+ renderTerminalMarkdown(answer)+"\n");
    const wantsSave = await confirm({
        message: 'Do you want to save this into a .md file in directory?',
        initialValue : false
    })

    if(isCancel(wantsSave) || !wantsSave) return;

    const fileName = await text({
        message: "Filename",
        initialValue: "ask.md",
        validate: (v)=>{
            const s = (v ?? "").trim();
            if(!s) return "Required"
            if(s.includes("..") || s.includes('/') || s.includes("\\")) return "No Path";
            if(!s.toLowerCase().endsWith(".md")) return 'Must end with .md';
        }
    })

    if(isCancel(fileName)) return;
    executor.createFile(fileName, asMd(question, answer))

    const ok = await runApprovalFlow(tracker);
    if(!ok) return executor.clearStaging();

    executor.applyApprovedFromTracker();
    executor.clearStaging()

}