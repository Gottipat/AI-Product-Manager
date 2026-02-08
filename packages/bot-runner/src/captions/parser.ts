/**
 * @fileoverview Caption DOM Parser
 * @description Parses Google Meet captions from the DOM using MutationObserver
 */

import { Page } from 'playwright';
import pino from 'pino';

const logger = pino({ name: 'caption-parser' });

/**
 * DOM selectors for Google Meet captions
 * These may need updates if Google changes their UI
 */
const SELECTORS = {
    // Caption container that holds all caption elements
    captionContainer: '[jsname="dsyhDe"]',
    captionContainerAlt: '.iOzk7',
    captionContainerAlt2: '[class*="a4cQT"]',

    // Individual caption elements within the container
    captionText: '[class*="TBMuR"]',
    captionTextAlt: '.CNusmb',

    // Speaker name element
    speakerName: '[class*="zs7s8d"]',
    speakerNameAlt: '.KcIKyf',
} as const;

/**
 * Raw caption data from DOM
 */
export interface RawCaption {
    /** Speaker's display name */
    speaker: string;
    /** The caption text */
    text: string;
    /** Timestamp when captured */
    capturedAt: Date;
    /** Whether this appears to be a continuation of previous caption */
    isContinuation: boolean;
}

export type CaptionHandler = (caption: RawCaption) => void;

/**
 * CaptionParser observes the Google Meet DOM and extracts captions
 */
export class CaptionParser {
    private page: Page;
    private handlers: CaptionHandler[] = [];
    private isObserving: boolean = false;
    private lastCaption: RawCaption | null = null;
    private observerSetup: boolean = false;

    constructor(page: Page) {
        this.page = page;
    }

    /**
     * Start observing captions
     */
    async startObserving(): Promise<boolean> {
        if (this.isObserving) {
            logger.debug('Already observing captions');
            return true;
        }

        logger.info('Starting caption observation');

        try {
            // Find the caption container
            const containerSelector = await this.findCaptionContainer();
            if (!containerSelector) {
                logger.warn('Caption container not found. Make sure captions are enabled in Google Meet.');
                return false;
            }

            logger.info({ containerSelector }, 'Found caption container');

            // Set up the MutationObserver in the browser context
            await this.setupObserver(containerSelector);
            this.isObserving = true;

            logger.info('Caption observation started');
            return true;
        } catch (error) {
            logger.error({ error }, 'Failed to start caption observation');
            return false;
        }
    }

    /**
     * Stop observing captions
     */
    async stopObserving(): Promise<void> {
        if (!this.isObserving) {
            return;
        }

        logger.info('Stopping caption observation');

        try {
            await this.page.evaluate(() => {
                // @ts-expect-error - accessing window property set by observer
                if (window.__captionObserver) {
                    // @ts-expect-error - accessing window property set by observer
                    window.__captionObserver.disconnect();
                    // @ts-expect-error - accessing window property set by observer
                    delete window.__captionObserver;
                }
            });
        } catch (error) {
            logger.debug({ error }, 'Error stopping observer');
        }

        this.isObserving = false;
        logger.info('Caption observation stopped');
    }

    /**
     * Register a caption handler
     */
    onCaption(handler: CaptionHandler): void {
        this.handlers.push(handler);
    }

    /**
     * Remove a caption handler
     */
    offCaption(handler: CaptionHandler): void {
        const index = this.handlers.indexOf(handler);
        if (index > -1) {
            this.handlers.splice(index, 1);
        }
    }

    /**
     * Find the caption container in the DOM
     */
    private async findCaptionContainer(): Promise<string | null> {
        const selectors = [
            SELECTORS.captionContainer,
            SELECTORS.captionContainerAlt,
            SELECTORS.captionContainerAlt2,
        ];

        for (const selector of selectors) {
            try {
                const element = this.page.locator(selector);
                if (await element.isVisible({ timeout: 2000 }).catch(() => false)) {
                    return selector;
                }
            } catch {
                // Try next selector
            }
        }

        return null;
    }

