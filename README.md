# claude-cli-test by Himanshu

A CLI-based project built with **Bun** and **TypeScript** for testing/developing AI agent workflows.

## 📋 Prerequisites

- **Bun** v1.0+ (recommended) – [Install Bun](https://bun.sh/docs/installation)
- **Node.js** 18+ (fallback if not using Bun)
- **Git** for version control

## 🚀 Quick Start

### 1. Clone the repository

```bash
git clone <repository-url>
cd claude-cli-test
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

# Production build + run
bun run build && bun run start

# Direct execution (TypeScript)
bun run index.ts
```

## 📦 Available Scripts

| Command | Description |
|---------|-------------|
| `bun run dev` | Start development server with hot reload |
| `bun run build` | Compile TypeScript to JavaScript (outputs to `dist/`) |
| `bun run start` | Run compiled JavaScript from `dist/` |
| `bun run index.ts` | Run TypeScript directly via Bun |
| `bun test` | Run test suite |
| `bun run lint` | Lint codebase |
| `bun run format` | Format code with Prettier |

## 🗂️ Project Structure

```
claude-cli-test/
├── .cursor/              # Cursor IDE configuration & rules
├── ai/                   # AI-related configuration
│   └── ai.config.ts      # AI provider settings
├── modes/                # Different operation modes
│   ├── agent/            # Autonomous agent mode
│   ├── ask/              # Interactive Q&A mode
│   ├── plan/             # Planning/execution mode
│   └── telegram/         # Telegram bot integration
├── tui/                  # Terminal UI components
├── index.ts              # Main entry point
├── package.json          # Project metadata & dependencies
├── tsconfig.json         # TypeScript configuration
├── bun.lock              # Bun lockfile
└── README.md             # This file
```

## ⚙️ Configuration

### Environment Variables

Create a `.env` file in the project root (copy from `.env.example` if available):

```env
# AI Provider API Keys
ANTHROPIC_API_KEY=your_anthropic_key
OPENAI_API_KEY=your_openai_key

# Telegram Bot (if using telegram mode)
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_CHAT_ID=your_chat_id

# Optional: Custom settings
LOG_LEVEL=debug
```

### TypeScript Configuration

The project uses strict TypeScript settings defined in `tsconfig.json`:

- Target: ES2022
- Module: ESNext
- Strict mode: enabled
- Module resolution: Bundler

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
3. Register the mode in the main entry point (`index.ts`)

## 🐳 Docker Support (Optional)

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
docker build -t claude-cli-test .
docker run -it --env-file .env claude-cli-test
```

## 📚 Key Dependencies

| Package | Purpose |
|---------|---------|
| `bun` | Runtime, bundler, test runner |
| `typescript` | Type-safe JavaScript |
| `@types/node` | Node.js type definitions |

See `package.json` for complete dependency list.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
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

This project is licensed under the MIT License – see the [LICENSE](LICENSE) file for details.

## 🙋 Support

- **Issues**: [GitHub Issues](https://github.com/yourusername/claude-cli-test/issues)
- **Discussions**: [GitHub Discussions](https://github.com/yourusername/claude-cli-test/discussions)

---

> **Note**: This project was initialized with `bun init` in Bun v1.3.14. [Bun](https://bun.sh) is a fast all-in-one JavaScript runtime.