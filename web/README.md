<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1t6TaE_bFqYgQpTJ9d_6MpW3e_zrnurOQ

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Environment variables

Set these in `web/.env` for local development and in the Vercel project for production. None of them is ever sent to the browser.

| Variable | Needed for |
|---|---|
| `DATABASE_URL` | Everything that reads the Bible, wiki or readings (Neon). |
| `GEMINI_API_KEY` | AI features on the server: chat fallback, the daily-Mass reflection, the readings fallback. |
| `ADMIN_TOKEN` | **Editing.** A long random passphrase. Any request that changes data — saving a chapter, saving the day's readings — must carry it. If it is unset, editing is refused everywhere; that is deliberate. |

To edit content, open Settings → Content Editor and enter the passphrase once on that device.

Generate a passphrase with `openssl rand -base64 32`.
