// js/features/assistant/index.js
// XpenseBot — in-app chat assistant. Floating button + slide-up panel.
// Engine: rule-based parser by default; LLM when an API key is saved.
//
// Clarification policy: the bot never asks follow-up questions. Every parse
// renders a preview with per-row checkboxes — confirm/adjust/cancel is the
// one and only interaction. Chat history is in-memory on purpose (ephemeral
// UI state; the store is for domain state).

import { $, $$, on, delegate, el, setVisible } from '../../core/dom.js';
import { store } from '../../core/store.js';
import { STORAGE_KEYS } from '../../core/constants.js';
import { getLocalDateString, formatDate, formatCurrency } from '../../core/format.js';
import { commitEntries } from './commit-entries.js';
import { parse } from './parser.js';
import { extractWithLLM } from './engine-llm.js';
import { DEFAULT_MODELS } from './providers.js';
import { startTrialIfNeeded, getEntitlement, activateLicense, TRIAL_DAYS } from './entitlement.js';
import { logInteraction, markOutcome } from './audit-log.js';
import { mountAssistantSettings, getAssistantConfig } from './settings.js';
import { mascotIcon } from './mascot.js';

let panelEl, bannerEl, messagesEl, inputEl, sendEl;
let seq = 0;
let introShown = false;
let lockShown = false;
const pending = new Map(); // previewId -> { entries, logId }

export function mount() {
    const fab = $('#xpensebot-fab');
    panelEl = $('#xpensebot-panel');
    bannerEl = $('#xpensebot-banner');
    messagesEl = $('#xpensebot-messages');
    inputEl = $('#xpensebot-input');
    sendEl = $('#xpensebot-send');
    const closeBtn = $('#xpensebot-close');
    if (!fab || !panelEl || !bannerEl || !messagesEl || !inputEl || !sendEl) return;

    fab.append(mascotIcon('xbot-mascot-fab'));
    const titleMascotSlot = $('#xpensebot-title-mascot');
    if (titleMascotSlot) titleMascotSlot.prepend(mascotIcon('xbot-mascot-header'));

    mountAssistantSettings();

    on(fab, 'click', openPanel);
    on(closeBtn, 'click', () => setVisible(panelEl, false));
    on(document, 'keydown', ev => {
        if (/** @type {KeyboardEvent} */ (ev).key === 'Escape' && !panelEl.hasAttribute('hidden')) {
            setVisible(panelEl, false);
        }
    });
    on(sendEl, 'click', handleSend);
    on(inputEl, 'keydown', ev => {
        if (/** @type {KeyboardEvent} */ (ev).key === 'Enter') handleSend();
    });

    delegate(messagesEl, 'click', '[data-role="confirm-add"]', onConfirm);
    delegate(messagesEl, 'click', '[data-role="cancel-add"]', onCancel);
    delegate(messagesEl, 'click', '[data-role="activate-license"]', onActivate);
}

// ---- panel lifecycle -------------------------------------------------------

function openPanel() {
    startTrialIfNeeded();
    renderBanner();
    setVisible(panelEl, true);
    if (!introShown) {
        introShown = true;
        if (isFirstEverOpen()) {
            showOnboardingTour();
            markOnboarded();
        } else {
            addBubble('bot',
                el('p', {}, 'Hi! Tell me what you spent and I’ll log it — try:'),
                el('p', {}, el('em', {}, 'lunch 150, rickshaw 40, tea 20 yesterday')),
                el('p', { class: 'xbot-note' },
                    'One date word applies to the whole message. I use your currency and today’s date unless you say otherwise, and I always ask you to confirm before saving.')
            );
        }
    }
    if (ensureUnlocked()) inputEl.focus();
}

function isFirstEverOpen() {
    try {
        return !localStorage.getItem(STORAGE_KEYS.ASSISTANT_ONBOARDED);
    } catch (_) {
        return false;
    }
}

function markOnboarded() {
    try {
        localStorage.setItem(STORAGE_KEYS.ASSISTANT_ONBOARDED, '1');
    } catch (_) { /* storage unavailable — tour just replays next time */ }
}

