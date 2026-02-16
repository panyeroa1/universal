export enum CallState {
  LOBBY = 'LOBBY',
  CONNECTING = 'CONNECTING',
  ACTIVE = 'ACTIVE',
  ENDED = 'ENDED'
}

export enum TranslationMode {
  CONVERSATION = 'CONVERSATION', // AI acts as a participant
  TRANSLATOR = 'TRANSLATOR' // AI acts as a translator (repeats what you say in target lang)
}

export interface Language {
  code: string;
  name: string;
  voiceName: string; // Gemini voice mapping
}

export interface TranscriptionItem {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: number;
  isFinal: boolean;
}

export interface AudioVisualizerData {
  volume: number; // 0 to 1
}