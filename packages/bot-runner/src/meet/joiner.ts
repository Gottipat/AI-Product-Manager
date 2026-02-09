/**
 * @fileoverview Google Meet Joiner
 * @description Handles the meeting join flow: navigate, enter name, request to join, wait for admission
 */

import { Page } from 'playwright';
import { BOT_CONFIG, MEETING_CONFIG } from '@meeting-ai/shared';
import pino from 'pino';
import {
    humanType,
    humanClick,
    randomDelay,
    mediumDelay,
    simulateReading,
} from '../utils/human';

const logger = pino({ name: 'meet-joiner' });

/**
 * Google Meet DOM selectors
 * These may need updates if Google changes their UI
 */
const SELECTORS = {
    // Pre-join screen
    nameInput: 'input[aria-label="Your name"]',
    askToJoinButton: 'button:has-text("Ask to join")',
    joinNowButton: 'button:has-text("Join now")',

    // Waiting/lobby states
    waitingMessage: 'text=Asking to be let in',
    waitingForHost: 'text=waiting for someone',

    // In-meeting indicators
    meetingControls: '[data-panel-id="2"]',
    leaveButton: '[aria-label="Leave call"]',
    endCallButton: 'button[aria-label="Leave call"]',

    // Error states
    meetingEnded: 'text=This meeting has ended',
    cannotJoin: 'text=You can\'t join this video call',
    removed: 'text=You\'ve been removed',

    // Dialogs to dismiss (based on browser research)
    signInPopupGotIt: 'button:has-text("Got it")',
    permissionModalDismiss: 'button:has-text("Continue without microphone and camera")',
    dismissButton: 'button:has-text("Dismiss")',
} as const;

export interface JoinResult {
    success: boolean;
    state: 'joined' | 'waiting' | 'denied' | 'ended' | 'error';
    message: string;
}

export interface JoinerOptions {
    /** Bot display name to use */
    botName?: string | undefined;
    /** Timeout for join attempt in ms */
    joinTimeoutMs?: number | undefined;
    /** Whether to mute microphone on join */
    muteMicrophone?: boolean | undefined;
    /** Whether to turn off camera on join */
    turnOffCamera?: boolean | undefined;
}

/**
 * MeetJoiner handles the Google Meet join flow
 */
export class MeetJoiner {
    private page: Page;
    private options: Required<JoinerOptions>;

    constructor(page: Page, options: JoinerOptions = {}) {
        this.page = page;
        this.options = {
            botName: options.botName ?? BOT_CONFIG.DEFAULT_BOT_NAME,
            joinTimeoutMs: options.joinTimeoutMs ?? MEETING_CONFIG.BOT_JOIN_TIMEOUT_MS,
            muteMicrophone: options.muteMicrophone ?? true,
            turnOffCamera: options.turnOffCamera ?? true,
        };
    }

    /**
     * Join a Google Meet meeting
     */
    async join(meetLink: string): Promise<JoinResult> {
        logger.info({ meetLink, botName: this.options.botName }, 'Starting join flow');

        // Retry up to 3 times with page reload (simulates manual F5)
        const maxRetries = 3;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                if (attempt === 1) {
                    // First attempt: Navigate to the meeting URL
                    await this.page.goto(meetLink, {
                        waitUntil: 'load',
                        timeout: 30000
                    });
                    logger.info({ attempt }, 'Navigated to meeting page');
                } else {
                    // Subsequent attempts: Use F5-style reload (not about:blank navigation)
                    // This preserves the browser context and cache that manual F5 uses
                    logger.info({ attempt }, 'Reloading page (simulating F5)...');
                    await this.page.reload({
                        waitUntil: 'load',
                        timeout: 30000
                    });
                    logger.info({ attempt }, 'Page reloaded');
                }

                // Wait for network to settle - Meet loads resources progressively
                await this.page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {
                    logger.debug('Network did not fully idle, continuing anyway');
                });

                // Simulate human reading the page before interacting
                // This adds random delays and occasional mouse movements
                await simulateReading(this.page, attempt === 1 ? 3000 : 2000);

                // Check for "can't join" error before proceeding
                const cantJoinError = await this.page.locator('text=You can\'t join this video call').isVisible({ timeout: 2000 }).catch(() => false);
                if (cantJoinError) {
                    logger.warn({ attempt }, 'Detected "can\'t join" error, will retry with reload');
                    if (attempt < maxRetries) {
                        continue; // Go to next attempt with reload
                    }
                }

                // Wait for page to load and handle any initial dialogs
                await this.dismissDialogs();

                // Small pause after dismissing dialogs
                await randomDelay(500, 1500);

                // Turn off camera and microphone before joining
                await this.muteMediaDevices();

