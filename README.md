# 🚗 FuelSync JB — Smart Fuel Cost Calculator for Singapore Drivers

A full-stack web application that helps Singapore drivers determine whether it is financially worth travelling to Johor Bahru (JB) to pump fuel.

By combining live fuel price data, exchange rates, travel costs, and vehicle efficiency, the app provides a clear and realistic estimate of actual savings — turning a common real-world dilemma into a data-driven decision.

Done by: Shahul Hameed and Mohammad Ilham
---

## 🌟 Why This Project Matters

Many drivers assume pumping fuel in JB is always cheaper — but this is not always true.

This project solves that problem by:
- Quantifying *true trip cost* (fuel + tolls + distance)
- Comparing Singapore vs JB fuel prices in real time
- Providing a simple, user-friendly decision tool

---

## ✨ Key Features

- ⛽ Live fuel price retrieval (Singapore & Malaysia)
- 💱 Adjustable SGD → MYR exchange rate
- 🚘 Custom vehicle fuel consumption (km/L)
- 📍 Distance estimation based on user location
- 🛣️ Checkpoint selection:
  - Woodlands Causeway
  - Tuas Second Link
- 💸 Full trip cost breakdown:
  - Fuel cost in JB
  - Travel fuel cost
  - Tolls and road charges
- 📊 Net savings calculation
- ⚡ Fast performance with backend caching
- 🌐 Deployable via Vercel (serverless-ready)

---

## 🧠 How It Works

1. Backend fetches fuel prices from external sources
2. Data is parsed using `cheerio`
3. Results are cached to reduce repeated requests
4. User inputs:
   - Exchange rate
   - Fuel types (SG & MY)
   - Fuel amount
   - Fuel economy
   - Location / distance
   - Checkpoint
5. The system calculates:
   - Cost if pumping in Singapore
   - Cost of pumping in JB
   - Travel fuel usage
   - Toll costs
6. Final output shows **actual savings (or loss)**

---

## 🛠️ Tech Stack

**Frontend**
- HTML
- CSS
- JavaScript

**Backend**
- Node.js
- Express

**Libraries & Tools**
- Cheerio (data scraping)
- CORS (API handling)
- Leaflet (map support)
- Vercel (deployment)

---

## 📂 Project Structure

```bash
JBFuelPump-main/
├── api/
│   └── fuel-prices.js
├── app.js
├── index.html
├── server.js
├── styles.css
├── test.js
├── vercel.json
├── package.json
└── README.md
