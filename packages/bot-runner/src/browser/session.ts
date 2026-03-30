/**
 * @fileoverview Browser Session Management
 * @description Manages browser page state and session tracking for bot control
 */

import pino from 'pino';
import { BrowserContext, Page, ConsoleMessage } from 'playwright';
import { v4 as uuidv4 } from 'uuid';

const logger = pino({ name: 'browser-session' });

export type SessionState =
  | 'idle'
  | 'navigating'
  | 'joining'
  | 'in-meeting'
  | 'leaving'
  | 'error'
  | 'closed';

export interface SessionInfo {
  /** Unique session identifier */
  sessionId: string;
  /** Current state of the session */
  state: SessionState;
  /** Meeting ID if in a meeting */
  meetingId?: string | undefined;
  /** Google Meet link */
  meetLink?: string | undefined;
  /** Timestamp when session started */
  startedAt: Date;
  /** Last activity timestamp */
  lastActivityAt: Date;
  /** Error message if in error state */
  errorMessage?: string | undefined;
}

/**
 * BrowserSession manages the page lifecycle and state tracking.
 * Each session represents one bot instance joining meetings.
 */
export class BrowserSession {
  private context: BrowserContext;
  private page: Page | null = null;
  private info: SessionInfo;

  constructor(context: BrowserContext) {
    this.context = context;
    this.info = {
      sessionId: uuidv4(),
      state: 'idle',
      startedAt: new Date(),
      lastActivityAt: new Date(),
    };

    logger.info({ sessionId: this.info.sessionId }, 'Session created');
  }

  /**
   * Get the current page, creating one if needed
   */
  async getPage(): Promise<Page> {
    if (!this.page || this.page.isClosed()) {
      logger.info('Creating new page...');
      this.page = await this.context.newPage();

      // Set up page event listeners
      this.page.on('close', () => {
        logger.warn({ sessionId: this.info.sessionId }, 'Page closed unexpectedly');
        this.updateState('closed');
      });

      this.page.on('crash', () => {
        logger.error({ sessionId: this.info.sessionId }, 'Page crashed');
        this.updateState('error', 'Page crashed');
      });

      this.page.on('console', (msg: ConsoleMessage) => {
        if (msg.type() === 'error') {
          logger.debug({ text: msg.text() }, 'Page console error');
        }
      });
    }

    this.updateActivity();
    return this.page;
  }

  /**
   * Get session information
   */
  getInfo(): Readonly<SessionInfo> {
    return { ...this.info };
  }

  /**
   * Get session ID
   */
  getSessionId(): string {
    return this.info.sessionId;
  }

  /**
   * Get current state
   */
  getState(): SessionState {
    return this.info.state;
  }

  /**
   * Update session state
   */
  updateState(state: SessionState, errorMessage?: string): void {
    const previousState = this.info.state;
    this.info.state = state;
    this.info.lastActivityAt = new Date();

    if (errorMessage) {
      this.info.errorMessage = errorMessage;
    } else if (state !== 'error') {
      this.info.errorMessage = undefined;
    }

    logger.info(
      {
        sessionId: this.info.sessionId,
        previousState,
        newState: state,
        errorMessage,
      },
      'Session state updated'
    );
  }

  /**
   * Set meeting information
   */
  setMeetingInfo(meetingId: string, meetLink: string): void {
    this.info.meetingId = meetingId;
    this.info.meetLink = meetLink;
    this.updateActivity();

    logger.info(
      {
        sessionId: this.info.sessionId,
        meetingId,
        meetLink,
      },
      'Meeting info set'
    );
  }

  /**
   * Clear meeting information
   */
  clearMeetingInfo(): void {
    this.info.meetingId = undefined;
    this.info.meetLink = undefined;
    this.updateActivity();
  }

  /**
   * Update last activity timestamp
   */
  private updateActivity(): void {
    this.info.lastActivityAt = new Date();
  }

  /**
   * Check if session is in an active meeting state
   */
  isInMeeting(): boolean {
    return this.info.state === 'in-meeting';
  }

  /**
   * Check if session can accept new meeting requests
   */
  canJoinMeeting(): boolean {
    return this.info.state === 'idle';
  }

  /**
   * Navigate to a URL
   */
  async navigateTo(url: string): Promise<void> {
    const page = await this.getPage();
    this.updateState('navigating');

    logger.info({ url, sessionId: this.info.sessionId }, 'Navigating to URL');

    try {
      await page.goto(url, { waitUntil: 'domcontentloaded' });
      this.updateActivity();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Navigation failed';
      this.updateState('error', message);
      throw error;
    }
  }

  /**
   * Take a screenshot for debugging
   */
  async screenshot(name?: string): Promise<Buffer> {
    const page = await this.getPage();
    const filename = name || `screenshot-${Date.now()}`;

    logger.debug({ filename }, 'Taking screenshot');

    return page.screenshot({
      fullPage: true,
    });
  }

  /**
   * Close the session and clean up
   */
  async close(): Promise<void> {
    logger.info({ sessionId: this.info.sessionId }, 'Closing session');

    if (this.page && !this.page.isClosed()) {
      await this.page.close();
    }

    this.page = null;
    this.updateState('closed');

    logger.info({ sessionId: this.info.sessionId }, 'Session closed');
  }
}
