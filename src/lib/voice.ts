'use client';

let current: HTMLAudioElement | null = null;
let currentUrl: string | null = null;
let cloudVoiceAvailable = true;

export function stopSpeaking(): void {
  if (current) {
    current.pause();
    current = null;
  }
  if (currentUrl) {
    URL.revokeObjectURL(currentUrl);
    currentUrl = null;
  }
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}

function speakLocally(text: string): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      resolve();
      return;
    }
    const utter = new SpeechSynthesisUtterance(text);
    utter.pitch = 0.55;
    utter.rate = 0.88;
    utter.onend = () => resolve();
    utter.onerror = () => resolve();
    window.speechSynthesis.speak(utter);
  });
}

/**
 * Voices the ghost through /api/voice (ElevenLabs, when the server has a key),
 * falling back to the browser's built-in speech synthesis.
 */
export async function speak(text: string): Promise<void> {
  stopSpeaking();
  if (cloudVoiceAvailable) {
    try {
      const res = await fetch('/api/voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      if (res.status === 501) {
        cloudVoiceAvailable = false;
      } else if (res.ok) {
        const blob = await res.blob();
        currentUrl = URL.createObjectURL(blob);
        const audio = new Audio(currentUrl);
        current = audio;
        await new Promise<void>((resolve) => {
          audio.onended = () => resolve();
          audio.onerror = () => resolve();
          audio.onpause = () => resolve();
          void audio.play().catch(() => resolve());
        });
        return;
      }
    } catch {
      // fall through to local speech
    }
  }
  await speakLocally(text);
}
