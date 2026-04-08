# 🃏 Real-Time Local Poker Engine

A blazing-fast, real-time Texas Hold'em companion web app designed for in-person play. This application acts as a digital dealer, managing the pot, chip stacks, betting math, turn enforcement, and custom house rules. **Note: This app does not deal physical cards; it is strictly a digital ledger and betting engine.**

## ✨ Features

* **Real-Time Turn Synchronization:** Sub-millisecond latency using native WebSockets (`Socket.io`) to broadcast player actions across the room instantly.
* **Stateless/In-Memory Architecture:** Completely bypasses external databases (like Redis or Postgres). The entire game state is managed in the Node.js server's local RAM using a native `Map()`, resulting in zero database read/write latency.
* **Auto-Cleanup / Self-Destruct:** The engine tracks connected sockets and automatically purges the room's memory the moment the final player disconnects.
* **Visual Chip Distribution:** Uses a custom "Base Change + Greedy Algorithm" to automatically convert a player's raw numeric balance into visually accurate, tappable chip denominations (10, 50, 100, 500, 1K, 5K, 10K, 50K, 100K).
* **Synchronized Audio Engine:** A robust client-side audio manager that syncs background music tracks (`Room1` - `Room5`) across all connected devices in the physical room, along with local UI sound effects for chips and button clicks.
* **Time-Machine Undo:** Admin controls feature a snapshot-based undo system to revert the room state to the beginning of the current betting round in case of misclicks.

## 🛠️ Tech Stack

* **Frontend:** Next.js (App Router), React, Tailwind CSS
* **Backend:** Node.js, Express.js
* **Real-Time Engine:** Socket.io
* **Database:** `null` (Local RAM)

## 🏗️ Architecture Note: The Custom Server

This Next.js application does **not** use the standard Next.js backend routing. To support persistent WebSockets and share memory between the frontend and backend, it utilizes a **Custom Node.js Server pattern** (`server.js`). 

The single `server.js` file boots up Express, attaches the Socket.io instance, and then passes HTTP routing down to Next.js.

## 🚀 Local Development

Because of the custom server architecture, do not use the standard `npm run dev` command.

1. Clone the repository:
   ```bash
   git clone [https://github.com/YOUR_USERNAME/poker-engine.git](https://github.com/YOUR_USERNAME/poker-engine.git)
   cd poker-engine
   ```
2. Install dependencies:

```
npm install
```
3. Start the custom server:

```
node server.js
```
Open http://localhost:3000 in your browser.

##🌍 Deployment (Important)
DO NOT deploy this application to Vercel, Netlify, or other Serverless platforms. Serverless platforms kill the server process after every HTTP request, which will instantly disconnect the WebSockets and erase the in-memory activeRooms Map.

This app requires a persistent, long-running Node environment. It is optimized for Render or Railway.

Deploying to Render (Free Tier)
Connect your GitHub repository to Render as a Web Service.

Set the Environment to Node.

Build Command: npm install && npm run build

Start Command: npm start

The free tier's 15-minute inactivity sleep is an intended feature—it acts as a hard reset for the RAM when the game is over.
