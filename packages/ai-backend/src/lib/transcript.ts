/**
 * @fileoverview Transcript parsing and formatting utilities
 * @description Helpers for normalizing uploaded transcripts and preparing
 *              richer transcript context for AI extraction.
 */

export interface TranscriptLikeEvent {
  speaker: string;
  content: string;
  sequenceNumber: number;
  capturedAt?: Date | null;
}

export interface ParsedTranscriptLine {
  speaker: string;
  content: string;
  capturedAt?: Date | null | undefined;
  timestampLabel?: string | undefined;
}

export interface ParsedTranscriptResult {
  events: ParsedTranscriptLine[];
  startedAt?: Date | undefined;
}

const SPEAKER_LINE_PATTERN = /^([^:]{1,80}):\s+(.+)$/;
const BRACKETED_TIMESTAMP_PATTERN = /^\[(.+?)\]\s*(.+)$/;
const LEADING_TIMESTAMP_PATTERN =
  /^(\d{1,2}:\d{2}(?::\d{2})?(?:\s?[APMapm]{2})?)\s*(?:[-|–|—]\s*)?(.+)$/;
const STARTED_AT_PATTERN = /^started at:\s*(.+)$/i;

function parseStartedAt(line: string): Date | undefined {
  const match = line.match(STARTED_AT_PATTERN);
  if (!match?.[1]) return undefined;

  const parsed = new Date(match[1]);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function parseLineTimestamp(rawTimestamp: string, meetingStart?: Date): Date | undefined {
  const trimmed = rawTimestamp.trim();

  if (/^\d{1,2}:\d{2}:\d{2}$/.test(trimmed) && meetingStart) {
    const [hours, minutes, seconds] = trimmed.split(':').map(Number);
    const parsed = new Date(meetingStart);
    parsed.setHours(hours ?? 0, minutes ?? 0, seconds ?? 0, 0);
    return parsed;
  }

  if (/^\d{1,2}:\d{2}(?:\s?[APMapm]{2})$/.test(trimmed) && meetingStart) {
    const normalized = trimmed.toUpperCase().replace(/\s+/g, ' ');
    const match = normalized.match(/^(\d{1,2}):(\d{2})\s(AM|PM)$/);
    if (!match) return undefined;

    let hours = Number(match[1]);
    const minutes = Number(match[2]);
    const meridiem = match[3];

    if (meridiem === 'PM' && hours < 12) hours += 12;
    if (meridiem === 'AM' && hours === 12) hours = 0;

    const parsed = new Date(meetingStart);
    parsed.setHours(hours, minutes, 0, 0);
    return parsed;
  }

  if (/^\d{1,2}:\d{2}$/.test(trimmed) && meetingStart) {
    const [minutes, seconds] = trimmed.split(':').map(Number);
    const parsed = new Date(meetingStart.getTime() + ((minutes ?? 0) * 60 + (seconds ?? 0)) * 1000);
    return parsed;
  }

  return undefined;
}

function stripTimestampPrefix(line: string): {
  content: string;
  timestampLabel?: string;
} {
  const bracketed = line.match(BRACKETED_TIMESTAMP_PATTERN);
  if (bracketed?.[1] && bracketed[2]) {
    return {
      timestampLabel: bracketed[1].trim(),
      content: bracketed[2].trim(),
    };
  }

  const leading = line.match(LEADING_TIMESTAMP_PATTERN);
  if (leading?.[1] && leading[2]) {
    return {
      timestampLabel: leading[1].trim(),
      content: leading[2].trim(),
    };
  }

  return { content: line };
}

export function parseTranscript(raw: string): ParsedTranscriptResult {
  const lines = raw
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const events: ParsedTranscriptLine[] = [];
  let meetingStart: Date | undefined;

  for (const line of lines) {
    if (/^===\s*transcript/i.test(line)) continue;

    const startedAt = parseStartedAt(line);
    if (startedAt) {
      meetingStart = startedAt;
      continue;
    }

    const { content: contentWithoutTimestamp, timestampLabel } = stripTimestampPrefix(line);
    const speakerMatch = contentWithoutTimestamp.match(SPEAKER_LINE_PATTERN);

    if (speakerMatch?.[1] && speakerMatch[2]) {
      events.push({
        speaker: speakerMatch[1].trim(),
        content: speakerMatch[2].trim(),
        timestampLabel,
        capturedAt: timestampLabel ? parseLineTimestamp(timestampLabel, meetingStart) ?? null : null,
      });
      continue;
    }

    const previous = events[events.length - 1];
    if (previous) {
      previous.content = `${previous.content} ${contentWithoutTimestamp}`.trim();
      continue;
    }

    events.push({
      speaker: 'Unknown Speaker',
      content: contentWithoutTimestamp,
      timestampLabel,
      capturedAt: timestampLabel ? parseLineTimestamp(timestampLabel, meetingStart) ?? null : null,
    });
  }

  return { events, startedAt: meetingStart };
}

export function formatTranscriptForAI(events: TranscriptLikeEvent[]): string {
  return events
    .map((event) => {
      const attributes = [
        `seq=${event.sequenceNumber}`,
        event.capturedAt ? `time=${event.capturedAt.toISOString()}` : null,
        `speaker=${event.speaker}`,
      ]
        .filter(Boolean)
        .join(' ');

      return `[${attributes}] ${event.content}`;
    })
    .join('\n');
}

export function getTranscriptSpeakerStats(events: TranscriptLikeEvent[]): {
  eventCount: number;
  speakers: string[];
  firstCapturedAt?: string | undefined;
  lastCapturedAt?: string | undefined;
} {
  const speakers = Array.from(new Set(events.map((event) => event.speaker).filter(Boolean)));
  const firstEvent = events[0];
  const lastEvent = events[events.length - 1];

  return {
    eventCount: events.length,
    speakers,
    firstCapturedAt: firstEvent?.capturedAt?.toISOString(),
    lastCapturedAt: lastEvent?.capturedAt?.toISOString(),
  };
}
