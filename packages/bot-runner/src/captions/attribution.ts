/**
 * @fileoverview Speaker Attribution
 * @description Tracks and attributes captions to speakers, handling name normalization
 */

import pino from 'pino';

const logger = pino({ name: 'caption-attribution' });

/**
 * Speaker information
 */
export interface Speaker {
    /** Unique ID for this speaker */
    id: string;
    /** Normalized display name */
    displayName: string;
    /** All observed name variations */
    nameVariations: Set<string>;
    /** First seen timestamp */
    firstSeen: Date;
    /** Last active timestamp */
    lastActive: Date;
    /** Total caption count from this speaker */
    captionCount: number;
}

/**
 * SpeakerTracker manages speaker identification and attribution
 */
export class SpeakerTracker {
    private speakers: Map<string, Speaker> = new Map();
    private nameToSpeakerId: Map<string, string> = new Map();
    private nextSpeakerId: number = 1;

    constructor() { }

    /**
     * Get or create a speaker by name
     */
    getOrCreateSpeaker(rawName: string): Speaker {
        const normalizedName = this.normalizeName(rawName);

        // Check if we have this name mapped to a speaker
        const existingSpeakerId = this.nameToSpeakerId.get(normalizedName);
        if (existingSpeakerId) {
            const speaker = this.speakers.get(existingSpeakerId);
            if (speaker) {
                speaker.lastActive = new Date();
                speaker.captionCount++;

                // Add the raw name as a variation if different
                if (rawName !== speaker.displayName) {
                    speaker.nameVariations.add(rawName);
                }

                return speaker;
            }
        }

        // Create new speaker
        const speakerId = `speaker-${this.nextSpeakerId++}`;
        const speaker: Speaker = {
            id: speakerId,
            displayName: normalizedName,
            nameVariations: new Set([rawName]),
            firstSeen: new Date(),
            lastActive: new Date(),
            captionCount: 1,
        };

        this.speakers.set(speakerId, speaker);
        this.nameToSpeakerId.set(normalizedName, speakerId);

        logger.info({ speakerId, displayName: normalizedName }, 'New speaker detected');

        return speaker;
    }

    /**
     * Get a speaker by ID
     */
    getSpeaker(speakerId: string): Speaker | undefined {
        return this.speakers.get(speakerId);
    }

    /**
     * Get all speakers
     */
    getAllSpeakers(): Speaker[] {
        return Array.from(this.speakers.values());
    }

    /**
     * Get active speakers (active in last N seconds)
     */
    getActiveSpeakers(withinSeconds: number = 60): Speaker[] {
        const cutoff = new Date(Date.now() - withinSeconds * 1000);
        return Array.from(this.speakers.values())
            .filter(s => s.lastActive >= cutoff);
    }

    /**
     * Normalize a speaker name for consistent matching
     */
    private normalizeName(name: string): string {
        if (!name) return 'Unknown';

        // Trim whitespace
        let normalized = name.trim();

        // Remove common suffixes added by Google Meet
        normalized = normalized
            .replace(/\s*\(You\)$/i, '')
            .replace(/\s*\(Host\)$/i, '')
            .replace(/\s*\(Presenter\)$/i, '')
            .replace(/\s*\(Guest\)$/i, '');

        // Handle "devices" suffix that sometimes appears
        normalized = normalized.replace(/devices$/i, '').trim();

        // Collapse multiple spaces
        normalized = normalized.replace(/\s+/g, ' ');

        // Handle empty after normalization
        if (!normalized) {
            return 'Unknown';
        }

        return normalized;
    }

    /**
     * Try to merge speakers that appear to be the same person
     */
    mergeSimilarSpeakers(similarity: number = 0.8): void {
        const speakers = this.getAllSpeakers();

        for (let i = 0; i < speakers.length; i++) {
            for (let j = i + 1; j < speakers.length; j++) {
                const s1 = speakers[i];
                const s2 = speakers[j];

                if (!s1 || !s2) continue;

                if (this.areSimilarNames(s1.displayName, s2.displayName, similarity)) {
                    // Merge s2 into s1
                    s1.nameVariations = new Set([...s1.nameVariations, ...s2.nameVariations]);
                    s1.captionCount += s2.captionCount;
                    if (s2.firstSeen < s1.firstSeen) {
                        s1.firstSeen = s2.firstSeen;
                    }
                    if (s2.lastActive > s1.lastActive) {
                        s1.lastActive = s2.lastActive;
                    }

                    // Update name mappings
                    for (const name of s2.nameVariations) {
                        const normalized = this.normalizeName(name);
                        this.nameToSpeakerId.set(normalized, s1.id);
                    }

                    // Remove s2
                    this.speakers.delete(s2.id);

                    logger.info(
                        { merged: s2.displayName, into: s1.displayName },
                        'Merged similar speakers'
                    );
                }
            }
        }
    }

    /**
     * Check if two names are similar (basic Levenshtein-like comparison)
     */
    private areSimilarNames(name1: string, name2: string, threshold: number): boolean {
        const n1 = name1.toLowerCase();
        const n2 = name2.toLowerCase();

        // Exact match
        if (n1 === n2) return true;

        // One contains the other
        if (n1.includes(n2) || n2.includes(n1)) return true;

        // Calculate simple similarity (shared characters / max length)
        const chars1 = new Set(n1.split(''));
        const chars2 = new Set(n2.split(''));
        const intersection = new Set([...chars1].filter(x => chars2.has(x)));
        const similarity = intersection.size / Math.max(chars1.size, chars2.size);

        return similarity >= threshold;
    }

    /**
     * Clear all speaker data
     */
    clear(): void {
        this.speakers.clear();
        this.nameToSpeakerId.clear();
        this.nextSpeakerId = 1;
    }

    /**
     * Get speaker count
     */
    getSpeakerCount(): number {
        return this.speakers.size;
    }
}