                // Another small pause
                await randomDelay(500, 1000);

                // Enter bot name
                await this.enterName();

                // Click join button
                await this.clickJoinButton();

                // Wait for admission or timeout
                const result = await this.waitForAdmission();

                // If successful or explicitly denied, return immediately
                if (result.success || result.state === 'denied' || result.state === 'ended') {
                    return result;
                }

                // If error/waiting, we might retry
                if (attempt < maxRetries) {
                    logger.warn({ attempt, state: result.state }, 'Join attempt failed, will retry');
                }
            } catch (error) {
                const message = error instanceof Error ? error.message : 'Unknown join error';
                logger.error({ error, attempt }, 'Join flow failed');

                // Capture debug info on failure
                await this.logPageDebugInfo();

                if (attempt >= maxRetries) {
                    return {
                        success: false,
                        state: 'error',
                        message,
                    };
                }
                // Continue to next attempt (will navigate away first)
            }
        }

        // Should not reach here, but just in case
        return {
            success: false,
            state: 'error',
            message: 'Max retries exceeded',
        };
    }

    private async logPageDebugInfo(): Promise<void> {
        try {
            const title = await this.page.title();
            const url = this.page.url();
            // Get a snippet of the body text safely
            const bodyText = await this.page.evaluate(() => {
                return document.body ? document.body.innerText.substring(0, 500) : 'No body content';
            });
            logger.error({ title, url, bodyText }, 'Debug: Page state at failure');
        } catch (e) {
            logger.error('Failed to capture debug info');
        }
    }

    /**
     * Dismiss any popup dialogs that might appear
     * Based on browser research: sign-in popup (top-right) and permission modal
     */
    private async dismissDialogs(): Promise<void> {
        try {
            // Wait a bit for dialogs to appear
            await this.page.waitForTimeout(1500);

            // 1. Dismiss sign-in popup ("Got it" button in top-right corner)
            const signInPopup = this.page.locator(SELECTORS.signInPopupGotIt).first();
            if (await signInPopup.isVisible({ timeout: 2000 }).catch(() => false)) {
                await signInPopup.click();
                logger.info('Dismissed sign-in popup (Got it)');
                await this.page.waitForTimeout(500);
            }

            // 2. Dismiss permission modal ("Continue without microphone and camera")
            const permissionModal = this.page.locator(SELECTORS.permissionModalDismiss).first();
            if (await permissionModal.isVisible({ timeout: 2000 }).catch(() => false)) {
                await permissionModal.click();
                logger.info('Dismissed permission modal');
                await this.page.waitForTimeout(500);
            }

            // 3. Try generic dismiss button if present
            const dismissButton = this.page.locator(SELECTORS.dismissButton).first();
            if (await dismissButton.isVisible({ timeout: 1000 }).catch(() => false)) {
                await dismissButton.click();
                logger.debug('Dismissed dialog');
            }
        } catch {
            // Dialogs are optional, ignore errors
            logger.debug('No dialogs to dismiss or error dismissing');
        }
    }

    /**
     * Mute microphone and camera before joining
     */
    private async muteMediaDevices(): Promise<void> {
        try {
            if (this.options.muteMicrophone) {
                const micButton = this.page.locator('[aria-label*="microphone"]').first();
                if (await micButton.isVisible({ timeout: 3000 }).catch(() => false)) {
                    // Check if mic is on (aria-label usually contains "Turn off")
                    const label = await micButton.getAttribute('aria-label');
                    if (label?.includes('Turn off')) {
                        await micButton.click();
                        logger.debug('Muted microphone');
                    }
                }
            }

            if (this.options.turnOffCamera) {
                const camButton = this.page.locator('[aria-label*="camera"]').first();
                if (await camButton.isVisible({ timeout: 3000 }).catch(() => false)) {
                    const label = await camButton.getAttribute('aria-label');
                    if (label?.includes('Turn off')) {
                        await camButton.click();
                        logger.debug('Turned off camera');
                    }
                }
            }
        } catch (error) {
            logger.warn({ error }, 'Could not mute media devices, continuing anyway');
        }
    }

    /**
     * Enter the bot's display name with human-like typing
     */
    private async enterName(): Promise<void> {
        logger.debug({ botName: this.options.botName }, 'Entering bot name');

        try {
            // Wait for name input to appear
            const nameInput = this.page.locator(SELECTORS.nameInput);
            await nameInput.waitFor({ timeout: 10000 });

            // Simulate reading the page before acting
            await mediumDelay();

            // Clear existing name and type bot name like a human
            const botName = this.options.botName ?? BOT_CONFIG.DEFAULT_BOT_NAME;
            await humanType(this.page, nameInput, botName);

            logger.info({ botName: this.options.botName }, 'Entered bot name');
        } catch (error) {
            logger.warn({ error }, 'Name input not found, may already be set or not required');
        }
    }

    /**
     * Click the join/ask to join button with human-like behavior
     * IMPORTANT: Button is DISABLED until name is entered!
     */
    private async clickJoinButton(): Promise<void> {
        logger.debug('Looking for join button');

        // Primary selectors in order of preference
        const joinSelectors = [
            SELECTORS.askToJoinButton,  // 'button:has-text("Ask to join")'
            SELECTORS.joinNowButton,    // 'button:has-text("Join now")'
        ];

        for (const selector of joinSelectors) {
            try {
                const button = this.page.locator(selector).first();

                // Check if button exists and is visible
                if (await button.isVisible({ timeout: 2000 }).catch(() => false)) {
                    // CRITICAL: Wait for button to be ENABLED (not disabled)
                    // The button starts disabled and only enables after name is entered
                    logger.debug({ selector }, 'Found join button, waiting for it to be enabled...');

                    // Wait up to 5 seconds for the button to become enabled
                    const startWait = Date.now();
                    while (Date.now() - startWait < 5000) {
                        const isDisabled = await button.isDisabled().catch(() => true);
                        if (!isDisabled) {
                            logger.info({ selector }, 'Join button is enabled, clicking...');

                            // Use human-like click with mouse movement
                            await humanClick(this.page, button);
                            return;
                        }
                        await randomDelay(200, 400);
                    }

                    // If still disabled after 5s, try clicking anyway
                    logger.warn({ selector }, 'Button still appears disabled, attempting click anyway...');
                    await humanClick(this.page, button);
                    return;
                }
            } catch (error) {
                logger.debug({ selector, error }, 'Selector failed, trying next');
            }
        }

        throw new Error('Could not find join button');
    }

    /**
     * Wait for admission to the meeting
     */
    private async waitForAdmission(): Promise<JoinResult> {
        logger.info({ timeoutMs: this.options.joinTimeoutMs }, 'Waiting for admission');

        const startTime = Date.now();
        const checkInterval = 2000; // Check every 2 seconds

        while (Date.now() - startTime < (this.options.joinTimeoutMs ?? MEETING_CONFIG.BOT_JOIN_TIMEOUT_MS)) {
            // Check if we're in the meeting
            if (await this.isInMeeting()) {
                logger.info('Successfully joined meeting');
                return {
                    success: true,
                    state: 'joined',
                    message: 'Successfully joined the meeting',
                };
            }

            // Check for error states
            const errorResult = await this.checkForErrors();
            if (errorResult) {
                return errorResult;
            }

            // Check if still waiting
            const isWaiting = await this.page
                .locator(SELECTORS.waitingMessage)
                .isVisible({ timeout: 500 })
                .catch(() => false);

            if (isWaiting) {
                logger.debug('Still waiting for admission...');
            }

            await this.page.waitForTimeout(checkInterval);
        }

        logger.warn('Join timeout reached');
        return {
            success: false,
            state: 'waiting',
            message: 'Timeout waiting for admission',
        };
    }

    /**
     * Check if we're in the meeting
     */
    private async isInMeeting(): Promise<boolean> {
        try {
            // Look for meeting controls (indicates we're in the meeting)
            const leaveButton = this.page.locator(SELECTORS.leaveButton);
            return await leaveButton.isVisible({ timeout: 500 }).catch(() => false);
        } catch {
            return false;
        }
    }

    /**
     * Check for error states
     */
    private async checkForErrors(): Promise<JoinResult | null> {
        // Check if meeting ended
        if (await this.page.locator(SELECTORS.meetingEnded).isVisible({ timeout: 500 }).catch(() => false)) {
            return {
                success: false,
                state: 'ended',
                message: 'Meeting has ended',
            };
        }

        // Check if denied
        if (await this.page.locator(SELECTORS.cannotJoin).isVisible({ timeout: 500 }).catch(() => false)) {
            return {
                success: false,
                state: 'denied',
                message: 'Cannot join this meeting',
            };
        }

        // Check if removed
        if (await this.page.locator(SELECTORS.removed).isVisible({ timeout: 500 }).catch(() => false)) {
            return {
                success: false,
                state: 'denied',
                message: 'Removed from meeting',
            };
        }

        return null;
    }

    /**
     * Leave the current meeting
     */
    async leave(): Promise<void> {
        logger.info('Leaving meeting');

        try {
            const leaveButton = this.page.locator(SELECTORS.leaveButton);
            if (await leaveButton.isVisible({ timeout: 2000 }).catch(() => false)) {
                await leaveButton.click();
                logger.info('Left meeting');
            }
        } catch (error) {
            logger.warn({ error }, 'Could not click leave button');
        }
    }
}
