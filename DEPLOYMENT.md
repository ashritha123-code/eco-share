# 🚀 EcoShare - Google Play Store & Cloud Deployment Guide

This document provides a step-by-step guide for developers and deployers to package, build, and publish the **EcoShare** Android Mobile App (`.aab` / `.apk`) to the **Google Play Store**, as well as hosting the Web Application.

---

## 🔑 1. Backend Cloud Architecture (Supabase)

EcoShare uses a live **Supabase PostgreSQL Cloud** backend:

* **Supabase API URL**: `https://rgyytihgpwbibnmbnkmo.supabase.co`
* **Publishable Anon Key**: `sb_publishable_OSfTdsS1P2bnJJ1oK2A3MQ_D7CQTXUL`
* **Configuration File**: [src/env-config.js](file:///c:/Users/pooji/.gemini/antigravity-ide/scratch/ecoshare/src/env-config.js)

> [!NOTE]
> The `SUPABASE_ANON_KEY` is a **public publishable client key** designed specifically to be bundled inside web and mobile client builds. Users downloading the app from the Google Play Store will automatically connect to the live cloud database without requiring any account credentials from the deployer.

---

## 🛡️ 2. Account Security & Team Access

* **Personal Passwords Not Required**: Deployers do **not** need the owner's personal Supabase account email or password to build and publish the app.
* **Inviting Collaborators (Optional)**: To grant developers access to inspect database tables or adjust security policies:
  1. Navigate to [Supabase Dashboard](https://supabase.com/dashboard).
  2. Go to **Project Settings > Team**.
  3. Click **Invite Member** and enter the developer's email address.

---

## 📱 3. Step-by-Step Android APK / Play Store Build Process

### Prerequisites
* **Node.js** & **npm** installed.
* **Android Studio** (latest version with Android SDK & Gradle).
* **Google Play Console Account** (for publishing).

---

### Step 1: Sync Frontend Assets with Capacitor
Run the following commands in the project root directory:

```bash
# Install dependencies (if not already installed)
npm install

# Copy frontend assets and sync plugins to Android native project
npx cap sync android
```

---

### Step 2: Open Android Studio
Launch Android Studio with the project context:

```bash
npx cap open android
```

---

### Step 3: Generate Signed Android App Bundle (`.aab`)
1. In Android Studio, select **Build > Generate Signed Bundle / APK...** from the top menu.
2. Select **Android App Bundle (`.aab`)** and click **Next**.
3. Create or select your production **Keystore File** (`.jks` / `.keystore`) and enter key credentials.
4. Select the **Release** build variant.
5. Click **Create**. Android Studio will generate the signed `.aab` file in `android/app/release/`.

---

### Step 4: Publish to Google Play Console
1. Log in to [Google Play Console](https://play.google.com/console).
2. Click **Create app** and set the title to **EcoShare**.
3. Fill in store listing metadata (Short Description, Full Description, Screenshots, Category, Privacy Policy URL).
4. Go to **Testing > Production** (or **Internal Testing**).
5. Upload the signed `.aab` bundle created in Step 3.
6. Review release notes and click **Save & Submit for Review**.

---

## 🌐 4. Web Application Hosting (Vercel / Netlify / Cloudflare Pages)

To host the web app version online:
1. Connect the repository to **Vercel**, **Netlify**, or **GitHub Pages**.
2. Build Settings:
   * **Build Command**: None (Static HTML/JS/CSS) or `npm run build`
   * **Output Directory**: `./` (Root directory containing `index.html`)

---

*Document created for EcoShare Google Play Store & Cloud Deployment.*
