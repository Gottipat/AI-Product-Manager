/**
 * @fileoverview Human Behavior Simulation
 * @description Utilities for making bot actions appear human-like
 */

import { Page, Locator } from 'playwright';
import pino from 'pino';

const logger = pino({ name: 'human-behavior' });

/**
 * Random number between min and max (inclusive)
 */
function randomBetween(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Random delay - simulates human pause
 */
export async function randomDelay(minMs: number = 500, maxMs: number = 2000): Promise<void> {
    const delay = randomBetween(minMs, maxMs);
    logger.debug({ delay }, 'Human delay');
    await new Promise(resolve => setTimeout(resolve, delay));
}

/**
 * Short delay for between-action pauses
 */
export async function shortDelay(): Promise<void> {
    await randomDelay(300, 800);
}

/**
 * Medium delay for "thinking" pauses
 */
export async function mediumDelay(): Promise<void> {
    await randomDelay(1000, 2500);
}

/**
 * Long delay for "reading" pauses
 */
export async function longDelay(): Promise<void> {
    await randomDelay(2000, 4000);
}

/**
 * Type text like a human - one character at a time with random delays
 */
export async function humanType(
    page: Page,
    locator: Locator,
    text: string,
    options: {
        minCharDelay?: number;
        maxCharDelay?: number;
        mistakeProbability?: number;
    } = {}
): Promise<void> {
    const {
        minCharDelay = 50,
        maxCharDelay = 150,
        mistakeProbability = 0.02, // 2% chance of making a typo
    } = options;

    logger.debug({ textLength: text.length }, 'Human typing');

    // Click to focus first
    await locator.click();
    await shortDelay();

    // Clear any existing text
    await locator.fill('');
    await shortDelay();

    // Type each character
    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        if (!char) continue;

        // Simulate occasional typo and backspace
        if (Math.random() < mistakeProbability && i > 0) {
            const wrongChar = String.fromCharCode(char.charCodeAt(0) + randomBetween(-2, 2));
            await page.keyboard.type(wrongChar);
            await randomDelay(100, 300);
            await page.keyboard.press('Backspace');
            await randomDelay(50, 150);
        }

        await page.keyboard.type(char);
        await randomDelay(minCharDelay, maxCharDelay);

        // Occasional longer pause (thinking)
        if (Math.random() < 0.05) {
            await randomDelay(200, 500);
        }
    }

    logger.debug('Human typing complete');
}

/**
 * Move mouse to element with human-like bezier curve motion
 */
export async function humanMove(
    page: Page,
    target: { x: number; y: number },
    options: {
        steps?: number;
        duration?: number;
    } = {}
): Promise<void> {
    const { steps = 25, duration = 500 } = options;

    // Get current mouse position (approximate from viewport center if unknown)
    const viewport = page.viewportSize() || { width: 1920, height: 1080 };
    const currentX = viewport.width / 2;
    const currentY = viewport.height / 2;

    // Calculate bezier curve control points for natural movement
    const controlPoint1 = {
        x: currentX + (target.x - currentX) * 0.3 + randomBetween(-50, 50),
        y: currentY + (target.y - currentY) * 0.1 + randomBetween(-30, 30),
    };
    const controlPoint2 = {
        x: currentX + (target.x - currentX) * 0.7 + randomBetween(-30, 30),
        y: currentY + (target.y - currentY) * 0.9 + randomBetween(-20, 20),
    };

    // Move along bezier curve
    const stepDelay = duration / steps;
    for (let i = 0; i <= steps; i++) {
        const t = i / steps;

        // Cubic bezier formula
        const x = Math.pow(1 - t, 3) * currentX +
            3 * Math.pow(1 - t, 2) * t * controlPoint1.x +
            3 * (1 - t) * Math.pow(t, 2) * controlPoint2.x +
            Math.pow(t, 3) * target.x;

        const y = Math.pow(1 - t, 3) * currentY +
            3 * Math.pow(1 - t, 2) * t * controlPoint1.y +
            3 * (1 - t) * Math.pow(t, 2) * controlPoint2.y +
            Math.pow(t, 3) * target.y;

        await page.mouse.move(x, y);
        await new Promise(resolve => setTimeout(resolve, stepDelay));
    }
}

/**
 * Click an element like a human - move to it, pause, then click
 */
export async function humanClick(
    page: Page,
    locator: Locator,
    options: {
        moveFirst?: boolean;
        delayBeforeClick?: boolean;
    } = {}
): Promise<void> {
    const { moveFirst = true, delayBeforeClick = true } = options;

    logger.debug('Human click');

    // Get element bounding box
    const box = await locator.boundingBox();
    if (!box) {
        // Fallback to regular click if we can't get bounding box
        await locator.click();
        return;
    }

    // Calculate click position with slight randomness
    const clickX = box.x + box.width / 2 + randomBetween(-5, 5);
    const clickY = box.y + box.height / 2 + randomBetween(-3, 3);

    if (moveFirst) {
        // Move mouse to element with human-like motion
        await humanMove(page, { x: clickX, y: clickY });
    }

    if (delayBeforeClick) {
        // Short pause before clicking (like human hesitation)
        await randomDelay(100, 400);
    }

    // Click with slight position variance
    await page.mouse.click(clickX, clickY);

    logger.debug('Human click complete');
}

/**
 * Scroll the page like a human
 */
export async function humanScroll(
    page: Page,
    direction: 'up' | 'down' = 'down',
    amount: number = 300
): Promise<void> {
    const scrollAmount = direction === 'down' ? amount : -amount;
    const steps = randomBetween(3, 6);
    const stepAmount = scrollAmount / steps;

    for (let i = 0; i < steps; i++) {
        await page.mouse.wheel(0, stepAmount + randomBetween(-20, 20));
        await randomDelay(50, 150);
    }
}

/**
 * Simulate reading the page (random delays + occasional scroll)
 */
export async function simulateReading(page: Page, durationMs: number = 3000): Promise<void> {
    logger.debug({ duration: durationMs }, 'Simulating reading');

    const endTime = Date.now() + durationMs;

    while (Date.now() < endTime) {
        // Random action: wait, scroll, or move mouse
        const action = Math.random();

        if (action < 0.7) {
            // 70% chance: just wait
            await randomDelay(500, 1500);
        } else if (action < 0.9) {
            // 20% chance: small scroll
            await humanScroll(page, 'down', randomBetween(50, 150));
        } else {
            // 10% chance: random mouse movement
            const viewport = page.viewportSize() || { width: 1920, height: 1080 };
            await humanMove(page, {
                x: randomBetween(100, viewport.width - 100),
                y: randomBetween(100, viewport.height - 100),
            });
        }
    }

    logger.debug('Reading simulation complete');
}
