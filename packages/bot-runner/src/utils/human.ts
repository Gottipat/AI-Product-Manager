/**
 * @fileoverview Human Behavior Simulation
 * @description Uses ghost-cursor-playwright for realistic mouse movements
 *              (Bezier curves + Fitts's Law) and custom typing simulation.
 *
 * Library: ghost-cursor-playwright
 *   - Creates natural bezier curve mouse paths
 *   - Applies Fitts's Law for speed variation
 *   - Overshoots targets and self-corrects
 *   - Clicks random positions within elements
 */

import { createCursor, Cursor } from 'ghost-cursor-playwright';
import pino from 'pino';
import { Page, Locator } from 'playwright';

const logger = pino({ name: 'human-behavior' });

// Re-export the Cursor type for consumers
export type { Cursor };

/**
 * Random number between min and max (inclusive)
 */
function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// ============================================================
// DELAY UTILITIES
// ============================================================

/**
 * Random delay - simulates human pause
 */
export async function randomDelay(minMs: number = 500, maxMs: number = 2000): Promise<void> {
  const delay = randomBetween(minMs, maxMs);
  logger.debug({ delay }, 'Human delay');
  await new Promise((resolve) => setTimeout(resolve, delay));
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

// ============================================================
// GHOST CURSOR (Bezier + Fitts's Law)
// ============================================================

/**
 * Create a ghost cursor attached to a page.
 * The cursor uses Bezier curves and Fitts's Law for realistic movement.
 */
export async function createGhostCursor(page: Page): Promise<Cursor> {
  const cursor = await createCursor(page);
  logger.info('Ghost cursor created (Bezier + Fitts Law)');
  return cursor;
}

// ============================================================
// TYPING SIMULATION
// ============================================================

/**
 * Type text like a human - one character at a time with random delays.
 * Uses ghost cursor to click the field first if available.
 */
export async function humanType(
  page: Page,
  locator: Locator,
  text: string,
  cursor?: Cursor | null,
  options: {
    minCharDelay?: number;
    maxCharDelay?: number;
    mistakeProbability?: number;
  } = {}
): Promise<void> {
  const { minCharDelay = 50, maxCharDelay = 150, mistakeProbability = 0.02 } = options;

  logger.debug({ textLength: text.length }, 'Human typing');

  // Use ghost cursor to click the field if available
  if (cursor) {
    const box = await locator.boundingBox();
    if (box) {
      await cursor.actions.click({
        target: {
          x: box.x,
          y: box.y,
          width: box.width,
          height: box.height,
        },
        waitBeforeClick: [100, 300],
      });
    } else {
      await locator.click();
    }
  } else {
    await locator.click();
  }
  await shortDelay();

  // Clear any existing text
  await locator.fill('');
  await shortDelay();

  // Type each character with human-like timing
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

// ============================================================
// PAGE BEHAVIOR SIMULATION
// ============================================================

/**
 * Simulate reading a page with idle cursor movements and scrolls.
 * Uses ghost cursor for natural random mouse movements.
 */
export async function simulateReading(
  page: Page,
  durationMs: number = 3000,
  cursor?: Cursor | null
): Promise<void> {
  logger.debug({ duration: durationMs }, 'Simulating reading');

  const endTime = Date.now() + durationMs;

  while (Date.now() < endTime) {
    const action = Math.random();

    if (action < 0.5) {
      // 50% chance: just wait
      await randomDelay(500, 1500);
    } else if (action < 0.75) {
      // 25% chance: small scroll
      const scrollAmount = randomBetween(50, 200);
      await page.mouse.wheel(0, scrollAmount);
      await randomDelay(200, 500);
    } else if (cursor) {
      // 25% chance: random mouse movement with ghost cursor
      try {
        await cursor.actions.randomMove();
      } catch {
        // Ignore errors from random movement
      }
      await randomDelay(300, 800);
    } else {
      // Fallback: basic wait
      await randomDelay(500, 1000);
    }
  }

  logger.debug('Reading simulation complete');
}

// ============================================================
// CLICK SIMULATION
// ============================================================

/**
 * Click an element like a human.
 * Uses ghost cursor for Bezier curve movement if available,
 * falls back to basic click with random offset.
 */
export async function humanClick(
  page: Page,
  locator: Locator,
  cursor?: Cursor | null
): Promise<void> {
  logger.debug('Human click');

  if (cursor) {
    // Use ghost cursor for natural movement
    const box = await locator.boundingBox();
    if (box) {
      try {
        await cursor.actions.click({
          target: {
            x: box.x,
            y: box.y,
            width: box.width,
            height: box.height,
          },
          waitBeforeClick: [100, 400],
        });
        logger.debug('Ghost cursor click complete');
        return;
      } catch {
        logger.debug('Ghost click failed, falling back to basic click');
      }
    }
  }

  // Fallback: basic click with small random offset
  const box = await locator.boundingBox();
  if (!box) {
    await locator.click();
    return;
  }

  const clickX = box.x + box.width / 2 + randomBetween(-5, 5);
  const clickY = box.y + box.height / 2 + randomBetween(-3, 3);
  await randomDelay(100, 400);
  await page.mouse.click(clickX, clickY);
  logger.debug('Fallback click complete');
}
