import express from 'express';
import path from 'path';
import fetch from 'node-fetch';
import type { Response } from 'node-fetch';
import { config } from 'dotenv';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';

config();

const app = express();
app.use(express.json());

const server = new McpServer({
  name: 'top-movers-app',
  version: '0.1.0',
});

const limitSchema = z
  .number({ invalid_type_error: 'limit must be a number' })
  .int()
  .min(1)
  .max(20)
  .default(10);

const toolInputSchema = z.object({
  limit: limitSchema.optional(),
});

const toolOutputSchema = z.object({
  gainers: z
    .array(
      z.object({
        ticker: z.string(),
        price: z.number(),
        change: z.number(),
        changePercent: z.number(),
        volume: z.number().nullable(),
      }),
    )
    .default([]),
  losers: z
    .array(
      z.object({
        ticker: z.string(),
        price: z.number(),
        change: z.number(),
        changePercent: z.number(),
        volume: z.number().nullable(),
      }),
    )
    .default([]),
  mostActive: z
    .array(
      z.object({
        ticker: z.string(),
        price: z.number(),
        change: z.number(),
        changePercent: z.number(),
        volume: z.number().nullable(),
      }),
    )
    .default([]),
});

type ToolOutput = z.infer<typeof toolOutputSchema>;

type TopMoversResponse = {
  top_gainers?: Array<Record<string, string>>;
  top_losers?: Array<Record<string, string>>;
  top_most_actively_traded?: Array<Record<string, string>>;
  message?: string;
  note?: string;
};

type YahooQuote = {
  symbol?: string;
  shortName?: string;
  longName?: string;
  regularMarketPrice?: number;
  regularMarketPreviousClose?: number;
  regularMarketChange?: number;
  regularMarketChangePercent?: number;
};

type YahooFinanceResponse = {
  finance?: {
    result?: Array<{
      quotes?: YahooQuote[];
    }>;
    error?: unknown;
  };
};

type NormalizedYahooQuote = {
  symbol: string;
  name: string;
  price: number | null;
  previousClose: number | null;
  change: number | null;
  changePercent: number | null;
};

const parseNumericString = (value: string | undefined): number | null => {
  if (!value) {
    return null;
  }
  const normalized = value.replace(/[+,%$M]/g, '').trim();
  const parsed = Number.parseFloat(normalized);
  return Number.isNaN(parsed) ? null : parsed;
};

const normalizeEntry = (entry: Record<string, string>) => ({
  ticker: entry.ticker ?? entry.symbol ?? 'N/A',
  price: parseNumericString(entry.price) ?? 0,
  change: parseNumericString(entry.change_amount) ?? 0,
  changePercent: parseNumericString(entry.change_percentage) ?? 0,
  volume: (() => {
    const rawVolume = parseNumericString(entry.volume);
    if (rawVolume !== null) {
      return rawVolume;
    }
    const volumeMillions = parseNumericString(entry.volume_millions);
    return volumeMillions !== null ? Math.round(volumeMillions * 1_000_000) : null;
  })(),
});

const ensureSuccess = (response: Response) => {
  if (!response.ok) {
    throw new Error(`Alpha Vantage request failed with status ${response.status}`);
  }
};

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const normalizeYahooQuote = (quote: YahooQuote): NormalizedYahooQuote => {
  const symbol = quote.symbol?.trim() ?? 'N/A';
  const rawName = quote.shortName ?? quote.longName ?? '';
  const trimmedName = rawName.trim();

  return {
    symbol,
    name: trimmedName.length > 0 ? trimmedName : 'Unknown Company',
    price: isFiniteNumber(quote.regularMarketPrice) ? quote.regularMarketPrice : null,
    previousClose: isFiniteNumber(quote.regularMarketPreviousClose)
      ? quote.regularMarketPreviousClose
      : null,
    change: isFiniteNumber(quote.regularMarketChange) ? quote.regularMarketChange : null,
    changePercent: isFiniteNumber(quote.regularMarketChangePercent)
      ? quote.regularMarketChangePercent
      : null,
  };
};

async function getYahooGainers(): Promise<NormalizedYahooQuote[]> {
  const url = new URL(
    'https://query1.finance.yahoo.com/v1/finance/screener/predefined/saved',
  );
  url.searchParams.set('scrIds', 'day_gainers');
  url.searchParams.set('count', '25');
  url.searchParams.set('start', '0');
  url.searchParams.set('lang', 'en-US');

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Yahoo Finance request failed with status ${response.status}`);
  }

  const data = (await response.json()) as YahooFinanceResponse;
  const quotes = data.finance?.result?.[0]?.quotes ?? [];

  return quotes
    .map(normalizeYahooQuote)
    .filter((quote) => quote.symbol !== 'N/A' && quote.symbol.length > 0);
}

async function getTopMovers(limit: number): Promise<ToolOutput> {
  const apiKey = process.env.ALPHA_VANTAGE_API_KEY;
  if (!apiKey) {
    throw new Error('Missing ALPHA_VANTAGE_API_KEY environment variable.');
  }

  const url = new URL('https://www.alphavantage.co/query');
  url.searchParams.set('function', 'TOP_GAINERS_LOSERS');
  url.searchParams.set('apikey', apiKey);

  const response = await fetch(url);
  ensureSuccess(response);
  const data = (await response.json()) as TopMoversResponse;

  if (data.message || data.note) {
    throw new Error(data.message || data.note || 'Unexpected response from Alpha Vantage.');
  }

  const limitValue = limitSchema.parse(limit);

  const normalizeList = (items: Array<Record<string, string>> | undefined) =>
    (items ?? []).slice(0, limitValue).map(normalizeEntry);

  const output: ToolOutput = {
    gainers: normalizeList(data.top_gainers),
    losers: normalizeList(data.top_losers),
    mostActive: normalizeList(data.top_most_actively_traded),
  };

  return output;
}

server.registerTool(
  'topMovers',
  {
    title: 'Top Movers',
    description: 'Fetches the current top gaining, losing, and most actively traded US stocks from Alpha Vantage.',
    inputSchema: toolInputSchema.shape,
    outputSchema: toolOutputSchema.shape,
  },
  async ({ limit }) => {
    const resolvedLimit = limitSchema.parse(limit ?? 10);
    const result = await getTopMovers(resolvedLimit);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
      structuredContent: result,
    };
  },
);

app.post('/mcp', async (req, res) => {
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });

  res.on('close', () => {
    transport.close();
  });

  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
});

app.get('/api/top-movers', async (req, res) => {
  try {
    const limitValue = limitSchema.parse(
      req.query.limit ? Number.parseInt(String(req.query.limit), 10) : 10,
    );
    const data = await getTopMovers(limitValue);
    res.json(data);
  } catch (error) {
    console.error('Failed to fetch top movers', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

app.get('/api/yahoo-gainers', async (_req, res) => {
  try {
    const quotes = await getYahooGainers();
    res.json({ quotes });
  } catch (error) {
    console.error('Failed to fetch Yahoo gainers', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

const publicDir = path.resolve(process.cwd(), 'public');
app.use(express.static(publicDir));

const port = Number.parseInt(process.env.PORT || '3000', 10);

app.listen(port, () => {
  console.log(`Top Movers server is running at http://localhost:${port}`);
  console.log(`MCP endpoint available at http://localhost:${port}/mcp`);
});