/** One-time first-open tour: how to log, how confirm works, where budget/categories live. */
function showOnboardingTour() {
    addBubble('bot',
        el('p', {}, 'Hi, I’m XpenseBot 👋 — type what you spent in plain language and I’ll turn it into an entry. Try:'),
        el('p', {}, el('em', {}, 'lunch 150, rickshaw 40, tea 20 yesterday'))
    );
    addBubble('bot',
        el('p', {}, 'I’ll show you a preview before saving anything — untick a row to skip it, then hit Add. I never save without your confirm.')
    );
    addBubble('bot',
        el('p', {}, 'Categories, budget, and theme live in Settings (⚙️) outside this panel — I just handle logging.')
    );
}

function renderBanner() {
    const ent = getEntitlement();
    bannerEl.className = '';
    if (ent.status === 'pro') {
        bannerEl.classList.add('xbot-banner-pro');
        bannerEl.textContent = '⭐ Pro';
    } else if (ent.status === 'trial') {
        bannerEl.textContent = `🎁 Free trial — ${ent.daysLeft} day${ent.daysLeft === 1 ? '' : 's'} left`;
    } else {
        bannerEl.classList.add('xbot-banner-expired');
        bannerEl.textContent = '🔒 Trial ended — XpenseBot is a Pro feature';
    }
}

/** True when the bot may be used; otherwise shows the lock card once. */
function ensureUnlocked() {
    const ent = getEntitlement();
    if (ent.status !== 'expired') {
        setComposerEnabled(true);
        return true;
    }
    setComposerEnabled(false);
    if (!lockShown) {
        lockShown = true;
        addBubble('bot',
            el('p', {}, `Your ${TRIAL_DAYS}-day free trial has ended. Enter a license key to keep using XpenseBot.`),
            el('input', {
                type: 'text',
                class: 'xbot-license-input',
                placeholder: 'License key',
                dataset: { role: 'license-input' }
            }),
            el('div', { class: 'xbot-actions' },
                el('button', { class: 'xbot-btn-confirm', dataset: { role: 'activate-license' } }, 'Activate')
            )
        );
    }
    return false;
}

function setComposerEnabled(enabled) {
    inputEl.disabled = !enabled;
    sendEl.disabled = !enabled;
    inputEl.placeholder = enabled ? 'e.g. lunch 150, rickshaw 40' : 'Locked — Pro feature';
}

function onActivate(_ev, btn) {
    const card = btn.closest('.xbot-bubble');
    const input = card && $('[data-role="license-input"]', card);
    const res = activateLicense(input ? input.value : '');
    if (!res.ok) {
        addBubble('bot', el('p', { class: 'xbot-error' }, res.error));
        return;
    }
    lockShown = false;
    renderBanner();
    setComposerEnabled(true);
    addBubble('bot', el('p', {}, 'Pro activated 🎉 — you’re all set.'));
    inputEl.focus();
}

// ---- send flow -------------------------------------------------------------

async function handleSend() {
    const text = inputEl.value.trim();
    if (!text || !ensureUnlocked()) return;

    inputEl.value = '';
    addBubble('user', el('p', {}, text));

    const s = store.getState();
    const cfg = getAssistantConfig();

    if (cfg.apiKey) {
        const typing = addBubble('bot', el('p', { class: 'xbot-typing' }, 'Thinking…'));
        const res = await extractWithLLM(text, {
            categories: s.categories,
            settings: s.settings,
            config: { ...cfg, model: cfg.model || DEFAULT_MODELS[cfg.provider] }
        });
        typing.remove();
        if (!res.ok) {
            addBubble('bot', el('p', { class: 'xbot-error' }, res.error));
            return;
        }
        const logId = logInteraction({ rawText: text, engine: 'llm', entries: res.entries });
        if (!res.entries.length) {
            addBubble('bot', el('p', {}, res.reply || 'I couldn’t find any expenses in that.'));
            markOutcome(logId, { cancelled: true });
            return;
        }
        renderPreview(res.entries, [], logId, res.reply);
    } else {
        const result = parse(text, {
            categories: s.categories,
            todayStr: getLocalDateString(new Date()),
            currencyCode: s.settings?.currency
        });
        const logId = logInteraction({ rawText: text, engine: 'parser', entries: result.entries });
        if (!result.entries.length) {
            addBubble('bot',
                el('p', {}, 'I couldn’t find any amounts in that. Try something like:'),
                el('p', {}, el('em', {}, 'lunch 150, rickshaw 40'))
            );
            markOutcome(logId, { cancelled: true });
            return;
        }
        renderPreview(result.entries, result.unmatched, logId, '');
    }
}

