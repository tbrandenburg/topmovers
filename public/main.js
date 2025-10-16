const tablesContainer = document.getElementById('tables');
const refreshButton = document.getElementById('refresh');
const limitInput = document.getElementById('limit');
const statusElement = document.getElementById('status');

const numberFormatter = new Intl.NumberFormat(undefined, {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const currencyFormatter = new Intl.NumberFormat(undefined, {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const integerFormatter = new Intl.NumberFormat(undefined, {
  maximumFractionDigits: 0,
});

const isFiniteNumber = (value) => typeof value === 'number' && Number.isFinite(value);

const formatCurrencyValue = (value) =>
  isFiniteNumber(value) ? currencyFormatter.format(value) : '–';

const formatSignedCurrency = (value) => {
  if (!isFiniteNumber(value)) {
    return '–';
  }
  const formatted = currencyFormatter.format(Math.abs(value));
  return `${value >= 0 ? '+' : '-'}${formatted}`;
};

function getSymbolUrl(symbol) {
  const normalized = (symbol ?? '').trim();
  if (normalized.length === 0) {
    return '#';
  }
  const encoded = encodeURIComponent(normalized);
  return `https://finance.yahoo.com/quote/${encoded}`;
}

function setStatus(message, tone = 'info') {
  statusElement.textContent = message;
  statusElement.dataset.tone = tone;
}

function createChangeBadge(value) {
  const badge = document.createElement('span');
  const arrow = document.createElement('span');
  const percent = Number.isFinite(value) ? value : 0;
  const isPositive = percent >= 0;
  badge.className = `badge ${isPositive ? 'gain' : 'loss'}`;
  arrow.textContent = isPositive ? '▲' : '▼';
  badge.appendChild(arrow);
  badge.appendChild(
    document.createTextNode(`${numberFormatter.format(Math.abs(percent))}%`),
  );
  return badge;
}

function createTableSection(title, rows) {
  const card = document.createElement('article');
  card.className = 'table-card';

  const heading = document.createElement('h2');
  heading.textContent = title;
  card.appendChild(heading);

  if (!rows || rows.length === 0) {
    const emptyState = document.createElement('p');
    emptyState.textContent = 'No data available right now.';
    card.appendChild(emptyState);
    return card;
  }

  const table = document.createElement('table');
  const thead = document.createElement('thead');
  const headRow = document.createElement('tr');

  ;['Symbol', 'Price', 'Change', '% Change', 'Volume'].forEach((header) => {
    const th = document.createElement('th');
    th.textContent = header;
    headRow.appendChild(th);
  });

  thead.appendChild(headRow);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');

  rows.forEach((row) => {
    const tr = document.createElement('tr');

    const symbolCell = document.createElement('td');
    if (row.ticker) {
      const symbolLink = document.createElement('a');
      symbolLink.href = getSymbolUrl(row.ticker);
      symbolLink.textContent = row.ticker;
      symbolLink.target = '_blank';
      symbolLink.rel = 'noopener noreferrer';
      symbolLink.className = 'symbol-link';
      symbolCell.appendChild(symbolLink);
    } else {
      symbolCell.textContent = '—';
    }
    tr.appendChild(symbolCell);

    const priceCell = document.createElement('td');
    priceCell.textContent = currencyFormatter.format(row.price);
    tr.appendChild(priceCell);

    const changeCell = document.createElement('td');
    const formattedChange = currencyFormatter.format(Math.abs(row.change));
    changeCell.textContent = `${row.change >= 0 ? '+' : '-'}${formattedChange}`;
    tr.appendChild(changeCell);

    const percentCell = document.createElement('td');
    percentCell.appendChild(createChangeBadge(row.changePercent));
    tr.appendChild(percentCell);

    const volumeCell = document.createElement('td');
    volumeCell.textContent = row.volume != null ? integerFormatter.format(row.volume) : '–';
    tr.appendChild(volumeCell);

    tbody.appendChild(tr);
  });

  table.appendChild(tbody);
  card.appendChild(table);

  return card;
}

function createYahooGainersSection(quotes, errorMessage) {
  const card = document.createElement('article');
  card.className = 'table-card';

  const heading = document.createElement('h2');
  heading.textContent = 'Yahoo Gainers';
  card.appendChild(heading);

  if (errorMessage) {
    const errorText = document.createElement('p');
    errorText.textContent = errorMessage;
    card.appendChild(errorText);
    return card;
  }

  if (!quotes || quotes.length === 0) {
    const emptyState = document.createElement('p');
    emptyState.textContent = 'No data available right now.';
    card.appendChild(emptyState);
    return card;
  }

  const table = document.createElement('table');
  const thead = document.createElement('thead');
  const headRow = document.createElement('tr');

  ;[
    'Symbol',
    'Company Name',
    'Current Price',
    'Previous Close',
    'Price Change ($)',
    '% Change',
  ].forEach((header) => {
    const th = document.createElement('th');
    th.textContent = header;
    headRow.appendChild(th);
  });

  thead.appendChild(headRow);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');

  quotes.forEach((quote) => {
    const tr = document.createElement('tr');

    const symbolCell = document.createElement('td');
    if (quote.symbol) {
      const symbolLink = document.createElement('a');
      symbolLink.href = getSymbolUrl(quote.symbol);
      symbolLink.textContent = quote.symbol;
      symbolLink.target = '_blank';
      symbolLink.rel = 'noopener noreferrer';
      symbolLink.className = 'symbol-link';
      symbolCell.appendChild(symbolLink);
    } else {
      symbolCell.textContent = '—';
    }
    tr.appendChild(symbolCell);

    const nameCell = document.createElement('td');
    nameCell.textContent = quote.name ?? '—';
    tr.appendChild(nameCell);

    const priceCell = document.createElement('td');
    priceCell.textContent = formatCurrencyValue(quote.price);
    tr.appendChild(priceCell);

    const previousCloseCell = document.createElement('td');
    previousCloseCell.textContent = formatCurrencyValue(quote.previousClose);
    tr.appendChild(previousCloseCell);

    const changeCell = document.createElement('td');
    changeCell.textContent = formatSignedCurrency(quote.change);
    tr.appendChild(changeCell);

    const percentCell = document.createElement('td');
    if (isFiniteNumber(quote.changePercent)) {
      percentCell.appendChild(createChangeBadge(quote.changePercent));
    } else {
      percentCell.textContent = '–';
    }
    tr.appendChild(percentCell);

    tbody.appendChild(tr);
  });

  table.appendChild(tbody);
  card.appendChild(table);

  return card;
}

async function callTopMoversTool(limit) {
  if (window.openai?.callTool) {
    const response = await window.openai.callTool('topMovers', { limit });
    return response?.structuredContent ?? response;
  }

  const fallback = await fetch(`/api/top-movers?limit=${limit}`);
  if (!fallback.ok) {
    throw new Error(`Local request failed with status ${fallback.status}`);
  }
  return fallback.json();
}

async function fetchYahooGainers(limit) {
  const response = await fetch(`/api/yahoo-gainers?limit=${limit}`);
  if (!response.ok) {
    throw new Error(`Yahoo Finance request failed with status ${response.status}`);
  }

  const data = await response.json();
  if (!Array.isArray(data?.quotes)) {
    return [];
  }

  return data.quotes;
}

async function loadData() {
  const limit = Math.min(Math.max(parseInt(limitInput.value, 10) || 10, 1), 20);
  limitInput.value = limit;
  setStatus('Loading latest movers…');

  const yahooState = await fetchYahooGainers(limit)
    .then((quotes) => ({ quotes }))
    .catch((error) => {
      console.error('Failed to load Yahoo gainers', error);
      return {
        quotes: [],
        error: error instanceof Error ? error.message : 'Failed to load Yahoo gainers.',
      };
    });

  try {
    const data = await callTopMoversTool(limit);
    const normalized = {
      gainers: data?.gainers ?? [],
      losers: data?.losers ?? [],
      mostActive: data?.mostActive ?? [],
    };

    tablesContainer.replaceChildren();

    tablesContainer.appendChild(
      createYahooGainersSection(yahooState.quotes, yahooState.error),
    );

    const sections = [
      { key: 'gainers', title: 'Top Gainers' },
      { key: 'losers', title: 'Top Losers' },
      { key: 'mostActive', title: 'Most Active' },
    ];

    sections.forEach(({ key, title }) => {
      tablesContainer.appendChild(createTableSection(title, normalized[key]));
    });

    const timestamp = new Date().toLocaleTimeString();
    setStatus(`Updated at ${timestamp}.`);
  } catch (error) {
    console.error(error);
    tablesContainer.replaceChildren();
    tablesContainer.appendChild(
      createYahooGainersSection(yahooState.quotes, yahooState.error),
    );
    setStatus(error instanceof Error ? error.message : 'Failed to load top movers.', 'error');
  }
}

refreshButton.addEventListener('click', loadData);

window.addEventListener('DOMContentLoaded', () => {
  loadData();
});
