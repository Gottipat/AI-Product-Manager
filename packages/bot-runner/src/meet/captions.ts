/**
 * @fileoverview Google Meet Captions Controller
 * @description Enable/disable captions and manage caption settings in Google Meet
 */

import { Page } from 'playwright';
import pino from 'pino';

const logger = pino({ name: 'meet-captions' });

/**
 * DOM selectors for caption controls
 */
const SELECTORS = {
    // Caption toggle button (CC button in controls bar)
    captionsButton: '[aria-label*="caption"]',
    captionsButtonAlt: 'button[data-tooltip*="caption"]',

    // More options menu for caption settings
    moreOptionsButton: '[aria-label="More options"]',

    // Caption settings in menu
    turnOnCaptions: 'li:has-text("Turn on captions")',
    turnOffCaptions: 'li:has-text("Turn off captions")',

    // Caption language settings
    captionSettings: 'li:has-text("Caption settings")',

    // Caption container (where captions appear) - updated selectors
    captionContainer: '.iS70S',
    captionContainerAlt: '[jsname="dsyhDe"]',
    captionContainerAlt2: '.iOzk7',
    captionContainerAlt3: '[class*="caption"]',
} as const;

export interface CaptionsOptions {
    /** Language for captions (default: English) */
    language?: string | undefined;
    /** Retry attempts for enabling captions */
    retryAttempts?: number | undefined;
}

/**
 * CaptionsController manages Google Meet captions
 */
export class CaptionsController {
    private page: Page;
    private options: Required<CaptionsOptions>;
    private captionsEnabled: boolean = false;

    constructor(page: Page, options: CaptionsOptions = {}) {
        this.page = page;
        this.options = {
            language: options.language ?? 'English',
            retryAttempts: options.retryAttempts ?? 3,
        };
    }

    /**
     * Enable captions in the meeting
     */
    async enable(): Promise<boolean> {
        if (this.captionsEnabled) {
            logger.debug('Captions already enabled');
            return true;
        }

        logger.info('Enabling captions');

        for (let attempt = 1; attempt <= this.options.retryAttempts!; attempt++) {
            try {
                const success = await this.tryEnableCaptions();
                if (success) {
                    this.captionsEnabled = true;
                    logger.info('Captions enabled successfully');
                    return true;
                }
            } catch (error) {
                logger.warn({ attempt, error }, 'Failed to enable captions, retrying...');
            }

            if (attempt < this.options.retryAttempts!) {
                await this.page.waitForTimeout(1000);
            }
        }

        logger.error('Failed to enable captions after all retries');
        return false;
    }

    /**
     * Try to enable captions using various methods
     */
    private async tryEnableCaptions(): Promise<boolean> {
        // Method 1: Click the CC button directly
        const ccButton = this.page.locator(SELECTORS.captionsButton).first();
        if (await ccButton.isVisible({ timeout: 2000 }).catch(() => false)) {
            const ariaLabel = await ccButton.getAttribute('aria-label');

            // Check if captions are already on
            if (ariaLabel?.toLowerCase().includes('turn off')) {
                logger.debug('Captions already enabled');
                return true;
            }

            await ccButton.click();

            // Verify captions are now on
            await this.page.waitForTimeout(500);
            const newLabel = await ccButton.getAttribute('aria-label');
            if (newLabel?.toLowerCase().includes('turn off')) {
                return true;
            }
        }

        // Method 2: Try alternative CC button selector
        const ccButtonAlt = this.page.locator(SELECTORS.captionsButtonAlt).first();
        if (await ccButtonAlt.isVisible({ timeout: 2000 }).catch(() => false)) {
            await ccButtonAlt.click();
            return await this.verifyCaptionsEnabled();
        }

        // Method 3: Use keyboard shortcut (c key toggles captions in Meet)
        await this.page.keyboard.press('c');
        await this.page.waitForTimeout(500);

        return await this.verifyCaptionsEnabled();
    }

    /**
     * Verify that captions are enabled
     */
    private async verifyCaptionsEnabled(): Promise<boolean> {
        try {
            // Check for caption container
            const container = this.page.locator(SELECTORS.captionContainer);
            const containerAlt = this.page.locator(SELECTORS.captionContainerAlt);
            const containerAlt2 = this.page.locator(SELECTORS.captionContainerAlt2);

            const isVisible = await Promise.race([
                container.isVisible({ timeout: 2000 }).catch(() => false),
                containerAlt.isVisible({ timeout: 2000 }).catch(() => false),
                containerAlt2.isVisible({ timeout: 2000 }).catch(() => false),
                this.page.locator(SELECTORS.captionContainerAlt3).isVisible({ timeout: 2000 }).catch(() => false),
            ]);

            return isVisible;
        } catch {
            return false;
        }
    }

    /**
     * Disable captions in the meeting
     */
    async disable(): Promise<boolean> {
        if (!this.captionsEnabled) {
            logger.debug('Captions already disabled');
            return true;
        }

        logger.info('Disabling captions');

        try {
            // Method 1: Click the CC button
            const ccButton = this.page.locator(SELECTORS.captionsButton).first();
            if (await ccButton.isVisible({ timeout: 2000 }).catch(() => false)) {
                await ccButton.click();
            } else {
                // Method 2: Use keyboard shortcut
                await this.page.keyboard.press('c');
            }

            await this.page.waitForTimeout(500);
            this.captionsEnabled = false;
            logger.info('Captions disabled');
            return true;
        } catch (error) {
            logger.error({ error }, 'Failed to disable captions');
            return false;
        }
    }

    /**
     * Toggle captions on/off
     */
    async toggle(): Promise<boolean> {
        if (this.captionsEnabled) {
            return await this.disable();
        } else {
            return await this.enable();
        }
    }

    /**
     * Check if captions are currently enabled
     */
    isEnabled(): boolean {
        return this.captionsEnabled;
    }

    /**
     * Get the caption container element for observation
     */
    async getCaptionContainer(): Promise<string | null> {
        const selectors = [
            SELECTORS.captionContainer,
            SELECTORS.captionContainerAlt,
            SELECTORS.captionContainerAlt2,
            SELECTORS.captionContainerAlt3,
        ];

        for (const selector of selectors) {
            const element = this.page.locator(selector);
            if (await element.isVisible({ timeout: 1000 }).catch(() => false)) {
                return selector;
            }
        }

        return null;
    }
}
