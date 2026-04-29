// Set FOREIGN_API_BASE_URL=http://settlement-provider-mock:3000 in dev/stage to use the companion mock

const fetch = require('node-fetch');

const BASE_URL = process.env.FOREIGN_API_BASE_URL || 'https://api.dtcc.com';
const TOKEN_URL = process.env.DTCC_TOKEN_URL || 'https://api.dtcc.com/oauth2/token';
const CLIENT_ID = process.env.DTCC_CLIENT_ID || '';
const CLIENT_SECRET = process.env.DTCC_CLIENT_SECRET || '';

// Token cache
let cachedToken = null;
let tokenExpiresAt = 0;

/**
 * Fetches a new OAuth2 bearer token from the DTCC token endpoint using the
 * client credentials grant. Caches the result and returns the access token string.
 * @returns {Promise<string>}
 */
async function fetchNewToken() {
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    scope: 'settlement:read settlement:write',
  });

  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`DTCC OAuth2 token request failed [${response.status}]: ${text}`);
  }

  const data = await response.json();
  // expires_in is in seconds; subtract 60s buffer
  const expiresIn = (data.expires_in || 3600) - 60;
  cachedToken = data.access_token;
  tokenExpiresAt = Date.now() + expiresIn * 1000;
  return cachedToken;
}

/**
 * Returns a valid bearer token, refreshing if expired or not yet obtained.
 * @returns {Promise<string>}
 */
async function getToken() {
  if (!cachedToken || Date.now() >= tokenExpiresAt) {
    await fetchNewToken();
  }
  return cachedToken;
}

/**
 * Makes an authenticated request to the DTCC Settlement Network API.
 * Automatically retries once on a 401 by refreshing the token.
 * Returns raw parsed JSON — no interpretation.
 *
 * @param {string} method - HTTP method
 * @param {string} path   - Path relative to BASE_URL
 * @param {object} [body] - Optional request body (will be JSON-encoded)
 * @returns {Promise<object>}
 */
async function dtccRequest(method, path, body) {
  const performRequest = async (token) => {
    const options = {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    };
    if (body !== undefined) {
      options.body = JSON.stringify(body);
    }
    return fetch(`${BASE_URL}${path}`, options);
  };

  let token = await getToken();
  let response = await performRequest(token);

  if (response.status === 401) {
    // Force token refresh and retry once
    cachedToken = null;
    token = await getToken();
    response = await performRequest(token);
  }

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`DTCC API error [${response.status}] ${method} ${path}: ${text}`);
  }

  return response.json();
}

/**
 * Submit settlement instructions to the DTCC clearing network.
 * @param {object} instruction - Settlement instruction payload
 * @returns {Promise<object>} Raw DTCC response
 */
async function submitSettlementInstruction(instruction) {
  return dtccRequest('POST', '/v1/settlement/instructions', instruction);
}

/**
 * Query settlement status for a given trade from the DTCC clearing system.
 * @param {string} tradeId - The trade identifier
 * @returns {Promise<object>} Raw DTCC settlement status response
 */
async function getSettlementStatus(tradeId) {
  return dtccRequest('GET', `/v1/settlement/${encodeURIComponent(tradeId)}/status`);
}

/**
 * Submit a settlement exception (fail or manual intervention request) to DTCC.
 * @param {object} exceptionPayload - Exception details
 * @returns {Promise<object>} Raw DTCC exception handling response
 */
async function submitSettlementException(exceptionPayload) {
  return dtccRequest('POST', '/v1/settlement/exceptions', exceptionPayload);
}

/**
 * Retrieve settlement activity reports from the DTCC clearing system.
 * Optionally pass query parameters as an object (e.g. { date, status, page }).
 * @param {object} [params] - Optional query parameters
 * @returns {Promise<object>} Raw DTCC settlement reports response
 */
async function getSettlementReports(params) {
  const query = params
    ? '?' + new URLSearchParams(params).toString()
    : '';
  return dtccRequest('GET', `/v1/settlement/reports${query}`);
}

module.exports = {
  submitSettlementInstruction,
  getSettlementStatus,
  submitSettlementException,
  getSettlementReports,
};
