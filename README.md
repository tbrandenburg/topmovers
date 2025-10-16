# Top Movers ChatGPT App

A minimal TypeScript ChatGPT App that exposes a `topMovers` Model Context Protocol tool backed by Alpha Vantage's `TOP_GAINERS_LOSERS` endpoint. The project provides an Express server that serves an interactive widget and a Streamable HTTP MCP endpoint ready to be tunnelled through ngrok for ChatGPT Apps development.

## Prerequisites

- Node.js 18+
- An [Alpha Vantage](https://www.alphavantage.co/support/#api-key) API key
- An ngrok account and access token for secure tunnelling

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```
2. Copy the sample environment file and add your Alpha Vantage API key:
   ```bash
   cp .env.example .env
   # edit .env to set ALPHA_VANTAGE_API_KEY
   ```

## Development

Run the TypeScript server directly:
```bash
npm run dev
```

The server serves the widget at [http://localhost:3000](http://localhost:3000) and exposes the MCP endpoint at [http://localhost:3000/mcp](http://localhost:3000/mcp).

### Expose the MCP server with ngrok

In a new terminal, start an ngrok tunnel so ChatGPT can reach your MCP server:
```bash
ngrok http 3000
```

Copy the HTTPS URL that ngrok prints (for example `https://sample.ngrok-free.app`) and register it as the MCP endpoint inside the [ChatGPT Apps MCP configuration](https://developers.openai.com/apps-sdk/quickstart).

## Production build

Compile the TypeScript sources and run the production server:
```bash
npm run build
npm start
```

## Widget behaviour

- On load the widget calls `window.openai.callTool('topMovers', { limit })` to populate responsive tables for top gainers, losers, and most active tickers.
- Outside the ChatGPT Apps runtime the widget falls back to the local REST helper at `/api/top-movers` for easier development.

## Project structure

```
├─ public/          # Static widget assets (HTML, CSS, JS)
├─ src/server.ts    # Express server with MCP tool registration
├─ .env.example     # Environment variables template
└─ README.md        # Project documentation
```
