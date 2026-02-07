# Current Sprint Focus

## ✅ Completed

### AI Backend (Sashank)

- ✅ Database schema complete (7 tables, 140 tests)
- ✅ All CRUD repositories implemented
- ✅ API routes for meetings, transcripts, MoM, meeting items
- ✅ OpenAI integration with structured outputs
- ✅ MoM generation pipeline (executive summary, highlights, action items)
- ✅ Action item extraction (14 types)
- ✅ RAG service with embeddings
- ✅ Full test coverage (140 tests passing)
- ✅ Enterprise documentation

## In Progress

### Bot Runner (Gottipat)

- [ ] Implement Playwright browser launch
- [ ] Google Meet join flow
- [ ] Caption DOM parsing
- [ ] **Streaming client to AI Backend** ← Ready for integration!

## Ready for Integration

The AI Backend is fully operational. Bot Runner can now:

1. **POST transcripts** to `/api/v1/meetings/:id/transcripts/batch`
2. **Trigger AI processing** via `/api/v1/meetings/:id/generate-mom`
3. **Poll progress** via `/api/v1/meetings/:id/ai-status`
4. **Retrieve MoM** via `/api/v1/meetings/:id/mom`

See [API.md](./API.md) for detailed endpoint specs.

## Blocked / Needs Discussion

- ~~Database schema design~~ ✅ Complete
- Vector store selection for RAG (currently in-memory, pgvector ready)
- Authentication strategy

## Notes

- AI Backend tested with live OpenAI API ✅
- All 14 action item types working
- Embeddings generating correctly (1536 dimensions)
