# Agentx

A CLI-based project built with **Bun** and **TypeScript** for testing/developing AI agent workflows.

**Version:** 0.0.4 | **Runtime:** Bun 1.0+ | **License:** ISC

---

## 📋 Prerequisites

- **Bun** v1.0+ (recommended) – [Install Bun](https://bun.sh/docs/installation)
- **Node.js** 18+ (fallback if not using Bun)
- **Git** for version control

## 🚀 Quick Start

### 1. Clone the repository

```bash
git clone <repository-url>
cd agentx
```

### 2. Install dependencies

Using **Bun** (recommended):
```bash
bun install
```

Or using npm/pnpm:
```bash
npm install
# or
pnpm install
```

### 3. Run the project

```bash
# Development mode (with hot reload)
bun run dev

# Run directly via Bun (TypeScript)
bun run index.ts

# Run via installed binary (after bun install)
agentx

# Using npx/bunx
bunx agentx
```

## 📦 Available Scripts

| Command | Description |
|---------|-------------|
| `bun run dev` | Start development with hot reload (`bun --hot index.ts`) |
| `bun run build` | Compile TypeScript to JavaScript (outputs to `dist/`) |
| `bun run start` | Run compiled JavaScript from `dist/` |
| `bun run index.ts` | Run TypeScript directly via Bun |
| `agentx` | Run the CLI tool (after `bun install` links the binary) |
| `bun test` | Run test suite |
| `bun run lint` | Lint codebase |
| `bun run format` | Format code with Prettier |
| `bun run typecheck` | Type-check TypeScript files |

> **Note:** The `bin` field in `package.json` registers `agentx` as an executable. After `bun install`, you can run `agentx` directly from anywhere.

## 🗂️ Project Structure

```
Agentx/
├── .cursor/                 # Cursor IDE configuration & rules
│   └── rules/               # Custom Cursor rules (e.g., use-bun-instead-of-node)
├── ai/                      # AI-related configuration
│   └── ai.config.ts         # AI provider settings (OpenRouter, Anthropic, etc.)
├── modes/                   # Different operation modes
│   ├── agent/               # Autonomous agent mode
│   │   ├── action-tracker.ts    # Tracks agent actions
│   │   ├── agent-tools.ts       # Tool definitions for agent
│   │   ├── approval.ts          # Approval workflow
│   │   ├── config.ts            # Agent configuration
│   │   ├── diff-view.ts         # Diff visualization
│   │   ├── orchestrator.ts      # Main agent loop
│   │   ├── tool-executor.ts     # Tool execution logic
│   │   └── types.ts             # Agent type definitions
│   ├── ask/                 # Interactive Q&A mode
│   │   └── orchestrator.ts      # Q&A orchestration
│   ├── plan/                # Planning/execution mode
│   │   ├── orchestrator.ts      # Plan orchestration
│   │   ├── planner.ts           # Planning logic
│   │   ├── selection.ts         # Plan selection
│   │   ├── types.ts             # Plan type definitions
│   │   └── web-tools.ts         # Web search/browse tools
│   ├── telegram/            # Telegram bot integration
│   │   ├── agent-run.ts         # Agent execution via Telegram
│   │   ├── approval-session.ts  # Approval sessions in chat
│   │   ├── auth.ts              # Telegram authentication
│   │   ├── constants.ts         # Bot constants
│   │   ├── handlers.ts          # Message handlers
│   │   ├── index.ts             # Telegram bot entry
│   │   ├── plan-session.ts      # Planning sessions via Telegram
│   │   └── text.ts              # Text formatting utilities
│   └── cli.ts               # CLI command definitions (Commander.js)
├── tui/                     # Terminal UI components
│   ├── terminal-md.ts       # Markdown rendering in terminal
│   └── wakeup.ts            # Terminal wakeup/animation
├── index.ts                 # Main entry point
├── package.json             # Project metadata & dependencies
├── tsconfig.json            # TypeScript configuration
├── bun.lock                 # Bun lockfile
└── README.md                # This file
```

## ⚙️ Configuration

### Environment Variables

Create a `.env` file in the project root:

```env
# AI Provider API Keys
ANTHROPIC_API_KEY=your_anthropic_key
OPENAI_API_KEY=your_openai_key
OPENROUTER_API_KEY=your_openrouter_key

# Telegram Bot (if using telegram mode)
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_CHAT_ID=your_chat_id

# Optional: Custom settings
LOG_LEVEL=debug
```

> **Bun automatically loads `.env` files** – no need for `dotenv` package.

### TypeScript Configuration

The project uses strict TypeScript settings defined in `tsconfig.json`:

- **Target:** ES2022
- **Module:** ESNext
- **Module Resolution:** Bundler
- **Strict Mode:** Enabled
- **JSX:** React (for terminal UI components)

## 🧪 Development Workflow

### Code Style

```bash
# Format code
bun run format

# Lint check
bun run lint

# Type check
bun run typecheck
```

### Adding New Modes

1. Create a new directory under `modes/`
2. Implement the mode's orchestrator and types
3. Register the mode in `modes/cli.ts` (Commander.js commands)
4. Import and wire up in `index.ts` if needed

### Testing

```bash
# Run all tests
bun test

# Run tests in watch mode
bun test --watch

# Run specific test file
bun test modes/agent/orchestrator.test.ts
```

## 🐳 Docker Support

```dockerfile
# Dockerfile
FROM oven/bun:1.0

WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . .
RUN bun run build

CMD ["bun", "run", "start"]
```

Build and run:
```bash
docker build -t agentx .
docker run -it --env-file .env agentx
```

## 📚 Key Dependencies

| Package | Purpose |
|---------|---------|
| `bun` | Runtime, bundler, test runner, package manager |
| `typescript` | Type-safe JavaScript |
| `@types/node` | Node.js type definitions |
| `commander` | CLI framework for command parsing |
| `ai` | Vercel AI SDK for LLM integration |
| `@openrouter/ai-sdk-provider` | OpenRouter provider for AI SDK |
| `@mendable/firecrawl-js` | Web scraping/search via Firecrawl |
| `telegraf` | Telegram bot framework |
| `@clack/prompts` | Beautiful CLI prompts |
| `chalk` | Terminal string styling |
| `figlet` | ASCII art text |
| `marked` / `marked-terminal` | Markdown parsing & terminal rendering |
| `diff` | Text diffing for approval views |
| `zod` | Schema validation |

See `package.json` for complete dependency list with versions.

## 🤖 Operation Modes

### Agent Mode (Autonomous)
```bash
agentx agent [task]
```
Runs an autonomous agent that can read/write files, execute commands, and complete tasks with approval workflow.

### Ask Mode (Interactive Q&A)
```bash
agentx ask [question]
```
Interactive question-answering mode with context awareness.

### Plan Mode (Planning/Execution)
```bash
agentx plan [goal]
```
Creates and executes multi-step plans with web search capabilities.

### Telegram Mode (Bot Integration)
```bash
agentx telegram
```
Runs the Telegram bot for remote agent control via chat.

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'feat: add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

### Commit Convention

Follow [Conventional Commits](https://www.conventionalcommits.org/):
- `feat:` – New feature
- `fix:` – Bug fix
- `docs:` – Documentation changes
- `refactor:` – Code refactoring
- `test:` – Adding tests
- `chore:` – Maintenance tasks

## 📄 License

This project is licensed under the ISC License.

## 🙋 Support

- **Issues**: [GitHub Issues](https://github.com/yourusername/agentx/issues)
- **Discussions**: [GitHub Discussions](https://github.com/yourusername/agentx/discussions)

---

> **Note:** This project is built with **Bun** – a fast all-in-one JavaScript runtime. [Learn more about Bun](https://bun.sh).