/**
 * @fileoverview Browser Launcher
 * @description Playwright browser management for Google Meet bot
 */

import { chromium, Browser, BrowserContext, LaunchOptions } from 'playwright';
import { BOT_CONFIG } from '@meeting-ai/shared';
import pino from 'pino';

const logger = pino({ name: 'browser-launcher' });

export interface LauncherOptions {
    /** Run in headless mode (default: false for debugging) */
    headless?: boolean | undefined;
    /** Custom user data directory for persistent sessions */
    userDataDir?: string | undefined;
    /** Additional browser arguments */
    args?: string[] | undefined;
}

/**
 * BrowserLauncher manages the Playwright browser lifecycle.
 * Handles launching, configuring, and closing the Chromium instance.
 */
export class BrowserLauncher {
    private browser: Browser | null = null;
    private context: BrowserContext | null = null;
    private options: LauncherOptions;

    constructor(options: LauncherOptions = {}) {
        this.options = {
            headless: options.headless ?? false, // Default to visible for debugging
            userDataDir: options.userDataDir ?? undefined,
            args: options.args ?? [],
        };
    }

    /**
     * Launch the browser with configured settings
     */
    async launch(): Promise<BrowserContext> {
        if (this.browser) {
            logger.warn('Browser already launched, returning existing context');
            return this.context!;
        }

        logger.info('Launching Chromium browser...');

        const launchOptions: LaunchOptions = {
            headless: this.options.headless ?? false,
            ignoreDefaultArgs: ['--enable-automation'],
            args: [
                '--disable-blink-features=AutomationControlled',
                '--exclude-switches=enable-automation',
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--disable-gpu',
                // Permissions for microphone/camera (even if we don't use them, Meet checks)
                '--use-fake-ui-for-media-stream',
                '--use-fake-device-for-media-stream',
                ...(this.options.args ?? []),
            ],
            channel: 'chrome', // Use real Chrome browser if available
        };

        this.browser = await chromium.launch(launchOptions);

        // Create browser context with viewport and user agent
        this.context = await this.browser.newContext({
            viewport: {
                width: BOT_CONFIG.VIEWPORT.width,
                height: BOT_CONFIG.VIEWPORT.height,
            },
            userAgent: BOT_CONFIG.USER_AGENT,
            // Grant permissions for media
            permissions: ['microphone', 'camera'],
            // Ignore HTTPS errors (useful for local development)
            ignoreHTTPSErrors: true,
        });

        // Stealth: Hide webdriver property
        await this.context.addInitScript(() => {
            Object.defineProperty(navigator, 'webdriver', {
                get: () => undefined,
            });
        });

        logger.info(
            {
                viewport: BOT_CONFIG.VIEWPORT,
                headless: this.options.headless,
            },
            'Browser launched successfully'
        );

        return this.context;
    }

    /**
     * Get the current browser context
     */
    getContext(): BrowserContext | null {
        return this.context;
    }

    /**
     * Get the browser instance
     */
    getBrowser(): Browser | null {
        return this.browser;
    }

    /**
     * Check if browser is running
     */
    isRunning(): boolean {
        return this.browser !== null && this.browser.isConnected();
    }

    /**
     * Close the browser and clean up resources
     */
    async close(): Promise<void> {
        if (this.context) {
            logger.info('Closing browser context...');
            await this.context.close();
            this.context = null;
        }

        if (this.browser) {
            logger.info('Closing browser...');
            await this.browser.close();
            this.browser = null;
        }

        logger.info('Browser closed successfully');
    }
}

// Singleton instance for convenience
let defaultLauncher: BrowserLauncher | null = null;

/**
 * Get or create the default browser launcher
 */
export function getDefaultLauncher(options?: LauncherOptions): BrowserLauncher {
    if (!defaultLauncher) {
        defaultLauncher = new BrowserLauncher(options);
    }
    return defaultLauncher;
}

/**
 * Reset the default launcher (useful for testing)
 */
export async function resetDefaultLauncher(): Promise<void> {
    if (defaultLauncher) {
        await defaultLauncher.close();
        defaultLauncher = null;
    }
}
