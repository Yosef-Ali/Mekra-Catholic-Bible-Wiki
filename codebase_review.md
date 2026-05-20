# Codebase Review: Fana Catholic Bible

## Overview
This document outlines the findings from a review of the Fana Catholic Bible application. The application is a React-based PWA that uses Google's Gemini API to provide daily devotions, Bible reading, and a spiritual chat assistant.

## Critical Findings

### 1. Security: API Key Exposure
- **Severity**: **CRITICAL**
- **Location**: `services/geminiService.ts`
- **Issue**: The Google Gemini API key is accessed via `process.env.API_KEY` directly in the frontend code.
- **Risk**: If this application is deployed, the API key will be visible in the browser's network traffic and bundled code. Malicious users could steal this key and use your quota.
- **Recommendation**: Move all AI interactions to a backend service (e.g., Vercel Edge Functions, Netlify Functions, or a dedicated Node.js server). The frontend should call your backend, which then calls Gemini using the secret key.

### 2. Data Integrity: AI-Generated Liturgy
- **Severity**: **HIGH**
- **Location**: `services/geminiService.ts` (`getDailyMassReadings`)
- **Issue**: The application asks the AI to "Find the official Catholic Daily Mass Readings".
- **Risk**: LLMs (Large Language Models) are prone to "hallucination". They might generate plausible-sounding but incorrect readings for a specific date. For a religious application, accuracy is paramount.
- **Recommendation**: Integrate a reliable liturgical API (e.g., USCCB, Universalis, or a dedicated Catholic API) to fetch the correct references (Book/Chapter/Verse). Use the AI *only* to generate the reflection/homily based on those verified texts.

### 3. Architecture: "God Components"
- **Severity**: **MEDIUM**
- **Location**: `components/ChatAssistant.tsx`, `components/BibleReader.tsx`
- **Issue**: These components are very large (400-600+ lines) and handle too many responsibilities (UI rendering, state management, API calls, event handling).
- **Risk**: This makes the code hard to maintain, test, and debug.
- **Recommendation**: Refactor these into smaller, focused components.
    - **ChatAssistant**: Split into `ChatSidebar`, `ChatInput`, `MessageList`, `ProfileModal`.
    - **BibleReader**: Split into `BibleNavigation`, `TextDisplay`, `SettingsPanel`.

### 4. Data Persistence: LocalStorage
- **Severity**: **MEDIUM**
- **Location**: `services/storageService.ts`
- **Issue**: User data (bookmarks, chat history, profile) is stored solely in `localStorage`.
- **Risk**: Data is lost if the user clears their browser cache or switches devices. It is also synchronous, which could block the UI if data grows large.
- **Recommendation**: Plan for a cloud-based database (Firebase, Supabase, or SQL) for user accounts in the future.

## Code Quality & Best Practices

- **TypeScript**: The project uses TypeScript well, with defined interfaces in `types.ts`.
- **Styling**: Tailwind CSS is used effectively for responsive design.
- **UI/UX**: The design seems premium with animations (`animate-in`), glassmorphism (`backdrop-blur`), and thoughtful typography (serif fonts for reading).
- **Accessibility**:
    - Voice input uses `webkitSpeechRecognition`, which is not supported in Firefox or standard Safari. Consider a polyfill or a library like `react-speech-recognition`.
    - Good use of semantic HTML in some places, but could be improved (e.g., more `aria-labels` for icon-only buttons).

## Next Steps
1.  **Immediate**: Secure the API Key by creating a proxy endpoint.
2.  **Short-term**: Refactor `ChatAssistant.tsx` to improve maintainability.
3.  **Medium-term**: Replace AI-generated readings with a structured API source.