    /**
     * Set up the MutationObserver in the browser context
     */
    private async setupObserver(containerSelector: string): Promise<void> {
        // Expose our handler to the page
        if (!this.observerSetup) {
            await this.page.exposeFunction('__onCaptionUpdate', (data: { speaker: string; text: string }) => {
                this.handleCaptionUpdate(data.speaker, data.text);
            });
            this.observerSetup = true;
        }

        // Set up the observer in the browser
        await this.page.evaluate((selector: string) => {
            const container = document.querySelector(selector);
            if (!container) {
                throw new Error('Caption container not found');
            }

            // Clean up existing observer
            // @ts-expect-error - accessing window property set by observer
            if (window.__captionObserver) {
                // @ts-expect-error - accessing window property set by observer
                window.__captionObserver.disconnect();
            }

            // Function to extract caption data
            const extractCaption = () => {
                // Try to find speaker name
                let speaker = 'Unknown';
                const speakerElements = container.querySelectorAll('[class*="zs7s8d"], .KcIKyf');
                if (speakerElements.length > 0) {
                    const lastSpeaker = speakerElements[speakerElements.length - 1];
                    speaker = lastSpeaker?.textContent?.trim() || 'Unknown';
                }

                // Get the caption text
                let text = '';
                const textElements = container.querySelectorAll('[class*="TBMuR"], .CNusmb');
                if (textElements.length > 0) {
                    // Get the last/most recent caption text
                    const lastText = textElements[textElements.length - 1];
                    text = lastText?.textContent?.trim() || '';
                }

                if (text) {
                    // @ts-expect-error - calling exposed function
                    window.__onCaptionUpdate({ speaker, text });
                }
            };

            // Create and start the observer
            const observer = new MutationObserver(() => {
                extractCaption();
            });

            observer.observe(container, {
                childList: true,
                subtree: true,
                characterData: true,
            });

            // Store reference for cleanup
            // @ts-expect-error - setting window property for observer
            window.__captionObserver = observer;

            // Do initial extraction
            extractCaption();
        }, containerSelector);
    }

    /**
     * Handle caption updates from the browser
     */
    private handleCaptionUpdate(speaker: string, text: string): void {
        // Check if this is a duplicate or continuation
        const isContinuation = this.lastCaption !== null &&
            this.lastCaption.speaker === speaker &&
            text.startsWith(this.lastCaption.text);

        // Skip if exact duplicate
        if (this.lastCaption &&
            this.lastCaption.speaker === speaker &&
            this.lastCaption.text === text) {
            return;
        }

        const caption: RawCaption = {
            speaker,
            text,
            capturedAt: new Date(),
            isContinuation,
        };

        this.lastCaption = caption;

        // Emit to handlers
        for (const handler of this.handlers) {
            try {
                handler(caption);
            } catch (error) {
                logger.error({ error }, 'Error in caption handler');
            }
        }

        logger.debug({ speaker, textLength: text.length }, 'Caption captured');
    }

    /**
     * Check if currently observing
     */
    isActive(): boolean {
        return this.isObserving;
    }

    /**
     * Manually poll for captions (fallback if MutationObserver fails)
     */
    async pollCaptions(): Promise<RawCaption | null> {
        try {
            const result = await this.page.evaluate(() => {
                // Try multiple selectors for the caption container
                const containers = [
                    document.querySelector('[jsname="dsyhDe"]'),
                    document.querySelector('.iOzk7'),
                    document.querySelector('[class*="a4cQT"]'),
                ].filter(Boolean);

                if (containers.length === 0) {
                    return null;
                }

                const container = containers[0];
                if (!container) return null;

                // Extract speaker
                let speaker = 'Unknown';
                const speakerEl = container.querySelector('[class*="zs7s8d"], .KcIKyf');
                if (speakerEl) {
                    speaker = speakerEl.textContent?.trim() || 'Unknown';
                }

                // Extract text
                let text = '';
                const textEl = container.querySelector('[class*="TBMuR"], .CNusmb');
                if (textEl) {
                    text = textEl.textContent?.trim() || '';
                }

                if (!text) return null;

                return { speaker, text };
            });

            if (result) {
                return {
                    speaker: result.speaker,
                    text: result.text,
                    capturedAt: new Date(),
                    isContinuation: false,
                };
            }

            return null;
        } catch (error) {
            logger.debug({ error }, 'Error polling captions');
            return null;
        }
    }
}
