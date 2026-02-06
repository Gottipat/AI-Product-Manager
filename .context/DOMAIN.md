# Domain Knowledge

## Transcript Processing

### Data Flow
1. Google Meet shows captions in DOM
2. Bot parses captions with speaker attribution
3. Events buffered into batches (5 sec / 50 events max)
4. Batches streamed to AI Backend via WebSocket/HTTP
5. Backend stores and processes for extraction

### Transcript Event
```typescript
interface TranscriptEvent {
  id: string;
  meetingId: string;
  speaker: string;        // Display name
  speakerId?: string;     // Unique ID if available
  text: string;
  timestamp: string;      // ISO 8601
  sequenceNumber: number; // For ordering
  isFinal: boolean;       // Final vs interim
}
```

## Meeting Lifecycle

```
SCHEDULED → BOT_JOINING → IN_PROGRESS → COMPLETED
                            ↓
                          ERROR
```

## Minutes of Meeting (MoM)

AI-generated outputs:
- **Summary**: Executive overview
- **Discussion Topics**: Grouped by subject
- **Key Decisions**: With rationale
- **Action Items**: Assigned with due dates
- **Attendance**: Who was present and when

## Longitudinal Analysis

Track action items across recurring meetings:
- Progress updates per meeting
- Completion rates
- Trend identification
- Accountability tracking

## RAG System

- Index transcripts for semantic search
- Retrieve relevant context for queries
- Support cross-meeting analysis
