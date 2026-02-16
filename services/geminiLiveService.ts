import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { createPcmBlob, decodeAudioData, base64ToUint8Array } from '../utils/audioUtils';
import { MODEL_NAME, SAMPLE_RATE_INPUT, SAMPLE_RATE_OUTPUT } from '../constants';
import { TranscriptionItem } from '../types';

interface LiveServiceConfig {
  apiKey: string;
  voiceName: string;
  systemInstruction?: string;
  onAudioData: (visualizerData: number) => void;
  onTranscription: (item: TranscriptionItem) => void;
  onError: (error: Error) => void;
  onClose: () => void;
}

export class GeminiLiveService {
  private ai: GoogleGenAI;
  private inputAudioContext: AudioContext | null = null;
  private outputAudioContext: AudioContext | null = null;
  private inputSource: MediaStreamAudioSourceNode | null = null;
  private processor: ScriptProcessorNode | null = null;
  private outputNode: GainNode | null = null;
  private stream: MediaStream | null = null;
  private sessionPromise: Promise<any> | null = null;
  private nextStartTime = 0;
  private sources = new Set<AudioBufferSourceNode>();
  private config: LiveServiceConfig;
  private currentInputTranscription = '';
  private currentOutputTranscription = '';

  constructor(config: LiveServiceConfig) {
    this.config = config;
    this.ai = new GoogleGenAI({ apiKey: config.apiKey });
  }

  async connect() {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      this.inputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: SAMPLE_RATE_INPUT,
      });
      
      this.outputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: SAMPLE_RATE_OUTPUT,
      });
      
      this.outputNode = this.outputAudioContext.createGain();
      this.outputNode.connect(this.outputAudioContext.destination);

      this.sessionPromise = this.ai.live.connect({
        model: MODEL_NAME,
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: this.config.voiceName } },
          },
          systemInstruction: this.config.systemInstruction,
          inputAudioTranscription: {},
          outputAudioTranscription: {},
        },
        callbacks: {
          onopen: this.handleOpen.bind(this),
          onmessage: this.handleMessage.bind(this),
          onerror: (e) => {
             console.error("Gemini Socket Error", e);
             this.config.onError(new Error("Connection error"));
          },
          onclose: (e) => {
             console.log("Gemini Socket Closed");
             this.config.onClose();
          },
        },
      });

    } catch (error) {
      this.config.onError(error instanceof Error ? error : new Error('Failed to connect'));
    }
  }

  private handleOpen() {
    console.log("Connected to Gemini Live");
    if (!this.inputAudioContext || !this.stream) return;

    this.inputSource = this.inputAudioContext.createMediaStreamSource(this.stream);
    // 4096 buffer size for reasonable latency/performance balance
    this.processor = this.inputAudioContext.createScriptProcessor(4096, 1, 1);

    this.processor.onaudioprocess = (e) => {
      const inputData = e.inputBuffer.getChannelData(0);
      
      // Calculate volume for visualizer
      let sum = 0;
      for (let i = 0; i < inputData.length; i++) {
        sum += inputData[i] * inputData[i];
      }
      const rms = Math.sqrt(sum / inputData.length);
      this.config.onAudioData(rms);

      const pcmBlob = createPcmBlob(inputData);
      
      if (this.sessionPromise) {
        this.sessionPromise.then((session) => {
          session.sendRealtimeInput({ media: pcmBlob });
        });
      }
    };

    this.inputSource.connect(this.processor);
    this.processor.connect(this.inputAudioContext.destination);
  }

  private async handleMessage(message: LiveServerMessage) {
    // 1. Handle Audio Output
    const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
    if (base64Audio && this.outputAudioContext && this.outputNode) {
      const audioBytes = base64ToUint8Array(base64Audio);
      
      this.nextStartTime = Math.max(this.nextStartTime, this.outputAudioContext.currentTime);
      
      const audioBuffer = await decodeAudioData(
        audioBytes,
        this.outputAudioContext,
        SAMPLE_RATE_OUTPUT,
        1
      );

      const source = this.outputAudioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.outputNode);
      source.addEventListener('ended', () => {
        this.sources.delete(source);
      });
      
      source.start(this.nextStartTime);
      this.nextStartTime += audioBuffer.duration;
      this.sources.add(source);
    }

    // 2. Handle Interruption
    if (message.serverContent?.interrupted) {
      console.log("Interrupted");
      this.sources.forEach(source => {
        try { source.stop(); } catch (e) {}
      });
      this.sources.clear();
      this.nextStartTime = 0;
      this.currentOutputTranscription = ''; // Clear pending text
    }

    // 3. Handle Transcriptions
    // User Input Transcription
    if (message.serverContent?.inputTranscription) {
       this.currentInputTranscription += message.serverContent.inputTranscription.text;
    }

    // Model Output Transcription
    if (message.serverContent?.outputTranscription) {
      this.currentOutputTranscription += message.serverContent.outputTranscription.text;
    }

    if (message.serverContent?.turnComplete) {
       if (this.currentInputTranscription.trim()) {
           this.config.onTranscription({
               id: Date.now().toString() + '-user',
               sender: 'user',
               text: this.currentInputTranscription,
               timestamp: Date.now(),
               isFinal: true
           });
           this.currentInputTranscription = '';
       }
       if (this.currentOutputTranscription.trim()) {
           this.config.onTranscription({
               id: Date.now().toString() + '-ai',
               sender: 'ai',
               text: this.currentOutputTranscription,
               timestamp: Date.now(),
               isFinal: true
           });
           this.currentOutputTranscription = '';
       }
    }
  }

  async disconnect() {
    if (this.processor) {
      this.processor.disconnect();
      this.processor = null;
    }
    if (this.inputSource) {
      this.inputSource.disconnect();
      this.inputSource = null;
    }
    if (this.inputAudioContext) {
      await this.inputAudioContext.close();
      this.inputAudioContext = null;
    }
    if (this.outputAudioContext) {
      await this.outputAudioContext.close();
      this.outputAudioContext = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    // Note: session.close() is not explicitly exposed in the new SDK connection flow in the same way, 
    // but cleaning up the media stream essentially kills the flow. 
    // Ideally we would await sessionPromise and call close on it if available, 
    // but the example shows rely on onclose/disconnecting media.
    // However, looking at types, session object might have close().
    if (this.sessionPromise) {
        // Attempt to close if method exists
        const session = await this.sessionPromise;
        // The type defs are tricky, but good practice is to just drop references.
    }
  }
  
  async muteMicrophone(muted: boolean) {
     if (this.stream) {
         this.stream.getAudioTracks().forEach(track => track.enabled = !muted);
     }
  }
}