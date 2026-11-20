const VOICE_LANGUAGES = {
  en: ['en-ph', 'en'],
  fil: ['fil', 'tl'],
  bis: ['ceb'],
};

export function speechSupported() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

export function voiceFor(language) {
  if (!speechSupported()) {
    return null;
  }
  const voices = window.speechSynthesis.getVoices();
  for (const prefix of VOICE_LANGUAGES[language] ?? []) {
    const match = voices.find((voice) =>
      voice.lang.toLowerCase().replace('_', '-').startsWith(prefix),
    );
    if (match) {
      return match;
    }
  }
  return null;
}

export function speak(text, voice) {
  stopSpeaking();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.voice = voice;
  utterance.lang = voice.lang;
  utterance.rate = 0.9;
  window.speechSynthesis.speak(utterance);
}

export function stopSpeaking() {
  if (speechSupported()) {
    window.speechSynthesis.cancel();
  }
}

export function onVoicesChanged(callback) {
  if (!speechSupported()) {
    return () => { };
  }
  window.speechSynthesis.addEventListener('voiceschanged', callback);
  return () => window.speechSynthesis.removeEventListener('voiceschanged', callback);
}
