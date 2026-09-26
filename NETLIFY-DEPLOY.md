# Deploying LearnHub to Netlify

Because LearnHub is a client-side React + Vite application talking to Appwrite Cloud, Netlify is an ideal host: it is free, fast, and provides instant SSL.

Two deployment methods are supported below:
- **Method 1 (Fastest — 2 minutes, No Git required)**: Build locally and drag-and-drop into Netlify.
- **Method 2 (Continuous Deployment)**: Connect Netlify to your GitHub repository so it deploys automatically on every push.

---

## ⚠️ Critical: Configure Appwrite Platform First

Appwrite has built-in CORS protection. Before requests will work from Netlify, Appwrite needs to know your Netlify domain.

1. Open your project on **[cloud.appwrite.io](https://cloud.appwrite.io)**.
2. In the left sidebar, click **Overview**.
3. Scroll down to **Platforms** and click **Add Platform** -> **Web**.
4. Set:
   - **Name**: `Netlify Production`
   - **Hostname**: `*` *(for initial setup, or your exact Netlify domain e.g. `your-site.netlify.app`)*
5. Click **Next** / **Create**.

---

## Method 1: Drag & Drop (Fastest — 2 Minutes)

### Step 1: Ensure your `.env` has your Appwrite details
In `C:\Users\SCONIBRAND\Desktop\learnhub-appwrite\.env`:

```env
VITE_APPWRITE_ENDPOINT=https://<your-region>.cloud.appwrite.io/v1
VITE_APPWRITE_PROJECT_ID=your_actual_project_id
VITE_DEMO_MODE=false
VITE_APP_NAME=LearnHub
```

### Step 2: Build the production bundle
In your PowerShell terminal:

```powershell
npm run build
```

This creates a self-contained `dist\` directory containing your compiled JavaScript, CSS, and routing rules (`_redirects`).

### Step 3: Upload to Netlify
1. Go to **[app.netlify.com/drop](https://app.netlify.com/drop)** in your browser (log in if asked).
2. Open Windows File Explorer and navigate to:
   `C:\Users\SCONIBRAND\Desktop\learnhub-appwrite`
3. Drag the **`dist`** folder and drop it into the upload box on Netlify.
4. Netlify will publish your site in about 5 seconds and give you a live URL like:
   `https://clever-darwin-123456.netlify.app`

### Step 4: Add your live domain to Appwrite
Copy that `something.netlify.app` URL and add it to your Appwrite Web Platforms (as shown in the Critical section above).

---

## Method 2: Git / GitHub (Continuous Deployment)

If you have your project pushed to GitHub:

### Step 1: Push code to GitHub
```bash
git init
git add .
git commit -m "LearnHub Appwrite React Portal"
git remote add origin https://github.com/your-username/learnhub.git
git push -u origin main
```

### Step 2: Connect to Netlify
1. Log in to [app.netlify.com](https://app.netlify.com).
2. Click **Add new site** -> **Import an existing project**.
3. Choose **GitHub** and select your `learnhub` repository.
4. Netlify will automatically detect:
   - **Build command**: `npm run build`
   - **Publish directory**: `dist`

### Step 3: Add Environment Variables in Netlify
Before clicking Deploy, click **Environment variables** (or go to **Site settings** -> **Environment variables**):
- `VITE_APPWRITE_ENDPOINT`: `https://<your-region>.cloud.appwrite.io/v1`
- `VITE_APPWRITE_PROJECT_ID`: `your_appwrite_project_id`
- `VITE_DEMO_MODE`: `false`
- `VITE_APP_NAME`: `LearnHub`

### Step 4: Click Deploy Site
Netlify will build and deploy the app. Whenever you push changes to GitHub, Netlify updates the live site automatically.

---

## ℹ️ SPA Routing Notice
Netlify needs a rewrite rule so that direct URLs like `/courses/web-dev/classes` or refreshing the browser doesn't return 404. 

This has already been preconfigured for you:
- `netlify.toml` in the project root
- `public/_redirects`
Both redirect all traffic to `/index.html` with HTTP 200, so React Router works smoothly on every sub-route.
