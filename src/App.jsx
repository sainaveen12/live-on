import React, { useState, useEffect, useCallback } from 'react';
import { Coins, Code, Smartphone, RefreshCw } from 'lucide-react';
import { CapacitorHttp } from '@capacitor/core';
import './App.css';

export default function App() {
  const [rates, setRates] = useState({ k24: '--', k22: '--' });
  const [status, setStatus] = useState('Initializing...');
  const [loading, setLoading] = useState(false);
  const [isError, setIsError] = useState(false);

  const scrapeGoldPrice = useCallback(async () => {
    setLoading(true);
    setIsError(false);
    setStatus('Fetching live Bangalore gold rates...');

    const targetUrl = 'https://www.goodreturns.in/gold-rates/bangalore.html';

    try {
      let htmlText = '';

      // Check if running inside Vite local dev server in browser
      if (window.location.hostname === 'localhost' && window.location.port === '5173') {
        const res = await fetch('/api-gold/gold-rates/bangalore.html');
        if (!res.ok) throw new Error(`HTTP Error: ${res.status}`);
        htmlText = await res.text();
      } else {
        // Native Mobile Runtime: Use CapacitorHttp to bypass CORS & proxies
        const response = await CapacitorHttp.get({
          url: targetUrl,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
          }
        });

        if (response.status !== 200) {
          throw new Error(`HTTP ${response.status}: Failed to reach GoodReturns`);
        }

        htmlText = response.data;
      }

      // Parse HTML string into DOM structure
      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlText, 'text/html');

      const table = doc.querySelector('table');
      if (table) {
        const rows = table.querySelectorAll('tr');
        if (rows.length > 1) {
          const cols = rows[1].querySelectorAll('td');
          setRates({
            k24: cols[1]?.textContent.trim() || 'N/A',
            k22: cols[2]?.textContent.trim() || 'N/A'
          });
          setStatus(`Updated at ${new Date().toLocaleTimeString()}`);
          return;
        }
      }
      throw new Error('Could not parse gold rate table from HTML');
    } catch (err) {
      setIsError(true);
      setStatus(err.message || 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    scrapeGoldPrice();
  }, [scrapeGoldPrice]);

  return (
    <div className="dashboard-container">
      <h1 className="dashboard-title">Gold Tracker Dashboard</h1>

      <div className="card-grid">
        {/* CARD 1: LIVE RATES */}
        <div className="card">
          <div className="card-header">
            <Coins className="gold-icon" size={24} />
            <h2 className="card-title">Bangalore Gold Rate</h2>
          </div>

          <div className="price-box">
            <div className="price-24k">24K: {rates.k24}</div>
            <div className="price-22k">22K: {rates.k22}</div>
            <div className="unit-label">Per Gram (INR)</div>
          </div>

          <button
            className="refresh-btn"
            onClick={scrapeGoldPrice}
            disabled={loading}
          >
            <RefreshCw className={loading ? 'spin' : ''} size={16} />
            {loading ? 'Fetching...' : 'Refresh Price'}
          </button>

          <p className={`status-message ${isError ? 'error-message' : ''}`}>
            {status}
          </p>
        </div>

        {/* CARD 2: BUILD STEPS */}
        <div className="card">
          <div className="card-header">
            <Code className="code-icon" size={24} />
            <h2 className="card-title">Build Instructions</h2>
          </div>

          <ol className="steps-list">
            <li><strong>1. Config Proxy:</strong> Setup Vite proxy for browser testing.</li>
            <li><strong>2. Native HTTP:</strong> Use <code>CapacitorHttp</code> for native APK runtime.</li>
            <li><strong>3. Parse HTML:</strong> Parse raw HTML via <code>DOMParser</code>.</li>
            <li><strong>4. Render UI:</strong> Bind scraped rate data to React state.</li>
          </ol>
        </div>

        {/* CARD 3: MOBILE STEPS */}
        <div className="card">
          <div className="card-header">
            <Smartphone className="mobile-icon" size={24} />
            <h2 className="card-title">Mobile APK Installation</h2>
          </div>

          <ol className="steps-list">
            <li><strong>1. Build Web Assets:</strong> Run <code>npm run build</code>.</li>
            <li><strong>2. Sync Capacitor:</strong> Run <code>npx cap sync</code>.</li>
            <li><strong>3. Build APK:</strong> Compile in Android Studio.</li>
            <li><strong>4. Install APK:</strong> Transfer & install directly on device.</li>
          </ol>
        </div>
      </div>
    </div>
  );
}