import { select, isCancel } from "@clack/prompts";
import chalk from "chalk";
import figlet from "figlet";
import { runCliMode } from "../modes/cli.ts"; 
import { runTelegramMode } from "../modes/telegram/index.ts";

const BANNER_FONT = "ANSI Shadow";
const SHADOW = chalk.hex("#5b4e9d");
const FACE = chalk.hex("e8dcf8").bold;

function printBannerWithShadow(ascii: string): void {
  const bannerLines = ascii.replace(/\s+$/, "").split("\n");
  const maxLen = Math.max(...bannerLines.map((l) => l.length), 0);
  const rowWidth = maxLen + 2;

  for (const line of bannerLines) {
    console.log(SHADOW(("  " + line).padEnd(rowWidth)));
  }
  process.stdout.write(`\x1b[${bannerLines.length}A`);
  for (const line of bannerLines) {
    console.log(FACE(line.padEnd(rowWidth)));
  }
  console.log();
}

export async function runWakeup(): Promise<void> {
  let ascii: string;
  try {
    ascii = figlet.textSync("My CLI Tool", { font: BANNER_FONT });
  } catch {
    ascii = figlet.textSync("My CLI Tool", { font: "Standard" });
  }
  printBannerWithShadow(ascii);

  const mode = await select({
    message: "Which mode do you want to proceed with?",
    options: [
      { value: "cli", label: "CLI" },
      { value: "telegram", label: "Telegram" },
      { value: "exit", label: "Exit" },
    ],
  });
  if (isCancel(mode)) {
    process.exit(0);
  }
  if (mode === "cli") {
    console.log(chalk.dim("CLI command running..."));
    await runCliMode();
  } else if (mode === "exit") {
    console.log(chalk.dim("Exit command running..."));
  } else {
    await runTelegramMode()
  }
}
