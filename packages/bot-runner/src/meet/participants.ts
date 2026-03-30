/**
 * @fileoverview Google Meet Participant Tracker
 * @description Track participant join/leave events in Google Meet
 */

import pino from 'pino';
import { Page } from 'playwright';
import { v4 as uuidv4 } from 'uuid';

const logger = pino({ name: 'meet-participants' });

/**
 * DOM selectors for participant tracking
 */
const SELECTORS = {
    // Participant panel
    participantButton: '[aria-label*="participant"]',
    participantPanel: '[aria-label*="participant" i]',

    // Participant list items
    participantList: '[role="list"]',
    participantItem: '[role="listitem"]',

    // Participant name within list item
    participantName: '[jsname="Kj0dCd"]',
    participantNameAlt: '[data-participant-id]',

    // Participant count in meeting controls
    participantCount: '[data-participant-count]',
} as const;

export interface Participant {
    /** Unique ID for this participant (internal tracking) */
    id: string;
    /** Display name shown in Meet */
    displayName: string;
    /** Google Meet's participant ID if available */
    meetParticipantId?: string | undefined;
    /** Email if visible */
    email?: string | undefined;
    /** When they joined */
    joinedAt: Date;
    /** When they left (null if still in meeting) */
    leftAt?: Date | undefined;
    /** Is this the bot itself */
    isBot: boolean;
}

export interface ParticipantEvent {
    type: 'joined' | 'left';
    participant: Participant;
    timestamp: Date;
}

export type ParticipantEventHandler = (event: ParticipantEvent) => void;

/**
 * ParticipantTracker monitors who is in the meeting
 */
export class ParticipantTracker {
    private page: Page;
    private participants: Map<string, Participant> = new Map();
    private eventHandlers: ParticipantEventHandler[] = [];
    private pollInterval: ReturnType<typeof setInterval> | null = null;
    private botName: string;

    constructor(page: Page, botName: string) {
        this.page = page;
        this.botName = botName;
    }

    /**
     * Start tracking participants
     */
    async startTracking(pollIntervalMs: number = 5000): Promise<void> {
        logger.info({ pollIntervalMs }, 'Starting participant tracking');

        // Do initial scan
        await this.scanParticipants();

        // Set up polling
        this.pollInterval = setInterval(async () => {
            await this.scanParticipants();
        }, pollIntervalMs);
    }

    /**
     * Stop tracking participants
     */
    stopTracking(): void {
        if (this.pollInterval) {
            clearInterval(this.pollInterval);
            this.pollInterval = null;
            logger.info('Stopped participant tracking');
        }
    }

    /**
     * Register an event handler for participant events
     */
    onParticipantEvent(handler: ParticipantEventHandler): void {
        this.eventHandlers.push(handler);
    }

    /**
     * Remove an event handler
     */
    offParticipantEvent(handler: ParticipantEventHandler): void {
        const index = this.eventHandlers.indexOf(handler);
        if (index > -1) {
            this.eventHandlers.splice(index, 1);
        }
    }

    /**
     * Get all current participants
     */
    getParticipants(): Participant[] {
        return Array.from(this.participants.values()).filter((p) => !p.leftAt);
    }

    /**
     * Get participant count
     */
    getParticipantCount(): number {
        return this.getParticipants().length;
    }

    /**
     * Scan for participants in the meeting
     */
    private async scanParticipants(): Promise<void> {
        try {
            const currentNames = await this.getParticipantNames();
            const currentNameSet = new Set(currentNames);

            // Check for new participants
            for (const name of currentNames) {
                const existingParticipant = this.findParticipantByName(name);

                if (!existingParticipant) {
                    // New participant joined
                    const participant: Participant = {
                        id: uuidv4(),
                        displayName: name,
                        joinedAt: new Date(),
                        isBot: name === this.botName,
                    };

                    this.participants.set(participant.id, participant);
                    this.emitEvent({
                        type: 'joined',
                        participant,
                        timestamp: new Date(),
                    });

                    logger.info({ displayName: name }, 'Participant joined');
                } else if (existingParticipant.leftAt) {
                    // Participant rejoined
                    existingParticipant.leftAt = undefined;
                    existingParticipant.joinedAt = new Date();
                    this.emitEvent({
                        type: 'joined',
                        participant: existingParticipant,
                        timestamp: new Date(),
                    });

                    logger.info({ displayName: name }, 'Participant rejoined');
                }
            }

            // Check for participants who left
            for (const [, participant] of this.participants) {
                if (!participant.leftAt && !currentNameSet.has(participant.displayName)) {
                    // Participant left
                    participant.leftAt = new Date();
                    this.emitEvent({
                        type: 'left',
                        participant,
                        timestamp: new Date(),
                    });

                    logger.info({ displayName: participant.displayName }, 'Participant left');
                }
            }
        } catch (error) {
            logger.debug({ error }, 'Error scanning participants, will retry');
        }
    }

    /**
     * Get participant names from the DOM
     */
    private async getParticipantNames(): Promise<string[]> {
        const names: string[] = [];

        try {
            // Try to get from participant panel if open
            const participantItems = this.page.locator(SELECTORS.participantItem);
            const count = await participantItems.count();

            if (count > 0) {
                for (let i = 0; i < count; i++) {
                    const item = participantItems.nth(i);
                    const nameElement = item.locator(SELECTORS.participantName).first();

                    if (await nameElement.isVisible({ timeout: 500 }).catch(() => false)) {
                        const name = await nameElement.textContent();
                        if (name?.trim()) {
                            names.push(name.trim());
                        }
                    }
                }
            }

            // If panel is not open, try to get from other UI elements
            if (names.length === 0) {
                // Try alternative method: participant names shown in video tiles
                const videoNames = await this.getParticipantNamesFromVideoTiles();
                names.push(...videoNames);
            }
        } catch (error) {
            logger.debug({ error }, 'Error getting participant names');
        }

        return [...new Set(names)]; // Remove duplicates
    }

    /**
     * Get participant names from video tiles
     */
    private async getParticipantNamesFromVideoTiles(): Promise<string[]> {
        const names: string[] = [];

        try {
            // Look for name labels on video tiles
            const nameLabels = this.page.locator('[data-self-name], [data-participant-id]');
            const count = await nameLabels.count();

            for (let i = 0; i < count; i++) {
                const label = nameLabels.nth(i);
                const name = await label.getAttribute('data-self-name') || await label.textContent();
                if (name?.trim()) {
                    names.push(name.trim());
                }
            }
        } catch {
            // Ignore errors
        }

        return names;
    }

    /**
     * Find a participant by display name
     */
    private findParticipantByName(name: string): Participant | undefined {
        for (const participant of this.participants.values()) {
            if (participant.displayName === name) {
                return participant;
            }
        }
        return undefined;
    }

    /**
     * Emit a participant event to all handlers
     */
    private emitEvent(event: ParticipantEvent): void {
        for (const handler of this.eventHandlers) {
            try {
                handler(event);
            } catch (error) {
                logger.error({ error }, 'Error in participant event handler');
            }
        }
    }

    /**
     * Open the participant panel to enable detailed tracking
     */
    async openParticipantPanel(): Promise<boolean> {
        try {
            const participantButton = this.page.locator(SELECTORS.participantButton).first();

            if (await participantButton.isVisible({ timeout: 2000 }).catch(() => false)) {
                await participantButton.click();
                await this.page.waitForTimeout(500);
                return true;
            }
        } catch (error) {
            logger.debug({ error }, 'Could not open participant panel');
        }

        return false;
    }
}
