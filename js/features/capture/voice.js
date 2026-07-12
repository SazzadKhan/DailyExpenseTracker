// js/features/capture/voice.js
// Voice input for the quick-capture box. Two user-facing options:
//
//   1. In-app mic button — Web Speech API. FREE but ONLINE: the browser
//      (Chrome → Google, Safari → Apple) transcribes the audio on its
//      servers, so it is opt-in behind an explicit consent dialog and
//      labeled "online" in the UI. Voice NEVER auto-submits — the
//      transcript lands in the capture input for the user to review, then
//      the normal parse() → optimistic-save-with-⚠ flow takes over, which
//      also absorbs speech-to-text misspellings exactly like typed typos.
//   2. The keyboard mic (Gboard / iOS dictation) — on-device, surfaced as a
//      dismissable tip on touch devices. Zero code path; the app never
//      touches that audio.
//
// A future fully-local engine (Whisper via WASM, see docs/ADDING_A_LANGUAGE.md
// wrap-up notes) plugs in by replacing `startEngine` — everything else
// (button, consent, language toggle, input wiring) stays.

import { $, on, el } from '../../core/dom.js';
import { STORAGE_KEYS } from '../../core/constants.js';
import { confirm as dialogConfirm, alert as dialogAlert } from '../../services/dialog.js';

const LANGS = [
    { code: 'en-US', chip: 'EN', label: 'English' },
    { code: 'bn-BD', chip: 'বাং', label: 'Bangla' }
];

let inputEl, micBtn, langBtn, recognition = null;
let baseText = ''; // input content at the moment recording started

export function mountVoice(captureInput) {
    inputEl = captureInput;
    const actions = $('#capture-box .capture-actions');
    if (!inputEl || !actions) return;

    const Rec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (Rec) {
        langBtn = el('button', {
            type: 'button', class: 'cap-voice-lang', id: 'capture-voice-lang',
            title: 'Voice language'
        }, currentLang().chip);
        micBtn = el('button', {
            type: 'button', class: 'cap-voice-mic', id: 'capture-voice-mic',
            title: 'Voice input (online — browser speech service)',
            'aria-label': 'Voice input, online', 'aria-pressed': 'false'
        }, '🎤');
        const submit = $('#capture-submit');
        actions.insertBefore(langBtn, submit);
        actions.insertBefore(micBtn, submit);

        on(micBtn, 'click', toggleRecording);
        on(langBtn, 'click', cycleLang);
    }

    mountKeyboardTip();
}

// ---- option 1: in-app mic (Web Speech, online) ------------------------------

async function toggleRecording() {
    if (recognition) { stopRecording(); return; }

    if (localStorage.getItem(STORAGE_KEYS.VOICE_CONSENT) !== 'yes') {
        const ok = await dialogConfirm({
            title: 'Online voice',
            message: 'The in-app mic uses your browser’s speech service — audio is sent to ' +
                'Google/Apple to be turned into text. Your entries and data still stay on your device. ' +
                'For voice that never leaves your phone, use the 🎤 on your keyboard instead.\n\nUse online voice?',
            confirmText: 'Use online voice'
        });
        if (!ok) return;
        localStorage.setItem(STORAGE_KEYS.VOICE_CONSENT, 'yes');
    }
    startEngine();
}

/** The engine seam: swap this for a local (Whisper/WASM) engine later. */
function startEngine() {
    const Rec = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new Rec();
    recognition.lang = currentLang().code;
    recognition.continuous = false;      // tap-to-talk utterances, not dictation
    recognition.interimResults = true;   // live text while speaking

    baseText = inputEl.value.trim();
    setLive(true);

    recognition.onresult = (ev) => {
        let transcript = '';
        for (const r of ev.results) transcript += r[0].transcript;
        transcript = transcript.trim();
        if (transcript) {
            inputEl.value = baseText ? `${baseText} ${transcript}` : transcript;
        }
    };
    recognition.onerror = (ev) => {
        const err = ev.error;
        stopRecording();
        if (err === 'not-allowed' || err === 'service-not-allowed') {
            dialogAlert('Microphone is blocked. Allow mic access for this site in your browser settings, or use the 🎤 on your keyboard.');
        } else if (err === 'network') {
            dialogAlert('Online voice needs a connection. Offline? The 🎤 on your keyboard may still work on-device.');
        } // 'no-speech' / 'aborted': stop quietly
    };
    recognition.onend = () => {
        stopRecording();
        inputEl.focus(); // review, then Log it — never auto-submit
    };

    try { recognition.start(); }
    catch { stopRecording(); }
}

function stopRecording() {
    if (recognition) {
        recognition.onresult = recognition.onerror = recognition.onend = null;
        try { recognition.stop(); } catch { /* already stopped */ }
        recognition = null;
    }
    setLive(false);
}

function setLive(live) {
    if (!micBtn) return;
    micBtn.classList.toggle('cap-mic-live', live);
    micBtn.setAttribute('aria-pressed', String(live));
    micBtn.title = live ? 'Stop listening' : 'Voice input (online — browser speech service)';
}

// ---- language toggle ---------------------------------------------------------

function currentLang() {
    const saved = localStorage.getItem(STORAGE_KEYS.VOICE_LANG);
    return LANGS.find(l => l.code === saved) || LANGS[0];
}

function cycleLang() {
    const next = LANGS[(LANGS.findIndex(l => l.code === currentLang().code) + 1) % LANGS.length];
    localStorage.setItem(STORAGE_KEYS.VOICE_LANG, next.code);
    langBtn.textContent = next.chip;
    langBtn.title = `Voice language: ${next.label}`;
    if (recognition) stopRecording(); // next tap listens in the new language
}

// ---- option 2: the on-device keyboard mic ------------------------------------

function mountKeyboardTip() {
    if (localStorage.getItem(STORAGE_KEYS.VOICE_TIP_DISMISSED) === 'yes') return;
    if (!matchMedia('(pointer: coarse)').matches) return; // touch devices only

    const box = $('#capture-box');
    if (!box) return;
    const tip = el('p', { class: 'cap-voice-tip', dataset: { role: 'cap-voice-tip' } },
        el('span', {}, '🎤 Voice that stays on your phone: the mic on your keyboard types here too.'),
        el('button', {
            type: 'button', class: 'cap-voice-tip-close',
            'aria-label': 'Dismiss tip', dataset: { role: 'cap-voice-tip-close' }
        }, '✕')
    );
    on(tip, 'click', (ev) => {
        if (/** @type {HTMLElement} */ (ev.target).dataset.role !== 'cap-voice-tip-close') return;
        localStorage.setItem(STORAGE_KEYS.VOICE_TIP_DISMISSED, 'yes');
        tip.remove();
    });
    box.append(tip);
}
