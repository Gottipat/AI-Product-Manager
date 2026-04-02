# Meeting AI — Chrome Extension

> Capture Google Meet transcripts directly from your browser tab

## Overview

This Chrome extension serves as a **fallback** to the bot-runner approach. When the bot can't join a meeting (e.g., restricted access), users can capture transcripts directly from their browser using this extension.

## How It Works

1. **Content Script** — Injects into Google Meet pages and observes the live captions DOM using MutationObserver (same selectors as `bot-runner`)
2. **Background Service Worker** — Manages the meeting lifecycle and streams transcript batches to the AI backend
3. **Popup UI** — Controls for starting/stopping capture, backend configuration, and live stats

## Installation (Development)

1. Open Chrome and go to `chrome://extensions/`
2. Enable **Developer Mode** (toggle in top-right)
3. Click **"Load unpacked"**
4. Select the `packages/chrome-extension` directory

## Usage

1. Open a Google Meet meeting in Chrome
2. Click the Meeting AI extension icon in the toolbar
3. Configure backend URL if needed (defaults to `http://localhost:3002`)
4. Click **"Start Capture"**
5. The extension will auto-enable captions and begin streaming transcripts
6. Click **"Stop Capture"** when done — MoM generation will be triggered automatically

## Architecture

```
Google Meet Tab                    Extension Background              AI Backend
┌──────────────┐                 ┌──────────────────┐           ┌─────────────┐
│ Content      │  chrome.runtime │ Service Worker   │   HTTP    │ Fastify     │
│ Script       │ ──────────────> │                  │ ────────> │ Server      │
│ (caption     │   sendMessage   │ - Meeting CRUD   │  /api/v1  │             │
│  observer)   │                 │ - Batch buffer   │           │ - Meetings  │
│              │                 │ - API client     │           │ - Transcr.  │
└──────────────┘                 └──────────────────┘           │ - MoM       │
                                        ↕                       └─────────────┘
                                 ┌──────────────────┐
                                 │ Popup UI         │
                                 │ - Start/Stop     │
                                 │ - Live stats     │
                                 │ - Settings       │
                                 └──────────────────┘
```
