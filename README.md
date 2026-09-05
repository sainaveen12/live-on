# 📈 Gold & Crypto Tracker Dashboard

A hybrid web and mobile application built with React, Vite, and Capacitor. This app serves as a personal dashboard to track live Bangalore gold rates via web scraping and monitor real-time Bitcoin (BTC/USDT) trends with a built-in 1-hour RSI signal generator and 5% net-profit calculator.

## ✨ Currently Implemented Features

*   **Live Gold & Crypto Scraping:** Tracks live 24K/22K Bangalore gold rates (via CapacitorHttp) and BTC/USDT prices (via Binance API).
*   **10 AM Smart Caching Rule:** Gold prices are fetched only once per day after 10:00 AM. Accessing the app before 10:00 AM automatically loads the cached record from the previous day to save network requests and avoid scraping blocks
*   **Offline Mode:** If network connectivity drops, the app gracefully falls back to local `localStorage` caches and displays an Offline status indicator.
*   **Native CSV Sheet Storage:** Utilizes `@capacitor/filesystem` to request Android storage permissions and automatically append data into `.csv` files inside the device's `Documents` folder:
    *   `Gold_Prices_History.csv` (Logs daily scraped rates)
    *   `Trade_Signal_Performance.csv` (Logs manual trade entries, RSI signals, and 5% target math).
*   **Capacitor Native HTTP:** Bypasses mobile CORS restrictions by utilizing `@capacitor/core` native `CapacitorHttp` to execute requests directly on Android.
*   **Crypto Market Tracking:** Fetches real-time BTC/USDT prices and 24-hour change percentages via the Binance Public API.
*   **1-Hour RSI Signals:** Calculates a 14-period Relative Strength Index (RSI) using hourly candlestick data to generate basic Bullish (Buy) or Bearish (Sell) signals.
*   **Net Profit Calculator:** Automatically calculates the exact breakeven and exit target prices required to hit a clean 5% net profit, factoring in standard 0.1% exchange trading fees.
*   **Native Android APK Support:** Fully wrapped with CapacitorJS to compile directly into a native Android `.apk` via Android Studio.

## 🚀 Points to Implement (Roadmap)

### 1. Smart Gold Rate Caching (10 AM Trigger)
*   Implement logic to fetch the gold rate only once a day after **10:00 AM**.
*   If the app is opened before 10:00 AM, load the cached record from the previous day.
*   Save the newly fetched record locally and retain it until 10:00 AM the following day to prevent unnecessary scraping requests.

### 2. Offline Mode Support
*   Implement network detection to handle offline scenarios gracefully.
*   Fallback to the last locally saved gold rates and crypto tracking variables when no internet connection is available.

### 3. Local Sheet Storage & Permissions
*   Request native Android file/storage permissions via Capacitor.
*   Generate and update two separate local spreadsheet (CSV/Excel) files on the mobile device:
    1.  **Gold Price History Sheet:** To log daily gold rates for long-term tracking.
    2.  **Trade & Signal Performance Sheet:** To record signal accuracy, entry/exit prices, hold times, and manual vs. automated trade results.

## 🛠️ Tech Stack

*   **Frontend:** React, Vite, Lucide-React (Icons)
*   **Mobile Wrapper:** CapacitorJS (`@capacitor/core`, `@capacitor/android`)
*   **Data Parsing:** Standard DOMParser for HTML scraping
*   **APIs:** Binance REST API (Crypto), GoodReturns (Gold via Web Scrape)

## 💻 How to Run Locally (Web)

1. Install dependencies:
   ```bash
   npm install
   npm run dev
   npx cap sync
   npx cap open android