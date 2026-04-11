import 'dotenv/config';
import { DeepgramClient, ListenV1Model, ListenV1Encoding } from '@deepgram/sdk';
async function test() {
  const deepgram = new DeepgramClient();
  const conn = deepgram.listen.live({ 
      model: "nova-3",
      encoding: "linear16",
      sample_rate: 16000,
      channels: 1
  });
  console.log('KEYS', Object.keys(conn));
  process.exit();
}
test();
