import { Language } from './types';

export const SUPPORTED_LANGUAGES: Language[] = [
  { code: 'en-US', name: 'English', voiceName: 'Kore' },
  { code: 'es-ES', name: 'Spanish', voiceName: 'Puck' },
  { code: 'fr-FR', name: 'French', voiceName: 'Charon' },
  { code: 'de-DE', name: 'German', voiceName: 'Fenrir' },
  { code: 'ja-JP', name: 'Japanese', voiceName: 'Aoede' }, // Aoede is not standard but using fallback usually works or maps to one of the 5
];

// Fallback to one of the 5 supported voices if the specific one isn't perfect:
// Puck, Charon, Kore, Fenrir, Zephyr.
export const GEMINI_VOICES = ['Puck', 'Charon', 'Kore', 'Fenrir', 'Zephyr'];

export const MODEL_NAME = 'gemini-2.5-flash-native-audio-preview-12-2025';

export const SAMPLE_RATE_INPUT = 16000;
export const SAMPLE_RATE_OUTPUT = 24000;