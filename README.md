# Live Precious Metals Spot Tracker & Global Tax Calculator

A high-performance, real-time precious metals spot price dashboard and global acquisition tax localization calculator. Built with Hono (NodeJS/Cloudflare Workers compatible) and React (Vite, TypeScript, Vanilla CSS).

---

## 🚀 Key Features

### 📡 Real-Time Price Streaming
*   **SSE (Server-Sent Events)**: Backend pushes live spot price ticks for Gold, Silver, Platinum, and Palladium directly from TradingView spot indices (`TVC:GOLD`, `TVC:SILVER`, `TVC:PLATINUM`, `TVC:PALLADIUM`).
*   **Memory-Cache Fallback**: In-memory caching on the backend ensures continuous server response if the external TradingView scanner API suffers temporary network issues.
*   **Offline Fallback**: If the backend server fails or the client loses internet access, the dashboard automatically halts ticking and locks onto the latest successfully fetched prices, preventing volatile random price fluctuations.

### 🌍 Dynamic GeoIP Localization
*   **Resilient Geo-Detection**: Auto-detects the user's location on page load by querying multiple HTTPS fallback geolocation APIs in sequence (`freeipapi.com` ➔ `ipapi.co` ➔ `ipinfo.io`).
*   **Automatic Country Selection**: Automatically pivots the currency, weight units, and tax profiles to match the user's home country.

### 💰 Localized Cost & Tax Calculator
*   **Acquisition Cost Breakdown**: Computes raw metal spot value, custom tariffs & import duties, dealer premium markups, and local VAT/GST rates.
*   **Metal-Level Tax Overrides**: Supports country-level tax structures with custom overrides per metal type (e.g. India's 3% GST on Gold/Silver vs 18% GST on Platinum/Palladium).
*   **Weight Units Conversion**: Seamlessly scales calculations across ounces (`oz`), grams (`g`), kilograms (`kg`), pennyweight (`dwt`), and popular regional units:
    *   **tola** (South Asia - exactly `10g`)
    *   **tael** (Greater China - exactly `37.5g`)
    *   **baht** (Thailand - exactly `15.244g`)
    *   **mesghal** (Middle East - exactly `4.6083g`)

### 📊 Interactive Visualizations
*   **Historical Charts**: Interactive analytics charts visualizing price fluctuations across dynamic timeframes (`24h`, `7d`, `30d`, `1y`, `5y`).
*   **Interactive Tooltips**: Comprehensive website-wide title tooltips explaining calculated price compositions (International Spot vs Duty Paid Spot vs Acquisition Subtotals).

### 📱 Premium Mobile-First Design
*   **Aesthetics**: Glassmorphism dashboard styling featuring custom metallic price text gradients matching the physical gold, silver, platinum, and palladium colors.
*   **Responsive Layout**: Mobile-first flex layout that neatly collapses into a single-column stack with touch-friendly controls.

---

## 🛠️ Project Structure

```
├── .env                    # Local environment variables & country tax configs
├── server.ts               # Runtime-agnostic Hono core routes & SSE logic
├── entry.node.ts           # Node.js server launcher entry point
├── package.json            # Scripts & dependencies
├── tsconfig.json           # TSConfig references
├── deployment/
│   ├── wrangler.toml       # Cloudflare Workers serverless deployment config
│   └── DEPLOYMENT.md       # Detailed multi-cloud deployment documentation
├── src/
│   ├── main.tsx            # React application entry point
│   ├── App.tsx             # Main layout, SSE listener & state controller
│   ├── index.css           # Styling system & utility class rules
│   ├── components/         # Reusable JSX components (LivePriceCards, Calculator, AdSlot, AnalyticsChart)
│   ├── data/               # Country profiles & exchange rate constants (countries.ts)
│   ├── services/           # Price engine, conversions, history generator (priceEngine.ts)
│   └── types/              # TypeScript declarations (metals.ts)
```

---

## 💻 Local Setup & Installation

### 1. Prerequisites
*   Node.js (v18 or higher)
*   NPM (v10 or higher)

### 2. Install Dependencies
```bash
npm install
```

### 3. Environment Configuration
Create or configure the `.env` file in the root directory:
```env
# Server endpoints
VITE_HONO_SERVER_URL=http://localhost:3000

# Analytics Tag
VITE_GOOGLE_TAG_ID=G-XXXXXXXXXX

# India (INR) Tax Profile example
VITE_COUNTRY_IN_IMPORT_DUTY=15.0
VITE_COUNTRY_IN_VAT_GST=3.0
VITE_COUNTRY_IN_DEFAULT_WEIGHT=10.0
VITE_COUNTRY_IN_DEFAULT_UNIT=g
```

### 4. Running the Servers Locally

*   **Start the Hono Backend Server** (Port `3000`):
    ```bash
    npm run server
    ```
*   **Start the React Development Server** (Vite):
    ```bash
    npm run dev
    ```

Open your browser to the URL printed in the console (usually `http://localhost:5173`).

---

## 🧪 Linting, Formatting & Compilation

*   **Format code** using Prettier:
    ```bash
    npm run format
    ```
*   **Lint code** using ESLint:
    ```bash
    npm run lint
    ```
*   **Verify TypeScript build** (Client & Server):
    ```bash
    npm run build
    ```

---

## 🌐 Production Deployment

For detailed production instructions across multiple platforms, refer to the [deployment/DEPLOYMENT.md](file:///Users/akashre/WebstormProjects/metalpricetracker/deployment/DEPLOYMENT.md) guide:
*   **VPS Hosting**: Setup PM2 and node processes.
*   **PaaS Hosting**: Render and Heroku deployments using `entry.node.ts`.
*   **Static CDN**: Vercel, Netlify, and Cloudflare Pages.
*   **Serverless Workers**: Exposing endpoints directly via Cloudflare Workers (`npx wrangler deploy`).

### 🔗 Live Project URL Endpoints

*   **Production App (Custom Domain)**: [https://metalprices.online/](https://metalprices.online/)
*   **Cloudflare Pages Deploy (Frontend Mirror)**: [https://metalpricetracker.pages.dev/](https://metalpricetracker.pages.dev/)
*   **Cloudflare Workers Deploy (Hono API Backend)**: [https://yfinlib.akashreddyengineer.workers.dev](https://yfinlib.akashreddyengineer.workers.dev)
