import { Page } from 'playwright';
import pino from 'pino';
import { humanType, humanClick, mediumDelay, randomDelay, simulateReading } from '../utils/human.js';

const logger = pino({ name: 'auth-manager' });

/**
 * Common selectors for Google Accounts login page
 */
const SELECTORS = {
    emailInput: 'input[type="email"]',
    passwordInput: 'input[type="password"]',
    nextButton: 'button:has-text("Next")',
    signedInCheck: 'a[aria-label*="Google Account"]', // Appears in the top right when logged in
    captchaContainer: '#captcha-form', // Common container for Google captchas
    recoveryEmailPrompt: 'text="Confirm your recovery email"',
} as const;

export class AuthManager {
    private page: Page;

    constructor(page: Page) {
        this.page = page;
    }

    /**
     * Perform the full Google Sign In flow.
     */
    async login(email?: string, password?: string): Promise<boolean> {
        if (!email || !password) {
            logger.warn('Email or password not provided, skipping authentication');
            return false;
        }

        logger.info({ email: maskEmail(email) }, 'Starting Google authentication flow');

        try {
            // First check if we're already logged in by going to Google homepage
            await this.page.goto('https://www.google.com', { waitUntil: 'load' });
            if (await this.isLoggedIn()) {
                logger.info('Already logged into Google account');
                return true;
            }

            // Navigate to Google Sign In
            logger.info('Navigating to Google Sign In...');
            await this.page.goto('https://accounts.google.com/signin/v2/identifier', { waitUntil: 'load' });

            // Step 1: Enter Email
            await this.enterEmail(email);

            // Step 2: Enter Password
            await this.enterPassword(password);

            // Give it some time to complete login and redirect
            await this.page.waitForLoadState('networkidle');
            await randomDelay(2000, 3000);

            // Check for additional verification steps (like recovery email prompt)
            await this.handleSecurityPrompts();

            // Verify final login status
            if (await this.isLoggedIn()) {
                logger.info('Successfully logged into Google Account');
                return true;
            } else {
                logger.warn('Login flow completed but was not able to verify logged-in status. We may be stuck on a 2FA screen or captcha.');
                await this.logDebugState('Post-login Verification Failed');
                return false;
            }
        } catch (error) {
            logger.error({ error }, 'Authentication flow failed');
            await this.logDebugState('Auth Flow Failed');
            return false;
        }
    }

    /**
     * Check if a Google session is currently active.
     */
    public async isLoggedIn(): Promise<boolean> {
        try {
            // Check for Google Account avatar in the top right
            const avatar = this.page.locator(SELECTORS.signedInCheck).first();
            return await avatar.isVisible({ timeout: 3000 }).catch(() => false);
        } catch {
            return false;
        }
    }

    private async enterEmail(email: string): Promise<void> {
        logger.debug('Waiting for email input field');
        const emailInput = this.page.locator(SELECTORS.emailInput);

        // Wait for the field to be visible and ready
        await emailInput.waitFor({ state: 'visible', timeout: 10000 });
        await simulateReading(this.page, 1500);

        logger.debug('Entering email address');
        await humanType(this.page, emailInput, email);
        await mediumDelay();

        // Click Next
        logger.debug('Clicking Next on email step');
        const nextButton = this.page.locator(SELECTORS.nextButton).first();
        await humanClick(this.page, nextButton);

        // Wait for network to settle or transition to password screen
        await this.page.waitForLoadState('networkidle').catch(() => { });
        await randomDelay(1500, 2500);
    }

    private async enterPassword(password: string): Promise<void> {
        logger.debug('Waiting for password input field');
        const passwordInput = this.page.locator(SELECTORS.passwordInput);

        // Wait up to 10s for password field to become visible (account check can take a moment)
        await passwordInput.waitFor({ state: 'visible', timeout: 10000 });
        await simulateReading(this.page, 1500);

        logger.debug('Entering password');
        await humanType(this.page, passwordInput, password);
        await mediumDelay();

        // Click Next
        logger.debug('Clicking Next on password step');
        const nextButton = this.page.locator(SELECTORS.nextButton).first();
        await humanClick(this.page, nextButton);

        await this.page.waitForLoadState('networkidle').catch(() => { });
    }

    /**
     * Handles common post-password prompts like "Confirm your recovery email"
     * We don't solve 2FA or Captchas, but we can log them.
     */
    private async handleSecurityPrompts(): Promise<void> {
        try {
            // Check for Captcha
            const captcha = this.page.locator(SELECTORS.captchaContainer);
            if (await captcha.isVisible({ timeout: 2000 }).catch(() => false)) {
                logger.warn('Google presented a CAPTCHA. The bot cannot bypass this automatically.');
            }

            // We can add logic here to click "Not now" or similar on recovery prompts if they appear
            const notNowButton = this.page.locator('button:has-text("Not now")').first();
            if (await notNowButton.isVisible({ timeout: 2000 }).catch(() => false)) {
                logger.info('Dismissing "Not now" prompt');
                await humanClick(this.page, notNowButton);
                await this.page.waitForLoadState('networkidle');
            }
        } catch (e) {
            // Ignore timeout errors here
        }
    }

    private async logDebugState(reason: string): Promise<void> {
        try {
            const url = this.page.url();
            const title = await this.page.title();
            logger.debug({ url, title }, `Auth Debug state: ${reason}`);
        } catch (e) { }
    }
}

// Helper to safely log emails
function maskEmail(email: string): string {
    const [name, domain] = email.split('@');
    if (!domain || !name) return '***';
    return `${name.substring(0, 2)}***@${domain}`;
}
