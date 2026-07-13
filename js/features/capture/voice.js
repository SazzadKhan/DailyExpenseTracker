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
    { code: 'bn-BD', chip: 'বাং', label: 'Bangla (BD)' },
    // Google's Indian Bengali model — often noticeably more accurate than
    // bn-BD; same script output, so the parser treats both identically.
    { code: 'bn-IN', chip: 'বাং·IN', label: 'Bangla (IN model)' }
];

let inputEl, micBtn, langBtn, hintEl, recognition = null;
let baseText = '';      // input content at the moment recording started
let holding = false;    // pointer/key currently down on the mic
let asking = false;     // consent dialog open
let hintText = '';      // original hint, restored after listening

export function mountVoice(captureInput) {
    inputEl = captureInput;
    const actions = $('#capture-box .capture-actions');
    if (!inputEl || !actions) return;
    hintEl = $('.capture-hint', actions);

    const Rec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (Rec) {
        langBtn = el('button', {
            type: 'button', class: 'cap-voice-lang', id: 'capture-voice-lang',
            title: 'Voice language'
        }, currentLang().chip);
        micBtn = el('button', {
            type: 'button', class: 'cap-voice-mic', id: 'capture-voice-mic',
            title: 'Hold to talk (online voice)',
            'aria-label': 'Hold to talk, online voice', 'aria-pressed': 'false'
        }, '🎤');
        const submit = $('#capture-submit');
        actions.insertBefore(langBtn, submit);
        actions.insertBefore(micBtn, submit);

        // Walkie-talkie: listen only while held. Pointer events cover mouse
        // and touch; capture keeps the release working outside the button.
        on(micBtn, 'pointerdown', onHoldStart);
        on(micBtn, 'pointerup', onHoldEnd);
        on(micBtn, 'pointercancel', onHoldEnd);
        on(micBtn, 'contextmenu', ev => ev.preventDefault()); // long-press menu
        // Keyboard: hold Space/Enter to talk.
        on(micBtn, 'keydown', ev => {
            const e = /** @type {KeyboardEvent} */ (ev);
            if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) { e.preventDefault(); onHoldStart(e); }
        });
        on(micBtn, 'keyup', ev => {
            const e = /** @type {KeyboardEvent} */ (ev);
            if (e.key === ' ' || e.key === 'Enter') onHoldEnd(e);
        });

        on(langBtn, 'click', cycleLang);
    }

    mountKeyboardTip();
}

// ---- option 1: in-app mic (Web Speech, online), hold-to-talk ----------------

async function onHoldStart(ev) {
    if (ev.pointerId != null && micBtn.setPointerCapture) {
        try { micBtn.setPointerCapture(ev.pointerId); } catch { /* fine */ }
    }
    if (holding || recognition || asking) return;
    holding = true;

    if (localStorage.getItem(STORAGE_KEYS.VOICE_CONSENT) !== 'yes') {
        asking = true;
        const ok = await dialogConfirm({
            title: 'Online voice',
            message: 'The in-app mic uses your browser’s speech service — audio is sent to ' +
                'Google/Apple to be turned into text. Your entries and data still stay on your device. ' +
                'For voice that never leaves your phone, use the 🎤 on your keyboard instead.\n\nUse online voice?',
            confirmText: 'Use online voice'
        });
        asking = false;
        holding = false; // finger is long gone — next hold actually listens
        if (ok) localStorage.setItem(STORAGE_KEYS.VOICE_CONSENT, 'yes');
        return;
    }
    startEngine();
}

function onHoldEnd() {
    holding = false;
    if (recognition) {
        // Keep the handlers attached: between stop() and onend the engine
        // flushes its FINAL (most accurate) transcript — dropping handlers
        // here would keep only the rougher interim text.
        try { recognition.stop(); } catch { /* already stopped */ }
    }
    stopPulse();
    setLive(false);
}

/** The engine seam: swap this for a local (Whisper/WASM) engine later. */
function startEngine() {
    const Rec = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new Rec();
    recognition.lang = currentLang().code;
    recognition.continuous = true;       // keep listening for the whole hold
    recognition.interimResults = true;   // live text while speaking
    recognition.maxAlternatives = 1;

    baseText = inputEl.value.trim();
    setLive(true);
    setHint('⏳ Connecting…'); // start() needs ~½s — speaking now gets lost
    startPulse();

    // The recognizer's OWN events drive the animation — no second mic
    // capture (a parallel getUserMedia degrades recognition on many
    // devices), and a pulse here means the engine really registered sound.
    recognition.onaudiostart = () => { setHint('🔴 Listening — speak now'); bumpLevel(0.35); };
    recognition.onsoundstart = () => bumpLevel(0.6);
    recognition.onspeechstart = () => bumpLevel(0.9);

    recognition.onresult = (ev) => {
        bumpLevel(0.55 + Math.random() * 0.4);
        // Finals first, then the freshest interim — never mix stale interims.
        let final = '', interim = '';
        for (let i = 0; i < ev.results.length; i++) {
            const r = ev.results[i];
            if (r.isFinal) final += r[0].transcript + ' ';
            else interim += r[0].transcript + ' ';
        }
        const transcript = (final + interim).replace(/\s+/g, ' ').trim();
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
        } else if (err === 'audio-capture') {
            dialogAlert('No microphone found, or another app is using it.');
        } // 'no-speech' / 'aborted': stop quietly
    };
    recognition.onend = () => {
        // Fires after release (final transcript flushed) or on its own after
        // silence mid-hold — either way, tear down and hand back the input.
        stopRecording();
        inputEl.focus(); // review, then Log it — never auto-submit
    };

    try { recognition.start(); }
    catch { stopRecording(); }
}

function stopRecording() {
    if (recognition) {
        recognition.onresult = recognition.onerror = recognition.onend = null;
        recognition.onaudiostart = recognition.onsoundstart = recognition.onspeechstart = null;
        try { recognition.stop(); } catch { /* already stopped */ }
        recognition = null;
    }
    stopPulse();
    setLive(false);
}

function setLive(live) {
    if (!micBtn) return;
    micBtn.classList.toggle('cap-mic-live', live);
    micBtn.setAttribute('aria-pressed', String(live));
    micBtn.title = live ? 'Listening — release to stop' : 'Hold to talk (online voice)';
    if (!live) setHint(null);
}

function setHint(text) {
    if (!hintEl) return;
    if (text != null) {
        if (!hintText) hintText = hintEl.textContent;
        hintEl.textContent = text;
    } else if (hintText) {
        hintEl.textContent = hintText;
        hintText = '';
    }
}

// ---- activity pulse ----------------------------------------------------------
// Drives the button's --mic-level property from the RECOGNIZER's events
// (audiostart/soundstart/speechstart/result): a bump means the engine really
// registered sound. Deliberately no second getUserMedia stream — a parallel
// capture degrades or breaks recognition on many devices.

let pulse = null; // rAF id
let level = 0;

function bumpLevel(v) {
    level = Math.max(level, Math.min(1, v));
}

function startPulse() {
    level = 0;
    const tick = () => {
        level *= 0.92; // decay between events
        micBtn.style.setProperty('--mic-level', level.toFixed(3));
        pulse = requestAnimationFrame(tick);
    };
    if (!pulse) pulse = requestAnimationFrame(tick);
}

function stopPulse() {
    if (pulse) cancelAnimationFrame(pulse);
    pulse = null;
    level = 0;
    if (micBtn) micBtn.style.setProperty('--mic-level', '0');
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
