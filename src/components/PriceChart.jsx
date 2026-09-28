import React, { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { finnhub } from '../lib/finnhub';

export function PriceChart({ symbol, defaultTimeframe = 'D' }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [timeframe, setTimeframe] = useState(defaultTimeframe);

  const timeframeMap = {
    '1J': { resolution: '15', count: 26 }, // 15min, 26 bars = ~6.5h
    '5J': { resolution: 'D', count: 5 },
    '1S': { resolution: 'D', count: 7 },
    '1M': { resolution: 'D', count: 30 },
    '3M': { resolution: 'D', count: 90 },
    '1A': { resolution: 'W', count: 52 }
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const tf = timeframeMap[timeframe];
        const candles = await finnhub.getCandles(symbol, tf.resolution, tf.count);

        if (candles.c && candles.c.length > 0) {
          const chartData = candles.c.map((price, i) => ({
            date: new Date(candles.t[i] * 1000).toLocaleDateString('fr-FR'),
            price: parseFloat(price.toFixed(2)),
            open: candles.o[i],
            high: candles.h[i],
            low: candles.l[i],
            timestamp: candles.t[i]
          }));
          setData(chartData);
        } else {
          setData([]);
        }
      } catch (error) {
        console.error('Chart error:', error);
        setData([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [symbol, timeframe]);

  return (
    <div className="space-y-4">
      {/* Timeframe Buttons */}
      <div className="flex gap-2 justify-center flex-wrap">
        {['1J', '5J', '1S', '1M', '3M', '1A'].map(tf => (
          <button
            key={tf}
            onClick={() => setTimeframe(tf)}
            className={`px-3 py-1 rounded text-sm font-medium transition ${
              timeframe === tf
                ? 'bg-orange-500 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            {tf}
          </button>
        ))}
      </div>

      {/* Chart */}
      <div className="bg-gray-800 rounded-lg p-4 h-80">
        {loading && (
          <div className="h-full flex items-center justify-center text-gray-400">
            Chargement du graphique...
          </div>
        )}
        {!loading && data.length === 0 && (
          <div className="h-full flex items-center justify-center text-gray-400">
            Données indisponibles
          </div>
        )}
        {!loading && data.length > 0 && (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#4B5563" />
              <XAxis
                dataKey="date"
                stroke="#9CA3AF"
                style={{ fontSize: '12px' }}
                tick={{ fill: '#9CA3AF' }}
              />
              <YAxis
                stroke="#9CA3AF"
                style={{ fontSize: '12px' }}
                tick={{ fill: '#9CA3AF' }}
              />
              <Tooltip
                contentStyle={{
                  background: '#1E3A5F',
                  border: '1px solid #00D4FF',
                  borderRadius: '8px'
                }}
                labelStyle={{ color: '#F3F4F6' }}
              />
              <Line
                type="monotone"
                dataKey="price"
                stroke="#E67E22"
                dot={false}
                isAnimationActive={false}
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
