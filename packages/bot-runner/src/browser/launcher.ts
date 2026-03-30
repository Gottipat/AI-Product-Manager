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
            // Use real Chrome instead of Playwright's Chromium
            // This bypasses Google Meet's detection of automation browsers
            channel: 'chrome',
            ignoreDefaultArgs: ['--enable-automation'],
            args: [
                // === WINDOW SIZE (ensure full UI visibility) ===
                '--start-maximized',
                `--window-size=${BOT_CONFIG.VIEWPORT.width},${BOT_CONFIG.VIEWPORT.height}`,
                '--window-position=0,0',
                // === CLEAN STATE (incognito-like) ===
                '--disable-extensions',
                '--disable-sync',
                '--disable-background-networking',
                '--disable-translate',
                '--disable-infobars',
                // === AUTOMATION HIDING ===
                '--disable-blink-features=AutomationControlled',
                // === SANDBOX SETTINGS ===
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                // === MEDIA PERMISSIONS ===
                '--use-fake-ui-for-media-stream',
                '--use-fake-device-for-media-stream',
                ...(this.options.args ?? []),
            ],
        };

        this.browser = await chromium.launch(launchOptions);

        // Create a completely fresh browser context (like incognito)
        // This ensures no cookies, localStorage, or session data from previous runs
        this.context = await this.browser.newContext({
            // Use null viewport to let the browser use its maximized window size
            // This ensures all Meet UI elements are visible
            viewport: null,
            userAgent: BOT_CONFIG.USER_AGENT,
            // Grant permissions for media
            permissions: ['microphone', 'camera'],
            // Ignore HTTPS errors (useful for local development)
            ignoreHTTPSErrors: true,
            // Set locale for consistent behavior
            locale: 'en-US',
            // Disable color scheme preference to avoid dark mode issues
            colorScheme: 'light',
        });

        // Comprehensive stealth configuration to avoid bot detection
        await this.context.addInitScript(() => {
            // 1. Hide webdriver property
            Object.defineProperty(navigator, 'webdriver', {
                get: () => undefined,
            });

            // 2. Override navigator.plugins to look like a real browser
            Object.defineProperty(navigator, 'plugins', {
                get: () => {
                    const plugins = [
                        { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
                        { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai', description: '' },
                        { name: 'Native Client', filename: 'internal-nacl-plugin', description: '' },
                    ];
                    const pluginArray = plugins.map(p => {
                        const plugin = { ...p, length: 1 };
                        Object.setPrototypeOf(plugin, Plugin.prototype);
                        return plugin;
                    });
                    Object.setPrototypeOf(pluginArray, PluginArray.prototype);
                    return pluginArray;
                },
            });

            // 3. Override navigator.languages
            Object.defineProperty(navigator, 'languages', {
                get: () => ['en-US', 'en'],
            });

            // 4. Override navigator.permissions.query to always resolve
            const originalQuery = window.navigator.permissions.query;
            // @ts-ignore
            window.navigator.permissions.query = (parameters: PermissionDescriptor) => {
                if (parameters.name === 'notifications') {
                    return Promise.resolve({ state: Notification.permission, onchange: null } as PermissionStatus);
                }
                return originalQuery.call(window.navigator.permissions, parameters);
            };

            // 5. Add chrome runtime object (important for detection bypass)
            // @ts-ignore
            if (!window.chrome) {
                // @ts-ignore
                window.chrome = {};
            }
            // @ts-ignore
            if (!window.chrome.runtime) {
                // @ts-ignore
                window.chrome.runtime = {
                    connect: () => { },
                    sendMessage: () => { },
                    onMessage: { addListener: () => { } },
                };
            }

            // 6. Override WebGL vendor/renderer to look like a real GPU
            const getParameterOriginal = WebGLRenderingContext.prototype.getParameter;
            WebGLRenderingContext.prototype.getParameter = function (parameter: GLenum) {
                // UNMASKED_VENDOR_WEBGL
                if (parameter === 37445) {
                    return 'Google Inc. (Apple)';
                }
                // UNMASKED_RENDERER_WEBGL  
                if (parameter === 37446) {
                    return 'ANGLE (Apple, Apple M1 Pro, OpenGL 4.1)';
                }
                return getParameterOriginal.call(this, parameter);
            };

            // 7. Override console.debug to prevent leak detection
            const originalDebug = console.debug;
            console.debug = (...args) => {
                if (args[0]?.includes?.('Automation')) return;
                originalDebug.apply(console, args);
            };

            // 8. Ensure window.Notification exists
            if (!window.Notification) {
                // @ts-ignore
                window.Notification = {
                    permission: 'default',
                    requestPermission: () => Promise.resolve('default'),
                };
            }
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
