import React, { useEffect, useState } from 'react';
import { finnhub } from '../lib/finnhub';
import { ActionRow } from '../components/ActionRow';

const MARKETS_SYMBOLS = [
  'SVIX', '159816', 'ONE', 'Z29', '366030', '0A90', '8458', 'FLWS', '1U1',
  '561780', 'AAPL', 'MSFT', 'GOOGL', 'NVDA', 'AMZN', 'META', 'TSLA',
  'HMI', 'APC', 'HERMAO', 'HERMESC1', 'HERM', 'HERMAOL'
  // Add more symbols as needed
];

export function Markets() {
  const [symbols, setSymbols] = useState(MARKETS_SYMBOLS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(false);
  }, []);

  return (
    <div className="p-4 pb-24">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-white">Marché</h1>
        <button className="px-6 py-2 border border-cyan-400 text-cyan-400 rounded-full text-sm hover:bg-cyan-400/10">
          Tout voir
        </button>
      </div>

      {loading && (
        <div className="text-center text-gray-400 py-8">Chargement...</div>
      )}

      <div className="bg-gray-900 rounded-lg overflow-hidden border border-gray-700">
        {symbols.map(symbol => (
          <ActionRow
            key={symbol}
            symbol={symbol}
            name={`Company ${symbol}`} // Replace with actual name from API if needed
          />
        ))}
      </div>
    </div>
  );
}
