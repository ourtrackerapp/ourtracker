# Vercel Deployment & Setup Guide

This project is fully prepared and optimized for serverless deployment on **Vercel**.

## 🚀 Deployment Instructions for Vercel

1. **Import Repository to Vercel**:
   - Connect your GitHub / Git repository to Vercel.
   - Vercel automatically detects the project build configuration.

2. **Build & Output Configuration**:
   - **Framework Preset**: Vite
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`

3. **Environment Variables**:
   Add the following variables in your Vercel Project Settings -> Environment Variables:
   - `TWELVE_DATA_API_KEY_1` (Optional fallback key)
   - `TWELVE_DATA_API_KEY_2` (Optional fallback key)
   - `FINNHUB_API_KEY_1` (Optional fallback key)
   - `FINNHUB_API_KEY_2` (Optional fallback key)
   - `VITE_FIREBASE_API_KEY`
   - `VITE_FIREBASE_AUTH_DOMAIN`
   - `VITE_FIREBASE_PROJECT_ID`
   - `VITE_FIREBASE_STORAGE_BUCKET`
   - `VITE_FIREBASE_MESSAGING_SENDER_ID`
   - `VITE_FIREBASE_APP_ID`

4. **Serverless Function Architecture**:
   - `api/index.ts` exports the Express application for Vercel serverless function routing.
   - `vercel.json` routes `/api/*` to the serverless function and all frontend routes to `index.html`.

## 📈 Supported API Endpoints

- `GET /api/health` -> Health check endpoint
- `GET /api/quotes?symbols=SXR8.DE,VWCE.DE,AAPL` or `POST /api/quotes` -> Batch quote lookup
- `GET /api/quote/:ticker` -> Single ticker quote
- `GET /api/chart/:ticker?range=1m` -> Historical chart data with window metrics
- `GET /api/fx/:from` -> Currency exchange rate to EUR
- `GET /api/fx/convert/rate?from=USD&to=EUR` -> FX conversion rate details
- `GET /api/portfolio/sync` & `POST /api/portfolio/sync` -> Cloud sync endpoint

## 🇪🇺 European Stock & ETF Ticker Resolution

The application natively supports European exchange suffixes without hardcoded patches:
- Germany (XETRA): `.DE` (e.g., `SXR8.DE`, `VWCE.DE`, `VUAA.DE`)
- Euronext Amsterdam: `.AS` (e.g., `IWDA.AS`, `ASML.AS`)
- Euronext Paris: `.PA` (e.g., `UST.PA`, `MC.PA`)
- London Stock Exchange: `.L` (e.g., `VUAA.L`, `AZN.L`)
- Borsa Italiana: `.MI`
- Bolsa de Madrid: `.MC`
- SIX Swiss Exchange: `.SW`

## 💷 British Currency (GBp vs GBP) Logic

- Price division by 100 occurs **only** when the provider response explicitly specifies the currency as `GBp`, `GBX`, or `PENCE`.
- If the price is already returned in pounds (`GBP`), it is preserved as pounds without artificial division.