// ---- preview / confirm -----------------------------------------------------

function renderPreview(entries, unmatched, logId, reply) {
    const id = String(++seq);
    pending.set(id, { entries, logId });

    const currency = store.getState().settings?.currency;
    const rows = entries.map((e, i) =>
        el('label', { class: 'xbot-entry-row' + (e.needsReview ? ' xbot-review' : '') },
            el('input', {
                type: 'checkbox',
                checked: true,
                dataset: { role: 'entry-toggle', idx: String(i) }
            }),
            el('span', { class: 'xbot-entry-main' },
                `${e.category} › ${e.subcategory} — ${formatCurrency(e.amount, currency)}${e.needsReview ? ' ⚠' : ''}`),
            el('span', { class: 'xbot-entry-meta' },
                `${formatDate(e.date)}${e.description ? ' · ' + e.description : ''}`)
        )
    );

    const children = [];
    if (reply) children.push(el('p', {}, reply));
    children.push(el('p', {}, `Add ${entries.length === 1 ? 'this entry' : `these ${entries.length} entries`}? Untick anything I got wrong.`));
    children.push(...rows);
    if (unmatched.length) {
        children.push(el('p', { class: 'xbot-note' }, `Couldn’t read: ${unmatched.join(' · ')}`));
    }
    children.push(el('div', { class: 'xbot-actions' },
        el('button', { class: 'xbot-btn-confirm', dataset: { role: 'confirm-add' } }, '✓ Add'),
        el('button', { class: 'xbot-btn-cancel', dataset: { role: 'cancel-add' } }, 'Cancel')
    ));

    const bubble = addBubble('bot', ...children);
    bubble.dataset.previewId = id;
}

function onConfirm(_ev, btn) {
    const card = btn.closest('[data-preview-id]');
    const id = card?.dataset.previewId;
    const rec = id && pending.get(id);
    if (!rec) return;
    disablePreview(card);

    const checkedIdx = $$('input[data-role="entry-toggle"]', card)
        .filter(c => /** @type {HTMLInputElement} */ (c).checked)
        .map(c => Number(/** @type {HTMLElement} */ (c).dataset.idx));
    const selected = checkedIdx.map(i => rec.entries[i]).filter(Boolean);

    const currency = store.getState().settings?.currency;
    const { okIds, errors } = commitEntries(selected, { currency });

    markOutcome(rec.logId, {
        acceptedIds: okIds,
        deselectedCount: rec.entries.length - selected.length,
        cancelled: selected.length === 0
    });
    pending.delete(id);

    addBubble('bot',
        el('p', {}, okIds.length
            ? `Added ${okIds.length} of ${rec.entries.length} ✅`
            : 'Nothing added.'),
        ...errors.map(t => el('p', { class: 'xbot-error' }, t))
    );
    card.remove();
}

function onCancel(_ev, btn) {
    const card = btn.closest('[data-preview-id]');
    const id = card?.dataset.previewId;
    const rec = id && pending.get(id);
    if (!rec) return;
    disablePreview(card);
    markOutcome(rec.logId, { cancelled: true });
    pending.delete(id);
    addBubble('bot', el('p', {}, 'Okay, nothing saved.'));
    card.remove();
}

function disablePreview(card) {
    $$('button, input', card).forEach(elm => { /** @type {HTMLInputElement} */ (elm).disabled = true; });
}

// ---- helpers ---------------------------------------------------------------

function addBubble(role, ...children) {
    const isBot = role !== 'user';
    const bubble = el('div', {
        class: `xbot-bubble ${isBot ? 'xbot-bot' : 'xbot-user'}`
    }, isBot ? el('div', { class: 'xbot-bubble-inner' }, mascotIcon('xbot-mascot-bubble'), el('div', {}, ...children)) : el('div', {}, ...children));
    messagesEl.append(bubble);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    return bubble;
}
