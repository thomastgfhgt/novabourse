import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { finnhub } from '../lib/finnhub';
import { Tab1Overview } from './ActionDetail/Tab1Overview';
import { Tab2Data } from './ActionDetail/Tab2Data';

export function ActionDetail() {
  const { symbol } = useParams();
  const navigate = useNavigate();
  const [quote, setQuote] = useState(null);
  const [profile, setProfile] = useState(null);
  const [activeTab, setActiveTab] = useState('vue');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [q, p] = await Promise.all([
          finnhub.getQuote(symbol),
          finnhub.getCompanyProfile(symbol)
        ]);
        setQuote(q);
        setProfile(p);
      } catch (error) {
        console.error('ActionDetail fetch error:', error);
      } finally {
        setLoading(false);
      }
    })();
  }, [symbol]);

  if (loading) {
    return <div className="p-4 text-center text-gray-400">Chargement...</div>;
  }

  const price = quote?.c?.toFixed(2) || '—';
  const isPositive = (quote?.d || 0) >= 0;

  return (
    <div className="pb-24">
      {/* Header */}
      <div className="bg-gradient-to-b from-gray-800 to-gray-900 p-4">
        <button
          onClick={() => navigate(-1)}
          className="text-gray-400 hover:text-white mb-4 text-sm"
        >
          ← Retour
        </button>

        <div className="flex items-start gap-3">
          <div className="w-12 h-12 bg-gray-700 rounded-lg flex items-center justify-center font-bold text-white">
            {symbol.slice(0, 2)}
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-white">{symbol}</h1>
            <p className="text-sm text-gray-400">{profile?.name || 'Entreprise'}</p>
          </div>
        </div>

        <div className="mt-4 text-center">
          <div className="text-4xl font-bold text-white">{price}€</div>
          <div
            className={`text-lg font-semibold mt-2 ${
              isPositive ? 'text-green-500' : 'text-red-500'
            }`}
          >
            {isPositive ? '▲' : '▼'} {quote?.d?.toFixed(2) || '0'} ({quote?.dp?.toFixed(2) || '0'}%)
          </div>
        </div>

        {/* Buy Button */}
        <button className="w-full mt-4 bg-orange-500 hover:bg-orange-600 text-white py-3 rounded-full font-bold text-lg transition">
          Acheter
        </button>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-700 flex gap-8 px-4 py-3 bg-gray-900/50 sticky top-0 z-10">
        {[
          { id: 'vue', label: 'Vue d\'ensemble' },
          { id: 'data', label: 'Données' },
          { id: 'analyse', label: 'Analyse' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`pb-3 font-medium text-sm transition ${
              activeTab === tab.id
                ? 'text-white border-b-2 border-orange-500'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === 'vue' && <Tab1Overview symbol={symbol} />}
        {activeTab === 'data' && <Tab2Data symbol={symbol} />}
        {activeTab === 'analyse' && (
          <div className="p-4 text-gray-400">Analyse détaillée coming soon...</div>
        )}
      </div>
    </div>
  );
}
