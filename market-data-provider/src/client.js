// Set FOREIGN_API_BASE_URL=http://market-data-provider-mock:3000 in dev/stage to use the companion mock

const fetch = require('node-fetch');

const BASE_URL = process.env.FOREIGN_API_BASE_URL || 'https://api.marketdata.com';
const API_KEY = process.env.FOREIGN_API_KEY;

/**
 * Build default request headers for all MarketDataAPI calls.
 * Auth: API key sent as x-api-key header per MarketDataAPI specification.
 */
function buildHeaders() {
  if (!API_KEY) {
    throw new Error('FOREIGN_API_KEY environment variable is not set');
  }
  return {
    'x-api-key': API_KEY,
    'Accept': 'application/json',
    'Content-Type': 'application/json',
  };
}

/**
 * Perform a GET request against MarketDataAPI and return raw parsed JSON.
 * Throws on non-2xx responses.
 *
 * @param {string} path - URL path relative to BASE_URL, e.g. "/quotes/AAPL"
 * @param {Record<string, string>} [queryParams] - Optional query string parameters
 * @returns {Promise<unknown>} Raw parsed JSON response body
 */
async function get(path, queryParams = {}) {
  const url = new URL(`${BASE_URL}${path}`);
  for (const [key, value] of Object.entries(queryParams)) {
    if (value !== undefined && value !== null) {
      url.searchParams.set(key, String(value));
    }
  }

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: buildHeaders(),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `MarketDataAPI responded with ${response.status} ${response.statusText} for ${url.toString()}: ${body}`
    );
  }

  return response.json();
}

/**
 * Fetch a real-time quote for the given ticker symbol.
 * Corresponds to: GET /quotes/{symbol}
 *
 * @param {string} symbol - Ticker symbol, e.g. "AAPL"
 * @returns {Promise<unknown>} Raw quote response from MarketDataAPI
 */
async function fetchQuote(symbol) {
  return get(`/quotes/${encodeURIComponent(symbol)}`);
}

/**
 * Fetch historical price data for the given ticker symbol.
 * Corresponds to: GET /historical/{symbol}
 *
 * @param {string} symbol - Ticker symbol, e.g. "AAPL"
 * @param {object} [options] - Optional query parameters
 * @param {string} [options.from] - Start date in YYYY-MM-DD format
 * @param {string} [options.to] - End date in YYYY-MM-DD format
 * @param {string} [options.interval] - Data interval: "1d", "1w", "1m"
 * @returns {Promise<unknown>} Raw historical prices response from MarketDataAPI
 */
async function fetchHistoricalPrices(symbol, options = {}) {
  return get(`/historical/${encodeURIComponent(symbol)}`, {
    from: options.from,
    to: options.to,
    interval: options.interval,
  });
}

/**
 * Fetch corporate action data (dividends, splits, spin-offs) for a symbol.
 * Corresponds to: GET /corporate-actions/{symbol}
 *
 * @param {string} symbol - Ticker symbol, e.g. "AAPL"
 * @param {object} [options] - Optional query parameters
 * @param {string} [options.from] - Start date in YYYY-MM-DD format
 * @param {string} [options.to] - End date in YYYY-MM-DD format
 * @returns {Promise<unknown>} Raw corporate actions response from MarketDataAPI
 */
async function fetchCorporateActions(symbol, options = {}) {
  return get(`/corporate-actions/${encodeURIComponent(symbol)}`, {
    from: options.from,
    to: options.to,
  });
}

module.exports = {
  fetchQuote,
  fetchHistoricalPrices,
  fetchCorporateActions,
};
