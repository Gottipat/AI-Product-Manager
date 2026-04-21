import * as React from 'react';

export function TranscriptUpload(props: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-xl border border-white/[0.08] bg-[#161B26] p-6 shadow-2xl">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-white">Upload Transcript</h2>
          <button 
            onClick={props.onClose}
            className="text-gray-400 hover:text-white"
          >
            ×
          </button>
        </div>
        <p className="text-sm text-gray-400 mb-6">
          Transcript upload functionality is coming soon.
        </p>
        <div className="flex justify-end gap-3">
          <button 
            onClick={props.onClose}
            className="px-4 py-2 rounded border border-white/[0.08] text-white hover:bg-white/[0.05]"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
