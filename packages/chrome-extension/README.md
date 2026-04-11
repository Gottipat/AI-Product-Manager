# @meeting-ai/chrome-extension

Browser-based Google Meet capture for the AI Product Manager system.

## Purpose

This extension is the in-browser capture path for meetings when transcript
upload is not being used and the Playwright bot is not the right fit.

It is designed to:

- attach to a live Google Meet tab
- observe visible captions
- capture meeting audio
- upload meeting data into the backend
- trigger downstream MoM and item generation

## Current Status

What is working:

- extension installation and popup flow
- audio capture and upload
- meeting lifecycle integration with the backend
- processing-state visibility in the popup

What is still being improved:

- reliable multi-speaker transcript extraction
- stable speaker-attributed caption finalization across Google Meet DOM changes

This is why the main app labels the extension as `In Progress`.

## Architecture

```text
Google Meet tab
├── content script        observes caption DOM
├── popup UI              start/stop and status display
├── service worker        coordinates meeting lifecycle and uploads
└── offscreen recorder    captures and uploads audio
```

## How It Works

1. Open a Google Meet meeting in Chrome.
2. Start capture from the extension popup.
3. The extension records audio and observes captions.
4. On stop, it uploads the finalized meeting data to the backend.
5. The backend completes the meeting and triggers MoM and item extraction.

## Installation

1. Open `chrome://extensions`
2. Enable `Developer mode`
3. Click `Load unpacked`
4. Select `packages/chrome-extension`

## Runtime Requirements

- a running backend, usually at `http://localhost:3002`
- a signed-in web app session if the flow requires authenticated backend access
- visible Google Meet captions for transcript extraction

The easiest way to prepare the backend is:

```bash
cp .env.docker.example .env.docker
docker compose --env-file .env.docker up --build -d
```

## Recommended Usage

Use this package as an experimental/demo capture path.

For the strongest product demo today, prefer:

- transcript upload for reliable transcript quality

Use the extension when you specifically want to demonstrate:

- browser-based meeting capture
- audio upload
- live capture workflow

## Known Limitations

- caption DOM structure can change without warning
- Google Meet exposes captions as incremental UI chunks, not clean final
  utterances
- multi-person speaker attribution is still under active improvement

## Related Files

```text
src/background/   service worker and backend coordination
src/content/      caption observer injected into Meet
src/offscreen/    audio recording flow
src/popup/        popup controls and processing state UI
```

## Related Docs

- [../../README.md](../../README.md)
- [../../docs/PROJECT_STATUS.md](../../docs/PROJECT_STATUS.md)
- [../../docs/REVIEW_GUIDE.md](../../docs/REVIEW_GUIDE.md)
