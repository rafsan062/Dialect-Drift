/** Web Speech API playback (mockup-style placeholder). */

const RATES = { south: 0.86, midwest: 0.94, northeast: 1.02, west: 1.0 };
const PITCHES = { south: 0.9, midwest: 1.0, northeast: 1.06, west: 1.0 };

export function speakWord(word, wave = "west", index = 0) {
  if (!("speechSynthesis" in window)) return;
  speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(word);
  utterance.lang = "en-US";
  utterance.rate = RATES[wave] ?? [0.92, 1.0, 0.86, 1.08][index % 4];
  utterance.pitch = PITCHES[wave] ?? [0.95, 1.03, 0.9, 1.08][index % 4];
  speechSynthesis.speak(utterance);
}

export function escapeForJs(text) {
  return text.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}
