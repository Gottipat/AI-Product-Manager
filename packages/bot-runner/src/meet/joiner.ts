/**
 * @fileoverview Google Meet Joiner
 * @description Handles the meeting join flow: navigate, enter name, request to join, wait for admission
 */

import { Page } from 'playwright';
import { BOT_CONFIG, MEETING_CONFIG } from '@meeting-ai/shared';
import pino from 'pino';

const logger = pino({ name: 'meet-joiner' });

/**
 * Google Meet DOM selectors
 * These may need updates if Google changes their UI
 */
const SELECTORS = {
    // Pre-join screen
    nameInput: 'input[aria-label="Your name"]',
    askToJoinButton: 'button[jsname="Qx7uuf"]',
    joinNowButton: '[data-idom-class*="join"]',

    // Alternative selectors for different Meet states
    joinButtonAlt: 'button:has-text("Ask to join")',
    joinButtonAlt2: 'button:has-text("Join now")',

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

    // Dismiss dialogs
    gotItButton: 'button:has-text("Got it")',
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

        try {
            // Navigate to the meeting
            await this.page.goto(meetLink, { waitUntil: 'domcontentloaded' });
            logger.info('Navigated to meeting page');

            // Wait for page to load and handle any initial dialogs
            await this.dismissDialogs();

            // Turn off camera and microphone before joining
            await this.muteMediaDevices();

            // Enter bot name
            await this.enterName();

            // Click join button
            await this.clickJoinButton();

            // Wait for admission or timeout
            return await this.waitForAdmission();
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown join error';
            logger.error({ error }, 'Join flow failed');

            // Capture debug info on failure
            await this.logPageDebugInfo();

            return {
                success: false,
                state: 'error',
                message,
            };
        }
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
     */
    private async dismissDialogs(): Promise<void> {
        try {
            // Wait a bit for dialogs to appear
            await this.page.waitForTimeout(2000);

            // Try to dismiss common dialogs
            const gotItButton = this.page.locator(SELECTORS.gotItButton).first();
            if (await gotItButton.isVisible({ timeout: 1000 }).catch(() => false)) {
                await gotItButton.click();
                logger.debug('Dismissed "Got it" dialog');
            }

            const dismissButton = this.page.locator(SELECTORS.dismissButton).first();
            if (await dismissButton.isVisible({ timeout: 1000 }).catch(() => false)) {
                await dismissButton.click();
                logger.debug('Dismissed dialog');
            }
        } catch {
            // Dialogs are optional, ignore errors
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
     * Enter the bot's display name
     */
    private async enterName(): Promise<void> {
        logger.debug({ botName: this.options.botName }, 'Entering bot name');

        try {
            // Wait for name input to appear
            const nameInput = this.page.locator(SELECTORS.nameInput);
            await nameInput.waitFor({ timeout: 10000 });

            // Clear existing name and enter bot name
            await nameInput.clear();
            await nameInput.fill(this.options.botName ?? BOT_CONFIG.DEFAULT_BOT_NAME);

            logger.info({ botName: this.options.botName }, 'Entered bot name');
        } catch (error) {
            logger.warn({ error }, 'Name input not found, may already be set or not required');
        }
    }

    /**
     * Click the join/ask to join button
     */
    private async clickJoinButton(): Promise<void> {
        logger.debug('Looking for join button');

        // Try multiple selectors as Meet UI can vary
        const joinSelectors = [
            // Standard "Ask to join" button
            'button:has-text("Ask to join")',
            // Standard "Join now" button (for open meetings)
            'button:has-text("Join now")',
            // Icon-based join button (sometimes used in new UI)
            'button[jsname="Qx7uuf"]',
            // Generic join button class
            '[data-idom-class*="join"]',
            // Fallback for any button containing "Join"
            'button:has-text("Join")',
        ];

        for (const selector of joinSelectors) {
            try {
                // Wait briefly for each selector
                const button = this.page.locator(selector).first();
                if (await button.isVisible({ timeout: 1000 }).catch(() => false)) {
                    logger.info({ selector }, 'Found join button, clicking...');
                    await button.click();
                    return;
                }
            } catch {
                // Try next selector
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
