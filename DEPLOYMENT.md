# EcoShare - Final Deployment & Documentation Guide

EcoShare is a modern, high-fidelity Single Page Application (SPA) designed to foster neighborhood sustainability by allowing residents to list, bookmark, search, and coordinate the sharing of unused resources. It is built as a native-feeling progressive web app and wrapped with Capacitor for native Android execution.

---

## 🌟 1. Feature Summary

1. **Dual-Backend Emulation**: Dynamically toggles between a LocalStorage-based **Mock Database Sandbox** (no internet or cloud credentials required) and a live **Google Firebase Cloud** backend (Firestore, Authentication, and Storage).
2. **Community Admin Panel & Approval Queue**:
   * All new resident registrations go into a **Pending Approval** block.
   * Authorized community admins (`admin@ecoshare.com` and `admin@gmail.com`) can review, approve, or reject pending profiles.
3. **Admin Analytics Dashboard**:
   * Interactive live KPIs (Total Shared Items, Active Neighbors, Completed Exchanges, and Carbon Saved).
   * Color-coded HSL SVG Donut Chart showing resource category distributions.
   * 6-Month dynamic bar charts showing sharing activity.
   * Active Sustainability Leaderboard showcasing the top 5 contributors.
4. **General Community Lobby Chat**: A permanent, system-wide chat room that automatically joins all verified residents for general neighborhood coordination.
5. **Leaflet.js Map Visualizations**: Shows resource listings geographically with interactive coordinate pickers.
6. **Single Active Session Lock**: Real-time observer automatically logs out account sessions if a login event from another location occurs.
7. **In-App Toast Alerts**: Dynamic toast messages notify online residents of account approvals and background chat messages.

---

## 🏗️ 2. Project Architecture Summary

EcoShare uses a modular **Vanilla HTML, CSS, and ES6 JavaScript (Single Page Application)** model. It avoids complex UI compilation frameworks to run directly in the browser or WebView containers.

```text
ecoshare/
├── index.html               # Core SPA Shell, layouts, modals, forms and template containers
├── styles.css               # Design system variables, dark/light themes, SVG animations, and glassmorphic UI
├── package.json             # NPM dependencies, scripts, build steps, and Capacitor descriptors
├── capacitor.config.json    # Capacitor configuration mapping assets to native WebView
├── DEPLOYMENT.md            # Master deployment & setup instructions
├── README.md                # General user instructions
└── src/
    ├── app.js               # Main router, config modal controller, and entry loader
    ├── auth.js              # Auth screen flows, registration pipelines, and admin panel modules
    ├── chats.js             # General lobby and private message thread handlers
    ├── firebase-config.js   # Dynamic Firebase SDK loader, config state, and cloud adapters
    ├── map.js               # Leaflet map instance and coordinate pickers
    ├── mock-db.js           # Offline LocalStorage database database engine and fake APIs
    └── resources.js         # Listings card generator, filters, search, and CRUD methods
```

---

## 🐙 3. GitHub Setup Guide

To push your local code changes to your GitHub remote repository:

1. Initialize a local Git repository (if not already done):
   ```bash
   git init
   ```
2. Create a `.gitignore` file to avoid checking in bulky compiled folders:
   ```text
   node_modules/
   www/
   android/.gradle/
   android/app/build/
   android/local.properties
   .DS_Store
   firebase-config.json
   ```
3. Stage all source, configuration, and documentation assets:
   ```bash
   git add .
   ```
4. Commit your files:
   ```bash
   git commit -m "chore: prepare ecoshare for final delivery and capacitor builds"
   ```
5. Set your remote GitHub URL:
   ```bash
   git remote add origin https://github.com/ashritha123-code/eco-share.git
   ```
6. Push your branch to GitHub (main/master branch):
   ```bash
   git branch -M main
   git push -u origin main
   ```

---

## 💻 4. Local Development Guide

To run the application locally on your computer:

### Prerequisites
* **Node.js** (v16.0.0 or higher recommended)
* **NPM** (installed automatically with Node)

