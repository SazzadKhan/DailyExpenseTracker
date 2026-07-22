// js/features/assistant/audit-log.js
// Raw input → parsed output → user outcome, per bot interaction.
// Local-only ring buffer (never synced to the cloud sheet). Financial
// records must not be the only trace of what the parser did — this log is
// the audit trail today and the labeled corpus for tuning rules later.

import { STORAGE_KEYS } from '../../core/constants.js';

const CAP = 200;

function readLog() {
    try {
        const raw = localStorage.getItem(STORAGE_KEYS.ASSISTANT_LOG);
        const log = raw ? JSON.parse(raw) : [];
        return Array.isArray(log) ? log : [];
    } catch (_) {
        return [];
    }
}

function writeLog(log) {
    try {
        localStorage.setItem(STORAGE_KEYS.ASSISTANT_LOG, JSON.stringify(log));
    } catch (_) { /* quota / storage unavailable — logging is best-effort */ }
}

/**
 * Record one bot interaction at parse time.
 * @param {{ rawText:string, engine:'parser'|'llm', entries:object[] }} data
 * @returns {string} logId to pass to markOutcome later.
 */
export function logInteraction({ rawText, engine, entries }) {
    const log = readLog();
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    log.push({
        id,
        ts: new Date().toISOString(),
        raw_text: rawText,
        engine,
        parsed: entries,
        accepted_ids: [],
        user_modified: false,
        cancelled: false
    });
    while (log.length > CAP) log.shift();
    writeLog(log);
    return id;
}

/**
 * Record what the user did with the preview.
 * @param {string} logId
 * @param {{ acceptedIds?: string[], deselectedCount?: number, cancelled?: boolean }} outcome
 */
export function markOutcome(logId, { acceptedIds = [], deselectedCount = 0, cancelled = false } = {}) {
    const log = readLog();
    const rec = log.find(r => r.id === logId);
    if (!rec) return;
    rec.accepted_ids = acceptedIds;
    rec.user_modified = deselectedCount > 0;
    rec.cancelled = cancelled;
    writeLog(log);
}

/** Full log, oldest first. No UI in v1 — DevTools / future export. */
export function getLog() {
    return readLog();
}

/**
 * The audit log as a pretty-printed JSON string. This is the raw material
 * for the 10-user test learning loop: what people typed vs what the parser
 * did with it. Trigger a download from DevTools with
 * `window.__xpenseExportLog()` (wired in js/features/capture/index.js), or
 * call this to hand the string somewhere else.
 * @returns {string}
 */
export function exportLog() {
    return JSON.stringify(readLog(), null, 2);
}

/**
 * Rolled-up counts for the Assistant Guide dashboard (from the local ring
 * buffer, so it reflects only recent activity — CAP interactions).
 * @returns {{ interactions:number, entriesParsed:number, entriesAccepted:number,
 *             flagged:number, cancelled:number }}
 */
export function logStats() {
    const log = readLog();
    let entriesParsed = 0, entriesAccepted = 0, flagged = 0, cancelled = 0;
    for (const rec of log) {
        const parsed = rec.parsed || [];
        entriesParsed += parsed.length;
        entriesAccepted += (rec.accepted_ids || []).length;
        if (rec.cancelled) cancelled++;
        for (const e of parsed) if (e && e.needsReview) flagged++;
    }
    return { interactions: log.length, entriesParsed, entriesAccepted, flagged, cancelled };
}
