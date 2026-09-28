import React, { useEffect, useState } from 'react';
import { finnhub } from '../../lib/finnhub';

function MetricRow({ label, value, help }) {
  return (
    <div className="flex justify-between py-2 text-sm border-b border-gray-700">
      <span className="text-gray-400 flex items-center gap-1">
        {label}
        {help && <span className="cursor-help">?</span>}
      </span>
      <span className="text-white font-medium">{value}</span>
    </div>
  );
}

function SectionTitle({ title }) {
  return <h3 className="text-lg font-semibold text-white mt-6 mb-4">{title}</h3>;
}

export function Tab2Data({ symbol }) {
  const [financials, setFinancials] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const data = await finnhub.getBasicFinancials(symbol);
        setFinancials(data?.metric || {});
      } catch (error) {
        console.error('Tab2 fetch error:', error);
        setFinancials({});
      } finally {
        setLoading(false);
      }
    })();
  }, [symbol]);

  if (loading) {
    return <div className="p-4 text-center text-gray-400">Chargement...</div>;
  }

  const formatValue = (val, decimals = 2) => {
    if (!val) return 'N/A';
    if (typeof val === 'number') return val.toFixed(decimals);
    return String(val);
  };

  return (
    <div className="space-y-2 p-4">
      <SectionTitle title="Compte de Résultat" />
      <MetricRow label="Revenue" value={formatValue(financials?.revenue, 0)} />
      <MetricRow label="Gross Margin" value={formatValue(financials?.grossMargin, 1) + '%'} />
      <MetricRow label="Operating Margin" value={formatValue(financials?.operatingMargin, 1) + '%'} />
      <MetricRow label="Net Margin" value={formatValue(financials?.netMargin, 1) + '%'} />
      <MetricRow label="EPS" value={formatValue(financials?.eps, 2)} />

      <SectionTitle title="Ratios Complets" />
      <MetricRow label="P/E (TTM)" value={formatValue(financials?.pe, 1)} help />
      <MetricRow label="P/B" value={formatValue(financials?.pb, 1)} help />
      <MetricRow label="PEG" value={formatValue(financials?.peg, 1)} help />
      <MetricRow label="Debt/Equity" value={formatValue(financials?.debtToEquity, 2)} help />
      <MetricRow label="ROE" value={formatValue(financials?.roe ? financials.roe * 100 : null, 1) + '%'} help />
      <MetricRow label="ROIC" value={formatValue(financials?.roic ? financials.roic * 100 : null, 1) + '%'} help />
      <MetricRow label="Free Cash Flow" value={formatValue(financials?.freeCashFlow, 0)} />

      <SectionTitle title="Autres Métriques" />
      <MetricRow label="52W High" value={formatValue(financials?.fiftyTwoWeekHigh, 2)} />
      <MetricRow label="52W Low" value={formatValue(financials?.fiftyTwoWeekLow, 2)} />
      <MetricRow label="Dividend Yield" value={formatValue(financials?.dividendYield ? financials.dividendYield * 100 : null, 2) + '%'} />
      <MetricRow label="Volume (3M)" value={formatValue(financials?.avgVol3M, 0)} />
    </div>
  );
}