### Step-by-Step Launch
1. Open a terminal inside the project directory:
   ```bash
   cd ecoshare
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run the development server:
   ```bash
   npm run dev
   ```
   *Note: On Windows systems experiencing PowerShell execution policy restrictions, run: `npm.cmd run dev` or `npx.cmd http-server -p 3000 -c-1`.*
4. Open your browser and navigate to:
   [http://localhost:3000](http://localhost:3000)

---

## ☁️ 5. Web Deployment Guide (Google Firebase Hosting)

To deploy the web application to a public, secure live URL:

### Step 5.1: Create a Firebase Project
1. Go to the [Firebase Console](https://console.firebase.google.com/).
2. Click **Add Project** and give it a name (e.g. `ecoshare-sustainability`).
3. Under the sidebar build menu, enable **Authentication** (enable **Email/Password** provider).
4. Create a **Cloud Firestore** database. Put the following security rules in the **Rules** tab:
   ```javascript
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /resources/{resourceId} {
         allow read, write: if true;
       }
       match /users/{userId} {
         allow read, write: if true;
       }
       match /chats/{chatId} {
         allow read, write: if true;
         match /messages/{messageId} {
           allow read, write: if true;
         }
       }
     }
   }
   ```
5. Create a **Cloud Storage** bucket. Put the following rules in the **Rules** tab:
   ```javascript
   rules_version = '2';
   service firebase.storage {
     match /b/{bucket}/o {
       match /{allPaths=**} {
         allow read, write: if true;
       }
     }
   }
   ```

> [!IMPORTANT]
> **Firebase Storage CORS Setup for Local Development**
>
> If resource image uploads fail due to browser preflight HTTP blocks, create a `cors.json` file:
> ```json
> [
>   {
>     "origin": ["*"],
>     "method": ["GET", "PUT", "POST", "DELETE", "HEAD"],
>     "responseHeader": ["Content-Type", "x-goog-meta-author", "x-goog-meta-owner"],
>     "maxAgeSeconds": 3600
>   }
> ]
> ```
> Run the following CLI command in Google Cloud SDK to bind the rules to your bucket:
> ```bash
> gsutil cors set cors.json gs://<your-bucket-name>.appspot.com
> ```

### Step 5.2: Create and Set Web App Config
1. Register a Web App in Firebase console under **Project Settings**.
2. Create a file named `firebase-config.json` in the root of the project.
3. Paste the configuration matching the structure:
   ```json
   {
     "apiKey": "YOUR_API_KEY",
     "authDomain": "YOUR_PROJECT_ID.firebaseapp.com",
     "projectId": "YOUR_PROJECT_ID",
     "storageBucket": "YOUR_PROJECT_ID.appspot.com",
     "messagingSenderId": "YOUR_MESSAGING_SENDER_ID",
     "appId": "YOUR_APP_ID"
   }
   ```

### Step 5.3: Deploy Hosting
1. Install the global Firebase CLI:
   ```bash
   npm install -g firebase-tools
   ```
2. Log in and initialize:
   ```bash
   firebase login
   firebase init hosting
   ```
   * Choose your Firebase project.
   * Select `.` (root directory) as your public directory.
   * Configure as a single-page app (rewrite all URLs to `/index.html`): **Yes**.
   * File index.html already exists. Overwrite? **No**.
3. Deploy the application:
   ```bash
   firebase deploy --only hosting
   ```

---

## 🤖 6. Android APK Build Guide (Capacitor Mobile Native)

To package the EcoShare web application into native Android binaries:

### Prerequisites
* **Android SDK & Command Line Tools**
* **Java Development Kit (JDK 17 or higher)**
  * *Build configuration maps to the Android Studio embedded JDK at:*
    `C:\Program Files\Android\Android Studio\jbr`

### Step 6.1: Initialize and Add Android
1. Build and copy web assets to the `www/` folder:
   ```bash
   npm run build
   ```
2. Add the Capacitor Android container:
   ```bash
   npx cap add android
   ```
3. Sync web assets:
   ```bash
   npx cap sync android
   ```

### Step 6.2: Build Android Targets
Navigate to the `android/` directory and build:
* **To compile a Release APK**:
  * Set `JAVA_HOME` to Android Studio JBR and run:
    ```bash
    cd android
    cmd.exe /c "set JAVA_HOME=C:\Program Files\Android\Android Studio\jbr&& gradlew.bat assembleRelease"
    ```
  * **Output APK path**:
    `android/app/build/outputs/apk/release/app-release-unsigned.apk`
* **To compile a Google Play App Bundle (AAB)**:
  * Set `JAVA_HOME` to Android Studio JBR and run:
    ```bash
    cmd.exe /c "set JAVA_HOME=C:\Program Files\Android\Android Studio\jbr&& gradlew.bat bundleRelease"
    ```
  * **Output AAB path**:
    `android/app/build/outputs/bundle/release/app-release.aab`
