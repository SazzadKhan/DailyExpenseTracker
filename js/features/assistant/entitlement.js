// js/features/assistant/entitlement.js
// XpenseBot access: 30-day free trial from first use, then Pro.
// This is the ONLY module that knows how Pro is unlocked — when the real
// signed-license check ships, replace validateLicenseKey() and nothing else.
// State lives in dedicated localStorage keys, never in `settings`
// (settings sync to the user's Google Sheet).

import { STORAGE_KEYS } from '../../core/constants.js';

export const TRIAL_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Start the trial clock on first use. Safe to call repeatedly. */
export function startTrialIfNeeded() {
    try {
        if (!localStorage.getItem(STORAGE_KEYS.ASSISTANT_TRIAL_START)) {
            localStorage.setItem(STORAGE_KEYS.ASSISTANT_TRIAL_START, String(Date.now()));
        }
    } catch (_) { /* storage unavailable — treated as fresh trial */ }
}

/**
 * @returns {{ status: 'trial'|'pro'|'expired', daysLeft: number|null }}
 *          daysLeft is null for pro.
 */
export function getEntitlement() {
    try {
        const license = (localStorage.getItem(STORAGE_KEYS.ASSISTANT_LICENSE_KEY) || '').trim();
        if (license) return { status: 'pro', daysLeft: null };

        const raw = localStorage.getItem(STORAGE_KEYS.ASSISTANT_TRIAL_START);
        if (!raw) return { status: 'trial', daysLeft: TRIAL_DAYS };

        const start = Number(raw);
        if (!Number.isFinite(start)) return { status: 'trial', daysLeft: TRIAL_DAYS };

        const daysLeft = TRIAL_DAYS - Math.floor((Date.now() - start) / DAY_MS);
        if (daysLeft <= 0) return { status: 'expired', daysLeft: 0 };
        return { status: 'trial', daysLeft };
    } catch (_) {
        return { status: 'trial', daysLeft: TRIAL_DAYS };
    }
}

/**
 * @param {string} rawKey
 * @returns {{ ok:true } | { ok:false, error:string }}
 */
export function activateLicense(rawKey) {
    const key = String(rawKey || '').trim();
    if (!validateLicenseKey(key)) {
        return { ok: false, error: 'Please enter a license key.' };
    }
    try {
        localStorage.setItem(STORAGE_KEYS.ASSISTANT_LICENSE_KEY, key);
    } catch (_) {
        return { ok: false, error: 'Could not save the license key.' };
    }
    return { ok: true };
}

// STUB: accepts any non-empty key. Replace with the signed-key verification
// from docs/BUSINESS_PLAN.md when the payment rail exists.
function validateLicenseKey(key) {
    return key.length > 0;
}
