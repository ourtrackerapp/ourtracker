# Vercel Deployment & Migration Guide

This application is fully prepared and optimized for serverless deployment on **Vercel**.

## 🚀 Deployment Instructions for Vercel

1. **Import Repository to Vercel**:
   - Push your workspace code to a GitHub / GitLab / Bitbucket repository.
   - Connect the repository in the Vercel Dashboard (**New Project**).

2. **Framework & Build Settings**:
   - **Framework Preset**: Vite
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
   - **Install Command**: `npm install`

3. **Environment Variables**:
   Add the following variables under **Project Settings -> Environment Variables** in Vercel:

   ### 📊 Stock & Market Data Providers
   - `FINNHUB_API_KEY_1` = `dag9ggpr01quf8mtbus0dag9ggpr01quf8mtbusg`
   - `FINNHUB_API_KEY_2` = `dajunfhr01qrg9hppa10dajunfhr01qrg9hppa1g`
   - `ALPACA_API_KEY_ID` = `PK181E99T1E1K8N1O111`
   - `ALPACA_API_SECRET_KEY` = (Definido nas tuas definições Alpaca)
   - `GEMINI_API_KEY` = (A tua chave Gemini API)

   ### 🔥 Firebase & Firestore Database (Para o teu projeto: ourtracker-15a80)
   - `VITE_FIREBASE_PROJECT_ID` = `ourtracker-15a80`
   - `VITE_FIREBASE_APP_ID` = *(A tua App ID de: Firebase Console -> Project Settings -> Web App)*
   - `VITE_FIREBASE_API_KEY` = *(A tua API Key de: Firebase Console -> Project Settings -> Web App)*
   - `VITE_FIREBASE_AUTH_DOMAIN` = `ourtracker-15a80.firebaseapp.com`
   - `VITE_FIREBASE_DATABASE_ID` = `(default)`
   - `VITE_FIREBASE_STORAGE_BUCKET` = `ourtracker-15a80.firebasestorage.app`
   - `VITE_FIREBASE_MESSAGING_SENDER_ID` = *(O teu Messaging Sender ID)*

4. **Architecture Overview**:
   - `api/index.ts` re-encaminha todas as chamadas de backend `/api/*` para a Serverless Function Express.
   - `vercel.json` garante o reencaminhamento correto para a API e o SPA do frontend em `index.html`.
   - `src/firebase.ts` funciona de forma híbrida: lê automaticamente as variáveis de ambiente do Vercel ou o ficheiro `firebase-applet-config.json` incluído no repositório.

## 📈 Endpoints de API Ativos

- `GET /api/health` -> Estado da aplicação
- `GET /api/quotes?symbols=SXR8.DE,VWCE.DE,AAPL` ou `POST /api/quotes` -> Cotações em tempo real com fallback inteligente
- `GET /api/quote/:ticker` -> Cotação individual
- `GET /api/chart/:ticker?range=1m` -> Dados históricos de gráfico e métricas
- `GET /api/fx/:from` -> Taxa de câmbio para EUR
- `GET /api/fx/convert/rate?from=USD&to=EUR` -> Conversão de moedas
- `GET /api/portfolio/sync` & `POST /api/portfolio/sync` -> Sincronização de portfólio no Firestore
