# EcoShare - Community Resource Sharing & Sustainability Platform

EcoShare is a modern, high-fidelity Single Page Application (SPA) designed to foster neighborhood sustainability. It allows residents to list, bookmark, search, and coordinate the sharing of unused resources (e.g., tools, food, books, appliances, furniture) using interactive map visualization and real-time messaging.

---

## 🌟 Key Features

1. **Dual Backend Architecture**: Transparently switches between a local sandbox database (LocalStorage-based `MockDatabase`) and a live Cloud Firebase instance (Firestore, Auth, and Storage).
2. **Community Admin Panel & Approval Queue**:
   * All new user registrations go into a pending approval block.
   * Authorized community admins (`admin@ecoshare.com` and `admin@gmail.com`) can review, approve, or reject pending profiles.
3. **Admin Analytics Dashboard**:
   * Real-time KPIs for total shares, active users, exchanges, and carbon offsets (2.5 kg CO2 saved per item).
   * HSL dynamic SVG category donut chart and 6-month vertical sharing activity bar charts.
   * Contributor leaderboard tracking top sustainability champions.
4. **General Community Lobby Chat**: A permanent, neighborhood-wide chat room where every approved user is automatically joined for community coordinate updates.
5. **Interactive Map (Leaflet.js)**: Displays neighborhood resource listings geographically with interactive coordinate pickers.
6. **Real-time Messaging**: Direct coordination chat threads to coordinate item hand-offs with other residents.
7. **Single Active Session Lock**: Real-time Firestore observers automatically log out active logins if another session is initialized.
8. **In-App Toast Alerts**: Dynamic toast messages notify online users of account approvals and background chat updates.

---

## 🏗️ Project Architecture Summary

EcoShare uses a modular Single Page Application structure:
* **Frontend UI**: Vanilla HTML5, CSS3, JavaScript (ES6 Modules)
* **Maps**: Leaflet.js
* **Backend Configurations**: Emulates LocalStorage (Mock DB) and maps to Google Firebase Services (Auth, Firestore, Storage) when credentials are provided.
* **Capacitor Integration**: Enables compilation to native iOS and Android packages by wrapping the web assets in a native WebView controller.

For details, see the directory structure in [DEPLOYMENT.md](DEPLOYMENT.md).

---

## 🛠️ GitHub Repository

The official codebase is hosted at:
[https://github.com/ashritha123-code/eco-share.git](https://github.com/ashritha123-code/eco-share.git)

Refer to the **GitHub Setup Guide** section in [DEPLOYMENT.md](DEPLOYMENT.md) for remote setup and branch synchronization steps.

---

## 🚀 Getting Started

### Local Sandbox Development

1. Clone the repository and navigate to the project directory:
   ```bash
   git clone https://github.com/ashritha123-code/eco-share.git
   cd eco-share
   ```
2. Install dependencies and start the development server:
   ```bash
   npm install
   npm run dev
   ```
3. Open your browser and navigate to `http://localhost:3000`.

### Building the Android App

For steps on compiling the release APK (`app-release-unsigned.apk`) or App Bundle (`app-release.aab`), see the **Android APK Build Guide** in [DEPLOYMENT.md](DEPLOYMENT.md).

### Cloud and Web Deployment

For guides on configuring Firebase Authentication, Cloud Firestore rules, Firebase Storage CORS permissions, and publishing to Google Firebase Hosting, see [DEPLOYMENT.md](DEPLOYMENT.md).
