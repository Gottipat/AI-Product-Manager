/**
 * @fileoverview AudioWorklet Processor — PCM Int16 Converter
 * @description Runs on the audio rendering thread. Receives Float32 audio samples,
 *   converts them to Int16 PCM, and posts them to the main thread via port.
 */

class PcmProcessor extends AudioWorkletProcessor {
    process(inputs) {
        const input = inputs[0];
        if (!input || input.length === 0 || !input[0]) return true;

        const float32Data = input[0]; // channel 0 (mono)

        // Convert Float32 [-1.0, 1.0] → Int16 [-32768, 32767]
        const int16Data = new Int16Array(float32Data.length);
        for (let i = 0; i < float32Data.length; i++) {
            const s = Math.max(-1, Math.min(1, float32Data[i]));
            int16Data[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }

        // Post the PCM buffer to the main thread
        this.port.postMessage(int16Data.buffer, [int16Data.buffer]);

        return true; // keep processor alive
    }
}

registerProcessor('pcm-processor', PcmProcessor);
