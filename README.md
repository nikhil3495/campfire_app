# Campfire - College Blind Dating Web Application

Campfire is a premium college blind dating web application designed with modern aesthetics (soft pastel pinks, deep violet accents, and white glassmorphism). It supports location-based proximity matchmaking, security verification (Aadhaar & Student ID cards), paywalled membership levels, and real-time chat with photo attachments.

---

## 🌟 Key Features

1. **Blind Dating Queue**: Users enter a queue and are matched anonymously. Their names and profile pictures are completely locked and blurred.
2. **Dynamic Unblur Ring**: As matches chat, a progress bar counts up to 10 exchanged messages, after which users can click "Reveal Profile" to mutually unblur each other's real names and 6-photo profile galleries.
3. **Multi-Photo Profile Onboarding**: Supports uploading and showcasing up to 6 profile photos.
4. **Chat Photo Attachments**: Share photos directly in socket-based chat rooms.
5. **Location-Based Proximity Sorting**: Automatically uses the browser Geolocation API on onboarding and uses Euclidean distance formulas to rank nearby matches first.
6. **Security Fields**: Optional 12-digit Aadhaar card number input and Student ID Card URL verification.
7. **Premium Subscription Paywall**: Free users are limited to 5 blind date matches. Afterwards, a paywall modal prompts them to subscribe to plans of **₹99/month** or **₹999/year** to unlock matching.
8. **Developer Simulation Toolbar**: Direct launch buttons on the settings screen to test 5 matching logs and paywall limits instantly.

---

## 🚀 Local Installation & Run

### 1. Install Dependencies
Navigate to the project directory and install the packages:
```bash
npm install
```

### 2. Start the Server
Start the Node.js server:
```bash
node server.js
```
The application will start on **http://localhost:3000**.

*Note: If no `DATABASE_URL` is configured in your system environment, the server automatically defaults to a mock in-memory database fallback to allow testing without PostgreSQL.*

---

## ☁️ Production Deployment

### 1. Render Blueprint (Recommended)
This repository contains a **`render.yaml`** configuration file. When you push this project to GitHub:
1. Log in to **[Render](https://render.com/)**.
2. Click **New** > **Blueprint**.
3. Select this repository. It will automatically build the Node server and provision a free PostgreSQL database, linking them together.

### 2. Container Deployments
A production **`Dockerfile`** is included in the root folder. You can build and run this container locally or host it on Google Cloud Run, AWS, or fly.io:
```bash
docker build -t campfire-app .
docker run -p 3000:3000 campfire-app
```

---

## 📦 How to Push to GitHub

Since git requires account authentication, you need to run the final push command locally. Follow these steps:

1. Open **PowerShell** or terminal inside `C:\Users\nikhil\.gemini\antigravity\scratch\campfire_app`.
2. Run these commands to initialize git and commit your files:
   ```bash
   git init
   git add .
   git commit -m "Initial commit of Campfire Web App"
   git branch -M main
   ```
3. Create a repository named **`campfire_app`** under your GitHub profile (`https://github.com/nikhil3495`).
4. Link and push your project:
   ```bash
   git remote add origin https://github.com/nikhil3495/campfire_app.git
   git push -u origin main
   ```
