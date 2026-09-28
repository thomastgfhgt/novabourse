const API_KEY = process.env.REACT_APP_FINNHUB_KEY || 'YOUR_FINNHUB_KEY_HERE';
const BASE_URL = 'https://finnhub.io/api/v1';

// Cache for 60 seconds
const cache = new Map();
const CACHE_TTL = 60000;

function getCached(key) {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  cache.delete(key);
  return null;
}

function setCached(key, data) {
  cache.set(key, { data, timestamp: Date.now() });
  return data;
}

export const finnhub = {
  async getQuote(symbol) {
    const cached = getCached(`quote_${symbol}`);
    if (cached) return cached;

    try {
      const res = await fetch(
        `${BASE_URL}/quote?symbol=${symbol}&token=${API_KEY}`,
        { signal: AbortSignal.timeout(5000) }
      );
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      const data = await res.json();
      return setCached(`quote_${symbol}`, data);
    } catch (error) {
      console.error(`Quote fetch failed for ${symbol}:`, error);
      return { c: null, d: null, dp: null, pc: null, t: null };
    }
  },

  async getCandles(symbol, resolution = 'D', count = 100) {
    const cached = getCached(`candles_${symbol}_${resolution}`);
    if (cached) return cached;

    try {
      const from = Math.floor(Date.now() / 1000) - count * 86400;
      const to = Math.floor(Date.now() / 1000);
      const res = await fetch(
        `${BASE_URL}/stock/candle?symbol=${symbol}&resolution=${resolution}&from=${from}&to=${to}&token=${API_KEY}`,
        { signal: AbortSignal.timeout(5000) }
      );
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      const data = await res.json();
      return setCached(`candles_${symbol}_${resolution}`, data);
    } catch (error) {
      console.error(`Candles fetch failed for ${symbol}:`, error);
      return { c: [], o: [], h: [], l: [], t: [] };
    }
  },

  async getBasicFinancials(symbol) {
    const cached = getCached(`financials_${symbol}`);
    if (cached) return cached;

    try {
      const res = await fetch(
        `${BASE_URL}/stock/metric?symbol=${symbol}&metric=all&token=${API_KEY}`,
        { signal: AbortSignal.timeout(5000) }
      );
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      const data = await res.json();
      return setCached(`financials_${symbol}`, data);
    } catch (error) {
      console.error(`Financials fetch failed for ${symbol}:`, error);
      return { metric: {} };
    }
  },

  async getCompanyProfile(symbol) {
    const cached = getCached(`profile_${symbol}`);
    if (cached) return cached;

    try {
      const res = await fetch(
        `${BASE_URL}/stock/profile2?symbol=${symbol}&token=${API_KEY}`,
        { signal: AbortSignal.timeout(5000) }
      );
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      const data = await res.json();
      return setCached(`profile_${symbol}`, data);
    } catch (error) {
      console.error(`Profile fetch failed for ${symbol}:`, error);
      return { name: symbol, sector: 'N/A' };
    }
  },

  async getAllQuotes(symbols) {
    // Fetch all quotes in parallel
    return Promise.all(symbols.map(s => this.getQuote(s)));
  }
};
