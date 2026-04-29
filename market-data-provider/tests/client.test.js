// This service contains no business logic. It translates foreign API responses to internal events only.

// We test client.js by mocking node-fetch so no real HTTP calls are made.

const { jest } = require('@jest/globals');

// node-fetch v3 is ESM-only; we shim it with a jest mock before requiring the module
jest.mock('node-fetch', () => jest.fn());

const fetch = require('node-fetch');
const client = require('../src/client');

const MOCK_API_KEY = 'test-api-key-123';

beforeEach(() => {
  process.env.FOREIGN_API_KEY = MOCK_API_KEY;
  process.env.FOREIGN_API_BASE_URL = 'http://localhost:3000';
  fetch.mockReset();
});

afterEach(() => {
  delete process.env.FOREIGN_API_KEY;
  delete process.env.FOREIGN_API_BASE_URL;
});

function mockFetchOk(body) {
  fetch.mockResolvedValue({
    ok: true,
    status: 200,
    statusText: 'OK',
    json: async () => body,
  });
}

function mockFetchError(status, text) {
  fetch.mockResolvedValue({
    ok: false,
    status,
    statusText: text,
    text: async () => `Error body for ${status}`,
  });
}

describe('fetchQuote', () => {
  it('calls the correct URL with the x-api-key header', async () => {
    mockFetchOk({ symbol: 'AAPL', last: 182.52 });

    await client.fetchQuote('AAPL');

    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, options] = fetch.mock.calls[0];
    expect(url.toString()).toBe('http://localhost:3000/quotes/AAPL');
    expect(options.headers['x-api-key']).toBe(MOCK_API_KEY);
    expect(options.method).toBe('GET');
  });

  it('returns the parsed JSON response body', async () => {
    const mockBody = { symbol: 'AAPL', last: 182.52, bid: 182.50 };
    mockFetchOk(mockBody);

    const result = await client.fetchQuote('AAPL');
    expect(result).toEqual(mockBody);
  });

  it('URL-encodes the symbol', async () => {
    mockFetchOk({});
    await client.fetchQuote('BRK.B');
    const [url] = fetch.mock.calls[0];
    expect(url.toString()).toBe('http://localhost:3000/quotes/BRK.B');
  });

  it('throws when the API returns a non-2xx status', async () => {
    mockFetchError(429, 'Too Many Requests');
    await expect(client.fetchQuote('AAPL')).rejects.toThrow('429');
  });

  it('throws when FOREIGN_API_KEY is not set', async () => {
    delete process.env.FOREIGN_API_KEY;
    await expect(client.fetchQuote('AAPL')).rejects.toThrow('FOREIGN_API_KEY');
  });
});

describe('fetchHistoricalPrices', () => {
  it('calls the correct URL with date range query params', async () => {
    mockFetchOk({ symbol: 'MSFT', bars: [] });

    await client.fetchHistoricalPrices('MSFT', { from: '2024-01-01', to: '2024-01-31', interval: '1d' });

    const [url] = fetch.mock.calls[0];
    expect(url.toString()).toContain('/historical/MSFT');
    expect(url.toString()).toContain('from=2024-01-01');
    expect(url.toString()).toContain('to=2024-01-31');
    expect(url.toString()).toContain('interval=1d');
  });

  it('returns the parsed JSON response body', async () => {
    const mockBody = { symbol: 'MSFT', interval: '1d', bars: [{ date: '2024-01-10', close: 376.90 }] };
    mockFetchOk(mockBody);

    const result = await client.fetchHistoricalPrices('MSFT');
    expect(result).toEqual(mockBody);
  });

  it('throws on non-2xx response', async () => {
    mockFetchError(500, 'Internal Server Error');
    await expect(client.fetchHistoricalPrices('MSFT')).rejects.toThrow('500');
  });
});

describe('fetchCorporateActions', () => {
  it('calls the correct URL', async () => {
    mockFetchOk({ symbol: 'AAPL', actions: [] });

    await client.fetchCorporateActions('AAPL', { from: '2024-01-01', to: '2024-01-31' });

    const [url] = fetch.mock.calls[0];
    expect(url.toString()).toContain('/corporate-actions/AAPL');
    expect(url.toString()).toContain('from=2024-01-01');
    expect(url.toString()).toContain('to=2024-01-31');
  });

  it('returns the parsed JSON response body', async () => {
    const mockBody = { symbol: 'AAPL', actions: [{ type: 'dividend', exDate: '2024-02-09' }] };
    mockFetchOk(mockBody);

    const result = await client.fetchCorporateActions('AAPL');
    expect(result).toEqual(mockBody);
  });

  it('throws on non-2xx response', async () => {
    mockFetchError(404, 'Not Found');
    await expect(client.fetchCorporateActions('AAPL')).rejects.toThrow('404');
  });
});
