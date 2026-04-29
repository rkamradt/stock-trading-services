// This service contains no business logic. It translates foreign API responses to internal events only.

const { v4: uuidv4 } = require('uuid');

/**
 * Translate a raw MarketDataAPI quote response into a market.quote_updated event payload.
 *
 * Foreign shape (MarketDataAPI /quotes/{symbol}):
 * {
 *   symbol: string,
 *   exchange: string,
 *   bid: number,
 *   ask: number,
 *   last: number,
 *   lastSize: number,
 *   volume: number,
 *   open: number,
 *   high: number,
 *   low: number,
 *   close: number,
 *   change: number,
 *   changePercent: number,
 *   session: string,       // "pre" | "regular" | "post"
 *   timestamp: string,     // ISO-8601
 * }
 *
 * @param {object} foreignQuote - Raw JSON response from MarketDataAPI /quotes/{symbol}
 * @returns {object} Internal market.quote_updated event payload
 */
function translateQuote(foreignQuote) {
  return {
    eventId: uuidv4(),
    eventType: 'market.quote_updated',
    occurredAt: new Date().toISOString(),
    symbol: foreignQuote.symbol,
    exchange: foreignQuote.exchange,
    bidPrice: foreignQuote.bid,
    askPrice: foreignQuote.ask,
    lastPrice: foreignQuote.last,
    lastSize: foreignQuote.lastSize,
    volume: foreignQuote.volume,
    openPrice: foreignQuote.open,
    highPrice: foreignQuote.high,
    lowPrice: foreignQuote.low,
    closePrice: foreignQuote.close,
    changeAmount: foreignQuote.change,
    changePercent: foreignQuote.changePercent,
    marketSession: foreignQuote.session,
    quoteTimestamp: foreignQuote.timestamp,
  };
}

/**
 * Translate a single raw corporate action entry from MarketDataAPI into a
 * market.corporate_action event payload.
 *
 * Foreign shape (one element from MarketDataAPI /corporate-actions/{symbol}):
 * {
 *   symbol: string,
 *   type: string,          // "dividend" | "split" | "spinoff" | "merger" | "special"
 *   exDate: string,        // YYYY-MM-DD
 *   recordDate: string,    // YYYY-MM-DD
 *   payDate: string,       // YYYY-MM-DD
 *   amount: number,        // cash amount per share, or split ratio numerator
 *   ratio: number | null,  // split ratio denominator; null for non-split actions
 *   currency: string,      // ISO-4217
 *   description: string,
 * }
 *
 * @param {object} foreignAction - Single corporate action object from MarketDataAPI response
 * @returns {object} Internal market.corporate_action event payload
 */
function translateCorporateAction(foreignAction) {
  return {
    eventId: uuidv4(),
    eventType: 'market.corporate_action',
    occurredAt: new Date().toISOString(),
    symbol: foreignAction.symbol,
    actionType: foreignAction.type,
    exDate: foreignAction.exDate,
    recordDate: foreignAction.recordDate,
    payDate: foreignAction.payDate,
    amount: foreignAction.amount,
    ratio: foreignAction.ratio !== undefined ? foreignAction.ratio : null,
    currency: foreignAction.currency,
    description: foreignAction.description,
  };
}

/**
 * Translate a raw MarketDataAPI historical prices response into an array of
 * normalised internal historical price bar objects.
 *
 * Foreign shape (MarketDataAPI /historical/{symbol}):
 * {
 *   symbol: string,
 *   interval: string,
 *   bars: Array<{
 *     date: string,       // YYYY-MM-DD
 *     open: number,
 *     high: number,
 *     low: number,
 *     close: number,
 *     volume: number,
 *     adjustedClose: number,
 *   }>
 * }
 *
 * Historical data is used internally (e.g. for P&L reporting) but does not
 * produce a Kafka event on its own — it is returned to callers that request it
 * via the polling helpers in index.js.
 *
 * @param {object} foreignHistorical - Raw JSON response from MarketDataAPI /historical/{symbol}
 * @returns {object} Normalised historical price object
 */
function translateHistoricalPrices(foreignHistorical) {
  return {
    symbol: foreignHistorical.symbol,
    interval: foreignHistorical.interval,
    bars: (foreignHistorical.bars || []).map((bar) => ({
      date: bar.date,
      openPrice: bar.open,
      highPrice: bar.high,
      lowPrice: bar.low,
      closePrice: bar.close,
      adjustedClosePrice: bar.adjustedClose,
      volume: bar.volume,
    })),
  };
}

module.exports = {
  translateQuote,
  translateCorporateAction,
  translateHistoricalPrices,
};
