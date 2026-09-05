import React, { useState, useEffect, useCallback } from 'react';
import { Coins, TrendingUp, AlertCircle, Save, RefreshCw } from 'lucide-react';
import { CapacitorHttp } from '@capacitor/core';
import { Network } from '@capacitor/network';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import './App.css';

export default function App() {
  const [goldRates, setGoldRates] = useState({ k24: '--', k22: '--' });
  const [goldStatus, setGoldStatus] = useState('Initializing...');
  const [isOffline, setIsOffline] = useState(false);

  // --- CRYPTO STATE (POL & SHIB) ---
  const [usdToInrRate, setUsdToInrRate] = useState(0);
  const [polData, setPolData] = useState({ priceInr: 0, change24h: 0, rsi: 50, signal: 'NEUTRAL' });
  const [shibData, setShibData] = useState({ priceInr: 0, change24h: 0, rsi: 50, signal: 'NEUTRAL' });

  // --- LOGGING STATE ---
  const [selectedAsset, setSelectedAsset] = useState('POL');
  const [buyPriceInput, setBuyPriceInput] = useState('');

  // -------------------------------------------------------------
  // HELPER: PERMISSION & SAFE CSV LOGGING
  // -------------------------------------------------------------
  const requestStoragePermission = async () => {
    try {
      const perm = await Filesystem.checkPermissions();
      if (perm.publicStorage !== 'granted') {
        await Filesystem.requestPermissions();
      }
    } catch (e) {
      console.log('Permission check bypass:', e);
    }
  };

  const appendToCSV = async (fileName, header, rowData) => {
    try {
      await requestStoragePermission();
      let fileExists = false;
      try {
        await Filesystem.stat({ path: fileName, directory: Directory.Documents });
        fileExists = true;
      } catch (e) { fileExists = false; }

      if (!fileExists) {
        await Filesystem.writeFile({
          path: fileName,
          data: `${header}\n${rowData}\n`,
          directory: Directory.Documents,
          encoding: Encoding.UTF8
        });
      } else {
        await Filesystem.appendFile({
          path: fileName,
          data: `${rowData}\n`,
          directory: Directory.Documents,
          encoding: Encoding.UTF8
        });
      }
    } catch (err) {
      console.error(`CSV Save Error: ${err.message}`);
    }
  };
  const cleanScrapedText = (text) => {
    if (!text) return 'N/A';
    return text
      .replace(/[\r\n]+/g, ' ')  // Replace line breaks with a single space
      .replace(/,/g, '')         // Remove commas so CSV doesn't split columns
      .replace(/\s+/g, ' ')      // Collapse multiple spaces into one space
      .trim();                   // Trim leading/trailing whitespace
  };

  // -------------------------------------------------------------
  // 1. FIXED GOLD RATE LOGIC (10 AM CACHE + CSV RE-CREATION)
  // -------------------------------------------------------------
  const scrapeGoldPrice = useCallback(async (forceRefresh = false) => {
    const netStatus = await Network.getStatus();
    setIsOffline(!netStatus.connected);

    const now = new Date();
    let cycleStart = new Date();
    cycleStart.setHours(10, 0, 0, 0);
    if (now < cycleStart) cycleStart.setDate(cycleStart.getDate() - 1);

    // Check if CSV file exists on phone
    let csvExists = false;
    try {
      await Filesystem.stat({ path: 'Gold_Prices_History.csv', directory: Directory.Documents });
      csvExists = true;
    } catch (e) { csvExists = false; }

    const cachedData = localStorage.getItem('gold_cache');
    let parsedCache = cachedData ? JSON.parse(cachedData) : null;

    // Use cache ONLY if valid AND CSV file exists on phone (unless forceRefresh is true)
    if (!forceRefresh && csvExists && parsedCache && new Date(parsedCache.timestamp) >= cycleStart) {
      setGoldRates(parsedCache.rates);
      setGoldStatus(`Cached from ${new Date(parsedCache.timestamp).toLocaleTimeString()}`);
      return;
    }

    if (!netStatus.connected) {
      if (parsedCache) {
        setGoldRates(parsedCache.rates);
        setGoldStatus('Offline: Showing last saved cache');
      } else {
        setGoldStatus('Offline: No connection');
      }
      return;
    }

    setGoldStatus('Fetching live Bangalore rates...');
    try {
      let htmlText = '';
      if (window.location.hostname === 'localhost' && window.location.port === '5173') {
        const res = await fetch('/api-gold/gold-rates/bangalore.html');
        htmlText = await res.text();
      } else {
        // Full Desktop User-Agent prevents GoodReturns anti-bot blocking
        const response = await CapacitorHttp.get({
          url: 'https://www.goodreturns.in/gold-rates/bangalore.html',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
          }
        });
        htmlText = response.data;
      }

      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlText, 'text/html');

      // Fallback selector to locate gold rate table
      const tables = doc.querySelectorAll('table');
      let targetTable = null;
      tables.forEach(t => {
        if (t.textContent.includes('24 Carat') || t.textContent.includes('22 Carat')) {
          targetTable = t;
        }
      });
      if (!targetTable && tables.length > 0) targetTable = tables[0];

      if (targetTable) {
        const rows = targetTable.querySelectorAll('tr');
        if (rows.length > 1) {
          const cols = rows[1].querySelectorAll('td');

          // Clean up scraped strings before saving
          const raw24k = cols[1]?.textContent || 'N/A';
          const raw22k = cols[2]?.textContent || 'N/A';

          const clean24k = cleanScrapedText(raw24k);
          const clean22k = cleanScrapedText(raw22k);

          const newRates = { k24: clean24k, k22: clean22k };

          setGoldRates(newRates);
          setGoldStatus(`Updated at ${new Date().toLocaleTimeString()}`);

          localStorage.setItem('gold_cache', JSON.stringify({ rates: newRates, timestamp: now.toISOString() }));

          // Write cleanly formatted rates to CSV
          await appendToCSV('Gold_Prices_History.csv', 'Date,24K Rate,22K Rate', `${now.toLocaleDateString()},${clean24k},${clean22k}`);
          return;
        }
      }
      throw new Error('Could not parse table');
    } catch (err) {
      setGoldStatus(`Failed: ${err.message || 'Scrape Error'}`);
    }
  }, []);

  // -------------------------------------------------------------
  // 2. CRYPTO DATA FETCHING (POL & SHIB)
  // -------------------------------------------------------------
  const fetchTokenData = async (symbol, currentUsdToInr) => {
    const tickerRes = await CapacitorHttp.get({ url: `https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}` });
    const ticker = typeof tickerRes.data === 'string' ? JSON.parse(tickerRes.data) : tickerRes.data;

    const klineRes = await CapacitorHttp.get({ url: `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=1h&limit=15` });
    const klines = typeof klineRes.data === 'string' ? JSON.parse(klineRes.data) : klineRes.data;

    let gains = 0, losses = 0;
    for (let i = 1; i < klines.length; i++) {
      const change = parseFloat(klines[i][4]) - parseFloat(klines[i - 1][4]);
      if (change >= 0) gains += change;
      else losses += Math.abs(change);
    }
    const avgGain = gains / 14;
    const avgLoss = losses / 14;
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    const rsi = Math.round(100 - (100 / (1 + rs)));

    let signal = 'NEUTRAL';
    if (rsi < 35) signal = 'BULLISH (BUY)';
    else if (rsi > 65) signal = 'BEARISH (SELL)';

    const priceInUsd = parseFloat(ticker.lastPrice);
    return {
      priceInr: priceInUsd * currentUsdToInr,
      change24h: parseFloat(ticker.priceChangePercent),
      rsi,
      signal,
    };
  };

  const fetchAllCryptoData = useCallback(async () => {
    if (isOffline) return;
    try {
      let currentUsdToInr = usdToInrRate || 84.5;
      try {
        const fxRes = await CapacitorHttp.get({ url: 'https://open.er-api.com/v6/latest/USD' });
        const fxData = typeof fxRes.data === 'string' ? JSON.parse(fxRes.data) : fxRes.data;
        currentUsdToInr = fxData.rates.INR;
        setUsdToInrRate(currentUsdToInr);
      } catch (e) { console.error("FX fetch failed"); }

      const [polResult, shibResult] = await Promise.all([
        fetchTokenData('POLUSDT', currentUsdToInr),
        fetchTokenData('SHIBUSDT', currentUsdToInr)
      ]);

      setPolData(polResult);
      setShibData(shibResult);
    } catch (err) { console.error(err); }
  }, [isOffline, usdToInrRate]);

  useEffect(() => {
    requestStoragePermission();
    scrapeGoldPrice();
    fetchAllCryptoData();
    const interval = setInterval(fetchAllCryptoData, 10000);
    return () => clearInterval(interval);
  }, [scrapeGoldPrice, fetchAllCryptoData]);

  // -------------------------------------------------------------
  // 3. TARGET CALCULATIONS & CSV LOGGING
  // -------------------------------------------------------------
  const activeData = selectedAsset === 'POL' ? polData : shibData;
  const entryPrice = parseFloat(buyPriceInput) || 0;
  const targetExitPrice = entryPrice > 0 ? entryPrice * 1.0521 : 0;

  const logTradeSignal = () => {
    if (!buyPriceInput) return alert("Please enter a Buy Price first!");

    const timestamp = new Date().toLocaleString();
    const currentRate = usdToInrRate.toFixed(2);
    const decimals = selectedAsset === 'SHIB' ? 6 : 2;

    const entry = entryPrice.toFixed(decimals);
    const target = targetExitPrice.toFixed(decimals);
    const currentMarket = activeData.priceInr.toFixed(decimals);

    const header = 'Timestamp,Asset,Signal,RSI,USD/INR Rate,Entry Price (INR),Expected Target (INR),Current Market Price (INR)';
    const row = `${timestamp},${selectedAsset}/INR,${activeData.signal},${activeData.rsi},${currentRate},${entry},${target},${currentMarket}`;

    appendToCSV('Trade_Signal_Performance.csv', header, row);
    alert(`✅ Logged ${selectedAsset} trade to Trade_Signal_Performance.csv!`);
  };

  return (
    <div className="dashboard-container">
      <h1 className="dashboard-title">Tracker {isOffline && <span style={{ color: '#f87171' }}>(OFFLINE)</span>}</h1>

      <div className="card-grid">
        {/* GOLD CARD WITH MANUAL OVERRIDE BUTTON */}
        <div className="card" style={{ gridColumn: '1 / -1' }}>
          <div className="card-header" style={{ justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Coins className="gold-icon" size={24} />
              <h2 className="card-title">Bangalore Gold Rate</h2>
            </div>
            <button
              onClick={() => scrapeGoldPrice(true)}
              style={{ background: 'none', border: 'none', color: '#3b82f6', cursor: 'pointer' }}
              title="Force Refresh & Recreate CSV"
            >
              <RefreshCw size={18} />
            </button>
          </div>
          <div className="price-box" style={{ display: 'flex', justifyContent: 'space-around' }}>
            <div className="price-24k">24K: {goldRates.k24}</div>
            <div className="price-22k">22K: {goldRates.k22}</div>
          </div>
          <p className="status-message" style={{ marginTop: '16px' }}>{goldStatus}</p>
        </div>

        {/* POL CARD */}
        <div className="card">
          <div className="card-header">
            <TrendingUp className="code-icon" size={24} />
            <h2 className="card-title">POL/INR Signal</h2>
          </div>
          <div className="price-box">
            <div className="price-24k">₹{polData.priceInr.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
            <div className="unit-label" style={{ color: polData.change24h >= 0 ? '#4ade80' : '#f87171' }}>
              24h Change: {polData.change24h >= 0 ? '+' : ''}{polData.change24h}%
            </div>
          </div>
          <div style={{ fontSize: '0.875rem', color: '#cbd5e1' }}>
            <p><strong>1h RSI:</strong> {polData.rsi}</p>
            <p><strong>Signal:</strong> <span style={{ color: polData.signal.includes('BUY') ? '#4ade80' : '#f87171' }}>{polData.signal}</span></p>
          </div>
        </div>

        {/* SHIB CARD */}
        <div className="card">
          <div className="card-header">
            <TrendingUp className="code-icon" size={24} />
            <h2 className="card-title">SHIB/INR Signal</h2>
          </div>
          <div className="price-box">
            <div className="price-24k">₹{shibData.priceInr.toLocaleString(undefined, { maximumFractionDigits: 6 })}</div>
            <div className="unit-label" style={{ color: shibData.change24h >= 0 ? '#4ade80' : '#f87171' }}>
              24h Change: {shibData.change24h >= 0 ? '+' : ''}{shibData.change24h}%
            </div>
          </div>
          <div style={{ fontSize: '0.875rem', color: '#cbd5e1' }}>
            <p><strong>1h RSI:</strong> {shibData.rsi}</p>
            <p><strong>Signal:</strong> <span style={{ color: shibData.signal.includes('BUY') ? '#4ade80' : '#f87171' }}>{shibData.signal}</span></p>
          </div>
        </div>

        {/* LOGGING CARD */}
        <div className="card" style={{ gridColumn: '1 / -1' }}>
          <div className="card-header">
            <AlertCircle className="mobile-icon" size={24} />
            <h2 className="card-title">Trade Logging (+5% Target)</h2>
          </div>

          <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
            <select
              value={selectedAsset}
              onChange={(e) => setSelectedAsset(e.target.value)}
              style={{ padding: '10px', borderRadius: '8px', backgroundColor: '#0f172a', color: '#fff', border: '1px solid #334155' }}>
              <option value="POL">POL</option>
              <option value="SHIB">SHIB</option>
            </select>
            <input
              type="number"
              placeholder={`Buy Price in ₹`}
              value={buyPriceInput}
              onChange={(e) => setBuyPriceInput(e.target.value)}
              style={{ flex: 1, padding: '10px', borderRadius: '8px', backgroundColor: '#0f172a', color: '#fff', border: '1px solid #334155' }}
            />
          </div>

          {entryPrice > 0 && (
            <div style={{ backgroundColor: '#0f172a', padding: '12px', borderRadius: '8px', marginBottom: '16px', fontSize: '0.85rem' }}>
              <p style={{ color: '#facc15' }}><strong>Target Exit (+5%):</strong> ₹{targetExitPrice.toLocaleString(undefined, { maximumFractionDigits: selectedAsset === 'SHIB' ? 6 : 2 })}</p>
              <p style={{ color: '#cbd5e1', marginTop: '4px' }}><strong>Current Price:</strong> ₹{activeData.priceInr.toLocaleString(undefined, { maximumFractionDigits: selectedAsset === 'SHIB' ? 6 : 2 })}</p>
            </div>
          )}

          <button className="refresh-btn" style={{ backgroundColor: '#10b981', width: '100%' }} onClick={logTradeSignal}>
            <Save size={16} /> Log {selectedAsset} Trade to CSV
          </button>
        </div>
      </div>
    </div>
  );
}