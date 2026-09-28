import React, { useEffect, useState } from 'react';
import { finnhub } from '../../lib/finnhub';
import { PriceChart } from '../../components/PriceChart';

function RatioBox({ label, value, help }) {
  return (
    <div className="bg-gray-800 p-3 rounded-lg">
      <div className="text-xs text-gray-400 flex items-center gap-1">
        {label}
        {help && <span className="cursor-help">?</span>}
      </div>
      <div className="text-lg font-bold text-white">{value}</div>
    </div>
  );
}

export function Tab1Overview({ symbol }) {
  const [quote, setQuote] = useState(null);
  const [profile, setProfile] = useState(null);
  const [financials, setFinancials] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [q, p, f] = await Promise.all([
          finnhub.getQuote(symbol),
          finnhub.getCompanyProfile(symbol),
          finnhub.getBasicFinancials(symbol)
        ]);
        setQuote(q);
        setProfile(p);
        setFinancials(f?.metric || {});
      } catch (error) {
        console.error('Tab1 fetch error:', error);
      } finally {
        setLoading(false);
      }
    })();
  }, [symbol]);

  if (loading) {
    return <div className="p-4 text-center text-gray-400">Chargement...</div>;
  }

  const price = quote?.c?.toFixed(2) || '—';
  const change = quote?.d?.toFixed(2) || '0';
  const changePercent = quote?.dp?.toFixed(2) || '0';
  const isPositive = (quote?.d || 0) >= 0;

  return (
    <div className="space-y-6 p-4">
      {/* Graphique */}
      <PriceChart symbol={symbol} defaultTimeframe="1M" />

      {/* Prix Actuel */}
      <div className="text-center py-4 border-t border-gray-700">
        <div className="text-5xl font-bold text-white">{price}€</div>
        <div
          className={`text-xl font-semibold mt-2 ${
            isPositive ? 'text-green-500' : 'text-red-500'
          }`}
        >
          {isPositive ? '▲' : '▼'} {change} ({changePercent}%)
        </div>
        <div className="text-xs text-gray-400 mt-2">
          Actualisé à {quote?.t ? new Date(quote.t * 1000).toLocaleTimeString('fr-FR') : '--:--'}
          {' '}· Séance fermée
        </div>
      </div>

      {/* 6 Ratios Clés */}
      <div>
        <h3 className="text-lg font-semibold text-white mb-3">Les chiffres</h3>
        <div className="grid grid-cols-2 gap-3">
          <RatioBox
            label="Marché cap"
            value={
              profile?.marketCapitalization
                ? `${(profile.marketCapitalization / 1e9).toFixed(1)}Md$`
                : 'N/A'
            }
          />
          <RatioBox label="P/E" value={financials?.pe?.toFixed(1) || 'N/A'} help />
          <RatioBox label="ROE" value={financials?.roe ? `${(financials.roe * 100).toFixed(1)}%` : 'N/A'} help />
          <RatioBox
            label="Div. Yield"
            value={financials?.dividendYield ? `${(financials.dividendYield * 100).toFixed(2)}%` : 'N/A'}
          />
          <RatioBox label="52W High" value={financials?.fiftyTwoWeekHigh || 'N/A'} />
          <RatioBox label="52W Low" value={financials?.fiftyTwoWeekLow || 'N/A'} />
        </div>
      </div>
    </div>
  );
}
