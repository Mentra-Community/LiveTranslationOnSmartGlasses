<p align="center">
  <img src="https://imagedelivery.net/nrc8B2Lk8UIoyW7fY8uHVg/b5891997-3e90-4bdc-398a-834e3318b900/square" alt="Mentra Translate" width="120" height="120" />
</p>

<h1 align="center">Live Translation</h1>

<p align="center">
  <strong>Real-time speech translation for smart glasses</strong>
</p>

<p align="center">
  Hear a language. See the translation on your display.<br/>
  100+ languages. Zero interruptions.
</p>

<p align="center">
  <a href="https://apps.mentra.glass/package/com.mentra.translation">Install from Mentra MiniApp Store</a>
</p>

---

## What It Does

Live Translation captures speech through your smart glasses microphone, transcribes it in real time, and displays translated text on your HUD — all without lifting a finger.

- **Real-time translation** — Transcribes and translates speech as it happens
- **100+ languages** — Supports a wide range of source and target languages
- **Intelligent display** — Confidence-based filtering prevents flickering mid-word corrections
- **Adaptive layout** — Text wrapping and formatting tuned for AR displays
- **Auto-clear** — Display clears after 40 seconds of silence

## Getting Started

### Prerequisites

1. Install MentraOS: [get.mentraglass.com](https://get.mentraglass.com)
2. Install Bun: [bun.sh](https://bun.sh/docs/installation)
3. Set up ngrok: `brew install ngrok` and create a [static URL](https://dashboard.ngrok.com/)

### Register Your App

1. Go to [console.mentra.glass](https://console.mentra.glass/)
2. Sign in and click "Create App"
3. Set a unique package name (e.g., `com.yourName.translation`)
4. Enter your ngrok URL as "Public URL"
5. Add **microphone** permission

### Run It

```bash
# Install
git clone <repo-url>
cd LiveTranslationOnSmartGlasses
bun install
cp .env.example .env

# Configure .env with your credentials
# API_KEY (required)

# Start
bun run dev

# Expose via ngrok
ngrok http --url=<YOUR_NGROK_URL> 80
```

## Documentation

- [MentraOS Docs](https://docs.mentra.glass)
- [Developer Console](https://console.mentra.glass)

## License

MIT
