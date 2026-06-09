# BotWA

A feature-rich, high-performance WhatsApp Bot built with TypeScript, Baileys, Prisma, and Redis.

## Features

- **TypeScript Core**: Robust, strongly-typed codebase for reliability and ease of maintenance.
- **WhatsApp Web API Integration**: Powered by `@whiskeysockets/baileys` for seamless WhatsApp communication.
- **Database & Persistence**: Integration with PostgreSQL/SQLite via Prisma ORM.
- **Job Queue**: Utilizes BullMQ with Redis for background task handling and queue processing.
- **Caching**: Memory and Redis-based caching layers for improved performance.
- **AI Integrations**: Ready for Gemini API, OpenRouter, and Groq-sdk for advanced conversational intelligence.
- **Code Quality**: Linted and formatted using Biome.
- **Testing**: Built-in test suite powered by Vitest.

## Prerequisites

Before setting up the bot, ensure you have the following installed:

- **Node.js** (v22 or higher)
- **pnpm** (preferred package manager)
- **Redis Server** (for queue and caching)
- **PostgreSQL** (or any database supported by Prisma)

## Installation

1. Clone the repository:
   ```bash
   git clone git@github.com:Kairuuya/botwa.git
   cd botwa
   ```

2. Make the installation script executable and run it:
   ```bash
   chmod +x install.sh
   ./install.sh
   ```
   Or manually:
   ```bash
   pnpm install
   cp .env.example .env
   pnpm prisma db push
   ```

3. Configure your environmental variables in `.env` and bot configurations in `config.json`.

## Usage

### Development Mode
To start the bot in development mode with hot-reloading:
```bash
pnpm dev
```

### Production Mode
Build the project and run the built Javascript files:
```bash
pnpm build
pnpm start
```

### Formatting and Linting
To check and automatically fix linting/formatting errors:
```bash
pnpm lint
pnpm format
```

### Testing
To run the Vitest test suite:
```bash
pnpm test
```

## Configuration

- `.env`: Configure credentials, AI API keys (Gemini, OpenRouter, Groq), database URL, and Redis hosts.
- `config.json`: General bot configurations (bot name, bot owner numbers, prefix, etc.).

## License

This project is licensed under the MIT License.
