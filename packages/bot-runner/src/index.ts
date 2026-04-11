/**
 * @fileoverview Bot Runner Entry Point
 * @description Playwright-based bot for joining Google Meet and streaming captions
 *
 * Flow:
 * 1. Connect to AI Backend (health check)
 * 2. Create meeting in backend
 * 3. Launch browser with stealth
 * 4. (Optional) Google Auth
 * 5. Join Google Meet
 * 6. Enable captions
 * 7. Parse captions → buffer → stream to backend
 * 8. On meeting end: trigger MoM generation
 * 9. Clean up
 */

import 'dotenv/config';
import { BOT_CONFIG } from '@meeting-ai/shared';
import pino from 'pino';

import { BackendClient } from './api/index.js';
import { AuthManager } from './auth/index.js';
import { BrowserLauncher } from './browser/index.js';
import { CaptionParser, TranscriptBuffer } from './captions/index.js';
import {
  MeetJoiner,
  CaptionsController,
  ParticipantTracker,
  AudioCaptureController,
} from './meet/index.js';

const logger = pino({
  name: 'bot-runner',
  level: process.env.LOG_LEVEL || 'info',
});

// Environment configuration
const config = {
  aiBackendUrl: process.env.AI_BACKEND_URL || 'http://localhost:3001',
  botDisplayName: process.env.BOT_DISPLAY_NAME || BOT_CONFIG.DEFAULT_BOT_NAME,
  headless: process.env.HEADLESS === 'true',
  meetLink: process.env.MEET_LINK,
  googleEmail: process.env.GOOGLE_EMAIL,
  googlePassword: process.env.GOOGLE_PASSWORD,
  userDataDir: process.env.USER_DATA_DIR,
};

/**
 * Main entry point for the bot runner
 */
