// This service contains no business logic. It translates foreign API responses to internal events only.

const { translateQuote, translateCorporateAction, translateHistoricalPrices } = require('../src/translator');

describe('translateQuote', () => {
  const foreignQuote = {
    symbol: 'AAPL',
    exchange: 'NASDAQ',
    bid: 182.50,
    ask: 182.55,
    last: 182.52,
    lastSize: 100,
    volume: 55234871,
    open: 180.10,
    high: 183.20,
    low: 179.85,
    close: 181.00,
    change: 1.52,
    changePercent: 0.84,
    session: 'regular',
    timestamp: '2024-01-15T19:30:00.000Z',
  };

  let result;

  beforeEach(() => {
    result = translateQuote(foreignQuote);
  });

  it('sets eventType to market.quote_updated', () => {
    expect(result.eventType).toBe('market.quote_updated');
  });

  it('generates a unique eventId UUID', () => {
    const r2 = translateQuote(foreignQuote);
    expect(result.eventId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
    expect(result.eventId).not.toBe(r2.eventId);
  });

  it('maps symbol correctly', () => {
    expect(result.symbol).toBe('AAPL');
  });

  it('maps exchange correctly', () => {
    expect(result.exchange).toBe('NASDAQ');
  });

  it('maps bid to bidPrice', () => {
    expect(result.bidPrice).toBe(182.50);
  });

  it('maps ask to askPrice', () => {
    expect(result.askPrice).toBe(182.55);
  });

  it('maps last to lastPrice', () => {
    expect(result.lastPrice).toBe(182.52);
  });

  it('maps lastSize correctly', () => {
    expect(result.lastSize).toBe(100);
  });

  it('maps volume correctly', () => {
    expect(result.volume).toBe(55234871);
  });

  it('maps open to openPrice', () => {
    expect(result.openPrice).toBe(180.10);
  });

  it('maps high to highPrice', () => {
    expect(result.highPrice).toBe(183.20);
  });

  it('maps low to lowPrice', () => {
    expect(result.lowPrice).toBe(179.85);
  });

  it('maps close to closePrice', () => {
    expect(result.closePrice).toBe(181.00);
  });

  it('maps change to changeAmount', () => {
    expect(result.changeAmount).toBe(1.52);
  });

  it('maps changePercent correctly', () => {
    expect(result.changePercent).toBe(0.84);
  });

  it('maps session to marketSession', () => {
    expect(result.marketSession).toBe('regular');
  });

  it('maps timestamp to quoteTimestamp', () => {
    expect(result.quoteTimestamp).toBe('2024-01-15T19:30:00.000Z');
  });

  it('sets occurredAt to a valid ISO-8601 timestamp', () => {
    expect(new Date(result.occurredAt).toISOString()).toBe(result.occurredAt);
  });
});

describe('translateCorporateAction — dividend', () => {
  const foreignDividend = {
    symbol: 'AAPL',
    type: 'dividend',
    exDate: '2024-02-09',
    recordDate: '2024-02-12',
    payDate: '2024-02-15',
    amount: 0.24,
    ratio: null,
    currency: 'USD',
    description: 'Quarterly cash dividend',
  };

  let result;

  beforeEach(() => {
    result = translateCorporateAction(foreignDividend);
  });

  it('sets eventType to market.corporate_action', () => {
    expect(result.eventType).toBe('market.corporate_action');
  });

  it('generates a unique eventId UUID', () => {
    expect(result.eventId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
  });

  it('maps symbol correctly', () => {
    expect(result.symbol).toBe('AAPL');
  });

  it('maps type to actionType', () => {
    expect(result.actionType).toBe('dividend');
  });

  it('maps exDate correctly', () => {
    expect(result.exDate).toBe('2024-02-09');
  });

  it('maps recordDate correctly', () => {
    expect(result.recordDate).toBe('2024-02-12');
  });

  it('maps payDate correctly', () => {
    expect(result.payDate).toBe('2024-02-15');
  });

  it('maps amount correctly', () => {
    expect(result.amount).toBe(0.24);
  });

  it('maps ratio as null for dividend', () => {
    expect(result.ratio).toBeNull();
  });

  it('maps currency correctly', () => {
    expect(result.currency).toBe('USD');
  });

  it('maps description correctly', () => {
    expect(result.description).toBe('Quarterly cash dividend');
  });
});

describe('translateCorporateAction — split', () => {
  const foreignSplit = {
    symbol: 'TSLA',
    type: 'split',
    exDate: '2022-08-25',
    recordDate: '2022-08-24',
    payDate: '2022-08-25',
    amount: 3,
    ratio: 1,
    currency: 'USD',
    description: '3-for-1 stock split',
  };

  it('maps amount and ratio correctly for a split', () => {
    const result = translateCorporateAction(foreignSplit);
    expect(result.amount).toBe(3);
    expect(result.ratio).toBe(1);
    expect(result.actionType).toBe('split');
  });
});

describe('translateHistoricalPrices', () => {
  const foreignHistorical = {
    symbol: 'MSFT',
    interval: '1d',
    bars: [
      {
        date: '2024-01-10',
        open: 374.00,
        high: 378.50,
        low: 372.10,
        close: 376.90,
        volume: 18234567,
        adjustedClose: 376.90,
      },
      {
        date: '2024-01-11',
        open: 376.90,
        high: 381.00,
        low: 375.20,
        close: 380.10,
        volume: 21345678,
        adjustedClose: 380.10,
      },
    ],
  };

  let result;

  beforeEach(() => {
    result = translateHistoricalPrices(foreignHistorical);
  });

  it('maps symbol correctly', () => {
    expect(result.symbol).toBe('MSFT');
  });

  it('maps interval correctly', () => {
    expect(result.interval).toBe('1d');
  });

  it('maps the correct number of bars', () => {
    expect(result.bars).toHaveLength(2);
  });

  it('maps open to openPrice in bars', () => {
    expect(result.bars[0].openPrice).toBe(374.00);
  });

  it('maps high to highPrice in bars', () => {
    expect(result.bars[0].highPrice).toBe(378.50);
  });

  it('maps low to lowPrice in bars', () => {
    expect(result.bars[0].lowPrice).toBe(372.10);
  });

  it('maps close to closePrice in bars', () => {
    expect(result.bars[0].closePrice).toBe(376.90);
  });

  it('maps adjustedClose to adjustedClosePrice in bars', () => {
    expect(result.bars[0].adjustedClosePrice).toBe(376.90);
  });

  it('maps volume correctly in bars', () => {
    expect(result.bars[0].volume).toBe(18234567);
  });

  it('maps date correctly in bars', () => {
    expect(result.bars[1].date).toBe('2024-01-11');
  });

  it('returns empty bars array when foreign response has no bars', () => {
    const result2 = translateHistoricalPrices({ symbol: 'X', interval: '1d' });
    expect(result2.bars).toEqual([]);
  });
});
