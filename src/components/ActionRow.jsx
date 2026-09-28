import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { finnhub } from '../lib/finnhub';

export function ActionRow({ symbol, name }) {
  const [quote, setQuote] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const q = await finnhub.getQuote(symbol);
      setQuote(q);
      setLoading(false);
    })();
  }, [symbol]);

  const price = quote?.c ? quote.c.toFixed(2) : '—';
  const change = quote?.d || 0;
  const changePercent = quote?.dp || 0;
  const isPositive = (quote?.d || 0) >= 0;

  return (
    <Link
      to={`/action/${symbol}`}
      className="block p-4 border-b border-gray-700 hover:bg-gray-800 transition cursor-pointer"
    >
      <div className="flex justify-between items-center">
        <div>
          <div className="font-semibold text-white text-lg">{symbol}</div>
          <div className="text-sm text-gray-400">{name}</div>
        </div>
        <div className="text-right">
          <div className="text-xl font-bold text-white">
            {loading ? '...' : `${price}€`}
          </div>
          <div
            className={`text-sm font-medium ${
              isPositive ? 'text-green-500' : 'text-red-500'
            }`}
          >
            {isPositive ? '▲' : '▼'} {Math.abs(changePercent).toFixed(2)}%
          </div>
        </div>
      </div>
    </Link>
  );
}
