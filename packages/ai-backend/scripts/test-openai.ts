/**
 * Integration test for OpenAI API connection
 * Run with: npx tsx scripts/test-openai.ts
 */

import 'dotenv/config';
import { OpenAIService } from '../src/services/openai.service.js';

const sampleTranscript = `
John: Good morning everyone, let's start our sprint planning.
Sarah: Sure. First, I want to update on the dashboard feature - it's 80% complete.
John: Great progress! When do you expect to finish?
Sarah: By Thursday. But I'm blocked on the API integration, waiting for Mike's backend changes.
Mike: I'll have those ready by tomorrow afternoon. I also need to flag that we have a risk - 
the database migration for the new schema is more complex than expected.
John: Okay, let's discuss that. What's the impact?
Mike: It could delay the release by 2 days if we hit issues.
Sarah: I suggest we add a buffer to the timeline. Also, I had an idea - 
what if we implement a caching layer? It could improve performance by 40%.
John: That's a good idea. Let's add it to the backlog. Decision made: we'll proceed with the 
current plan but add 2 days buffer for the migration.
Sarah: Perfect. My action item is to complete the dashboard by Thursday.
Mike: And I'll have the API changes ready by tomorrow 3pm.
John: Alright, let's meet again Friday to review. Meeting adjourned.
`;

async function main() {
  console.log('\n🚀 Testing OpenAI API Connection\n');
  console.log('━'.repeat(60));

  const service = new OpenAIService();

  try {
    // Test 1: Executive Summary
    console.log('\n📋 Test 1: Generating Executive Summary...');
    const startSummary = Date.now();
    const summary = await service.generateExecutiveSummary(sampleTranscript);
    console.log(`   ✅ Completed in ${Date.now() - startSummary}ms`);
    console.log('   Summary:', summary.summary);
    console.log('   Topics:', summary.mainTopics.join(', '));
    console.log('   Sentiment:', summary.sentiment);

    // Test 2: Action Items
    console.log('\n📝 Test 2: Extracting Action Items...');
    const startItems = Date.now();
    const items = await service.extractActionItems(sampleTranscript);
    console.log(`   ✅ Completed in ${Date.now() - startItems}ms`);
    console.log(`   Found ${items.length} items:`);
    items.forEach((item, i) => {
      console.log(
        `   ${i + 1}. [${item.itemType}] ${item.title}${item.assignee ? ` → ${item.assignee}` : ''}`
      );
    });

    // Test 3: Highlights
    console.log('\n✨ Test 3: Extracting Highlights...');
    const startHighlights = Date.now();
    const highlights = await service.extractHighlights(sampleTranscript);
    console.log(`   ✅ Completed in ${Date.now() - startHighlights}ms`);
    console.log(`   Found ${highlights.length} highlights:`);
    highlights.slice(0, 3).forEach((h, i) => {
      console.log(`   ${i + 1}. [${h.highlightType}] ${h.content.substring(0, 60)}...`);
    });

    // Test 4: Embedding
    console.log('\n🔢 Test 4: Generating Embedding...');
    const startEmbed = Date.now();
    const embedding = await service.generateEmbedding('dashboard feature progress update');
    console.log(`   ✅ Completed in ${Date.now() - startEmbed}ms`);
    console.log(`   Embedding dimensions: ${embedding.length}`);

    console.log('\n' + '━'.repeat(60));
    console.log('🎉 All tests passed! OpenAI API is working correctly.');
    console.log('━'.repeat(60) + '\n');
  } catch (error) {
    console.error('\n❌ Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();
