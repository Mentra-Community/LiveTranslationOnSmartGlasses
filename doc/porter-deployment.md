

## 🛠️ Development & Production Setup (WebView)

### 1. Environment Files

Make sure you have the following environment files in your project root:

```
.env.development
.env.production
```

### 2. Development Configuration

In `.env.development`, set the API URL to your **ngrok server**:

```env
VITE_API_URL=https://<your-ngrok-server>.ngrok.io
```

> ⚠️ This allows your local WebView to connect to the backend running through ngrok.

### 3. Production Configuration

In `.env.production`, set the API URL to the **Porter server** endpoint:

```env
VITE_API_URL=https://<your-porter-server>.onporter.run
```

> ✅ This ensures the production build communicates with your deployed backend.

### 4. Build Notes

* Run `npm run dev` (or `yarn dev`) for local development.
* Run `npm run build` (or `yarn build`) for production deployment.

