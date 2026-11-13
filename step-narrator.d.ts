// Type definitions for step-narrator 1.3
// https://github.com/k3nnyw0lf/step-narrator

declare namespace StepNarrator {
  /** One thing to read: a recorded clip, the text for the browser voice, or both (the text is the fallback). */
  interface Item {
    text?: string;
    /** Address of a recorded clip. If it fails to load, the text is read instead. */
    audio?: string;
    /** Language of this item, like 'en', 'es' or 'fr-CA'. Default: the language from setLang(). */
    lang?: string;
  }

  interface Options {
    /** Speed of the browser voice, 0.1 to 10. Default 0.95. */
    rate?: number;
    /** Pitch of the browser voice, 0 to 2. Default 1. */
    pitch?: number;
    /** Volume of the voice and the clips, 0 to 1. Default 1. */
    volume?: number;
    /** Language for the next sentences, like 'en', 'es' or 'fr-CA'. */
    lang?: string;
    /** Which region a short code means. Default { en: 'en-US', es: 'es-US' }. */
    regions?: Record<string, string>;
    /** Where the visitor's on/off choice is saved in localStorage. Default 'stepNarrator.on'. */
    storageKey?: string;
    /** false = never save or read the visitor's choice. Default true. */
    remember?: boolean;
    /** true = only use voices that run on the device. Default false. */
    localOnly?: boolean;
    /** Start on for visitors who never chose. Default false. */
    defaultOn?: boolean;
    /** Pick the voice yourself. Return null to let step-narrator pick. */
    voice?: ((voices: SpeechSynthesisVoice[], lang: string) => SpeechSynthesisVoice | null | undefined) | null;
  }

  interface Api {
    /** The browser can speak or play a clip. */
    readonly supported: boolean;
    /** The browser has a voice (Web Speech API). */
    readonly canSpeak: boolean;
    /** The browser can play audio files. */
    readonly canPlay: boolean;
    configure(options: Options): Api;
    /** Make a button the on/off switch. Pass { clips: true } if you use recorded clips. */
    bind(button: HTMLElement, options?: { clips?: boolean }): void;
    unbind(button: HTMLElement): void;
    toggle(): void;
    setOn(on: boolean): void;
    isOn(): boolean;
    setDefault(on: boolean): void;
    setLang(lang: string): void;
    setLocalOnly(on: boolean): void;
    /** Read now, replacing anything still playing. Does nothing while off. */
    say(text: string, options?: { audio?: string; lang?: string }): void;
    sayAll(items: Item[]): void;
    stop(): void;
    onChange(fn: (on: boolean) => void): void;
    /** Read [data-narrate] elements when they appear. Default container: the whole page. */
    watch(container?: Element): void;
    unwatch(): void;
  }
}

declare const StepNarrator: StepNarrator.Api;
export = StepNarrator;

declare global {
  interface Window {
    StepNarrator: StepNarrator.Api;
  }
}