export async function main(): Promise<void> {
  logger.info('═══════════════════════════════════════');
  logger.info('  Meeting AI Bot Runner Starting...');
  logger.info('═══════════════════════════════════════');

  // ─── Validate config ─────────────────────────────────────
  if (!config.meetLink) {
    logger.error('MEET_LINK environment variable is required');
    process.exit(1);
  }

  logger.info(
    {
      meetLink: config.meetLink,
      botName: config.botDisplayName,
      backendUrl: config.aiBackendUrl,
      headless: config.headless,
    },
    'Configuration loaded'
  );

  // ─── Step 1: Connect to AI Backend ───────────────────────
  const backend = new BackendClient({ baseUrl: config.aiBackendUrl });

  logger.info('Checking AI Backend connection...');
  const backendHealthy = await backend.healthCheck();
  if (!backendHealthy) {
    logger.error('AI Backend is not reachable. Start it first.');
    process.exit(1);
  }
  logger.info('✅ AI Backend connected');

  // ─── Step 2: Create meeting in backend ───────────────────
  const meetTitle = `Meeting ${new Date().toISOString().slice(0, 16)}`;
  const { meeting } = await backend.createMeeting(meetTitle, config.meetLink);
  const meetingId = meeting.id;
  logger.info({ meetingId, title: meetTitle }, '✅ Meeting created in backend');

  // ─── Step 3: Launch browser & Join (with retries) ────
  const maxGlobalRetries = 3;
  let joinSuccessful = false;
  let launcher: BrowserLauncher;
  let page;

  // We use a dummy initialization here because TS doesn't know it'll be set in the loop
  launcher = new BrowserLauncher({
    headless: config.headless,
    userDataDir: config.userDataDir,
  });
  let isLauncherActive = false;

  for (let attempt = 1; attempt <= maxGlobalRetries; attempt++) {
    logger.info({ attempt, maxRetries: maxGlobalRetries }, 'Starting browser and join flow');

    try {
      launcher = new BrowserLauncher({
        headless: config.headless,
        userDataDir: config.userDataDir,
      });
      const context = await launcher.launch();
      isLauncherActive = true;
      page = await context.newPage();
      logger.info('✅ Browser launched');

      // ─── Inject audio capture hooks BEFORE navigation ─────
      const audioCapture = new AudioCaptureController();
      await audioCapture.injectAudioHooks(page);
      await audioCapture.setupChunkReceiver(page);
      logger.info('✅ Audio capture hooks injected');

      // ─── Step 4: Google Auth (if credentials provided) ───
      if (config.googleEmail && config.googlePassword) {
        logger.info('Authenticating with Google...');
        await backend.updateMeetingStatus(meetingId, 'bot_joining');
        const authManager = new AuthManager(page);
        const authSuccess = await authManager.login(config.googleEmail, config.googlePassword);
        if (authSuccess) {
          logger.info('✅ Google authentication successful');
        } else {
          logger.warn('Google auth failed, continuing as guest');
        }
      }

      // ─── Step 5: Join the meeting ────────────────────────
      logger.info('Joining meeting...');
      await backend.updateMeetingStatus(meetingId, 'bot_joining');
      const joiner = new MeetJoiner(page, { botName: config.botDisplayName });
      const joinResult = await joiner.join(config.meetLink);

      if (!joinResult.success) {
        logger.error({ result: joinResult }, `Failed to join meeting on attempt ${attempt}`);
        await launcher.close();
        isLauncherActive = false;

        if (attempt < maxGlobalRetries) {
          logger.info('Waiting 5s before next retry...');
          await new Promise((r) => setTimeout(r, 5000));
          continue; // Try again
        } else {
          await backend.updateMeetingStatus(meetingId, 'error');
          return; // Give up
        }
      }

      logger.info({ state: joinResult.state }, '✅ Joined meeting');
      joinSuccessful = true;
      break; // Success, exit retry loop
    } catch (error) {
      logger.error({ error }, `Error during join attempt ${attempt}`);
      if (isLauncherActive && launcher) {
        await launcher.close();
        isLauncherActive = false;
      }

      if (attempt < maxGlobalRetries) {
        logger.info('Waiting 5s before next retry...');
        await new Promise((r) => setTimeout(r, 5000));
      } else {
        await backend.updateMeetingStatus(meetingId, 'error');
        return;
      }
    }
  }

  if (!joinSuccessful || !page || !launcher) {
    return;
  }

  // Create a shared AudioCaptureController reference for use inside the try block
  const audioCapture = new AudioCaptureController();
  // Re-inject hooks since the controller is recreated
  // (the addInitScript persists on the page from the earlier injection)
  audioCapture['page'] = page;
  audioCapture['hooksInjected'] = true;
  audioCapture['exposedFunctionSetup'] = true;

  try {
    // Mark meeting as in progress
    await backend.startMeeting(meetingId);
    await backend.addParticipant(meetingId, config.botDisplayName, true);

    // ─── Step 6a: Start audio capture & streaming ─────────
    logger.info('Starting audio capture...');
    let audioWs: import('ws').WebSocket | null = null;
    try {
      audioWs = await backend.connectAudioStream(meetingId);

      // Wire: audio chunk → send to backend via WebSocket
      audioCapture.onChunk((chunk) => {
        if (audioWs && audioWs.readyState === audioWs.OPEN) {
          audioWs.send(chunk);
        }
      });

      await audioCapture.startRecording();
      logger.info('✅ Audio capture pipeline active');
    } catch (error) {
      logger.warn({ error }, 'Audio capture setup failed — falling back to captions only');
    }

    // ─── Step 6: Enable captions ─────────────────────────
    const captionsCtrl = new CaptionsController(page);
    const captionsEnabled = await captionsCtrl.enable();
    if (!captionsEnabled) {
      logger.warn('Could not enable captions, will try polling');
    } else {
      logger.info('✅ Captions enabled');
    }

    // ─── Step 7: Start caption parsing + streaming ───────
    const parser = new CaptionParser(page);
    const buffer = new TranscriptBuffer({
      meetingId,
      maxEventsPerBatch: 20,
      flushIntervalMs: 5000,
    });
    const participantTracker = new ParticipantTracker(page, config.botDisplayName);

    // Wire: buffer flush → send to backend
    buffer.onBatch(async (batch) => {
      try {
        const payload = {
          events: batch.events.map((e) => ({
            speaker: e.speaker,
            content: e.text,
            sequenceNumber: e.sequenceNumber,
            ...(e.speakerId ? { speakerId: e.speakerId } : {}),
            isFinal: e.isFinal,
            capturedAt: e.timestamp,
          })),
        };
        const result = await backend.sendTranscriptBatch(meetingId, payload);
        logger.info(
          { batchNumber: batch.batchNumber, inserted: result.inserted },
          'Transcript batch sent to backend'
        );
      } catch (error) {
        logger.error({ error, batchNumber: batch.batchNumber }, 'Failed to send batch');
      }
    });

    // Wire: caption parsed → add to buffer
    parser.onCaption((caption) => {
      buffer.addCaption(caption);
    });

    // Start parsing and buffering
    await parser.startObserving();
    buffer.start();
    await participantTracker.startTracking();

    logger.info('═══════════════════════════════════════');
    logger.info('  📝 Recording meeting transcripts...');
    logger.info('  Press Ctrl+C to stop');
    logger.info('═══════════════════════════════════════');

    // ─── Step 8: Wait for meeting to end ─────────────────
    // Poll for meeting end (kicked out, meeting ended, etc.)
    let meetingActive = true;
    while (meetingActive) {
      await page.waitForTimeout(5000);

      // Check if page is still on a Meet URL
      const currentUrl = page.url();
      if (!currentUrl.includes('meet.google.com')) {
        logger.info('No longer on Google Meet page');
        meetingActive = false;
        continue;
      }

      // Check for "you've been removed" or "meeting ended" indicators
      const meetingEndedText = await page
        .locator('text="You\'ve been removed"')
        .isVisible({ timeout: 1000 })
        .catch(() => false);
      const returnToHome = await page
        .locator('text="Return to home screen"')
        .isVisible({ timeout: 1000 })
        .catch(() => false);

      if (meetingEndedText || returnToHome) {
        logger.info('Meeting ended or bot was removed');
        meetingActive = false;
      }
    }

    // ─── Step 9: Post-meeting processing ─────────────────
    logger.info('Meeting ended. Processing...');

    // Stop audio capture
    await audioCapture.stopRecording();
    const audioStats = audioCapture.getStats();
    logger.info(audioStats, 'Audio capture stats');

    // Close audio WebSocket
    if (audioWs && audioWs.readyState === audioWs.OPEN) {
      audioWs.close();
    }

    // Stop caption capture
    buffer.stop();
    await parser.stopObserving();

    const stats = buffer.getStats();
    logger.info(stats, 'Transcript capture stats');

    // Complete meeting
    await backend.completeMeeting(meetingId);
    logger.info('✅ Meeting marked as complete');

    // Trigger AI processing
    logger.info('Triggering MoM generation...');
    try {
      await backend.generateMoM(meetingId);
      logger.info('✅ MoM generation triggered');
    } catch (error) {
      logger.warn({ error }, 'MoM generation failed (may need more transcript data)');
    }

    try {
      await backend.extractItems(meetingId);
      logger.info('✅ Action item extraction triggered');
    } catch (error) {
      logger.warn({ error }, 'Action item extraction failed');
    }
  } finally {
    // ─── Cleanup ─────────────────────────────────────────
    logger.info('Cleaning up...');
    await launcher.close();
    logger.info('✅ Bot runner shutdown complete');
  }
}

// Export modules for external use
export * from './browser/index.js';
export * from './meet/index.js';
export * from './captions/index.js';
export * from './api/index.js';

// Graceful shutdown
process.on('SIGINT', () => {
  logger.info('Received SIGINT, shutting down...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('Received SIGTERM, shutting down...');
  process.exit(0);
});

// Run if this is the entry point
main().catch((error) => {
  logger.error({ error }, 'Fatal error');
  process.exit(1);
});
