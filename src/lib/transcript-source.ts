export type TranscriptHandlers = {
  onFinal: (text: string) => void;
  onInterim: (text: string) => void;
  onEnd: () => void;
  onError: (message: string) => void;
};

export interface TranscriptSource {
  readonly supported: boolean;
  start(handlers: TranscriptHandlers): void;
  stop(): void;
}

type RecognitionAlternative = { transcript: string };
type RecognitionResult = { isFinal: boolean; 0: RecognitionAlternative };
type RecognitionResultList = { length: number; [index: number]: RecognitionResult };
type RecognitionEvent = Event & { resultIndex: number; results: RecognitionResultList };
type RecognitionErrorEvent = Event & { error: string };
type BrowserRecognition = {
  continuous: boolean; interimResults: boolean; lang: string;
  onresult: ((event: RecognitionEvent) => void) | null;
  onerror: ((event: RecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start(): void; stop(): void;
};
type RecognitionConstructor = new () => BrowserRecognition;

declare global { interface Window { SpeechRecognition?: RecognitionConstructor; webkitSpeechRecognition?: RecognitionConstructor; } }

export class WebSpeechTranscriptSource implements TranscriptSource {
  private recognition: BrowserRecognition | null = null;
  private handlers: TranscriptHandlers | null = null;
  readonly supported = typeof window !== "undefined" && Boolean(window.SpeechRecognition ?? window.webkitSpeechRecognition);

  start(handlers: TranscriptHandlers) {
    this.handlers = handlers;
    const Recognition = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!Recognition) { handlers.onError("Speech recognition is not supported here. Try typed input in Chrome desktop."); return; }
    this.recognition = new Recognition(); this.recognition.continuous = true; this.recognition.interimResults = true; this.recognition.lang = "en-US";
    this.recognition.onresult = (event) => {
      let interim = "";
      for (let index = event.resultIndex; index < event.results.length; index += 1) { const result = event.results[index]; if (result.isFinal) handlers.onFinal(result[0].transcript.trim()); else interim += result[0].transcript; }
      handlers.onInterim(interim.trim());
    };
    this.recognition.onerror = (event) => handlers.onError(event.error === "not-allowed" || event.error === "service-not-allowed" ? "Microphone access was denied. Switched to typed input." : `Speech recognition error: ${event.error}. Try typed input.`);
    this.recognition.onend = () => handlers.onEnd();
    this.recognition.start();
  }

  stop() { this.handlers = null; this.recognition?.stop(); this.recognition = null; }
}
