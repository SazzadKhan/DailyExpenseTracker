// js/features/auth/index.js
// Google OAuth + landing + profile-page widget. Wraps the legacy
// `window.auth` and `window.sheetsApi` services until they too are
// migrated to ES modules.

import { store } from '../../core/store.js';
import { EVENTS } from '../../core/events.js';
import { $ } from '../../core/dom.js';
import { showToast } from '../../core/toast.js';
import { DEFAULT_CATEGORIES, DEFAULT_SETTINGS, STORAGE_KEYS } from '../../core/constants.js';
import { storage } from '../../services/storage.js';
import { dialog } from '../../services/dialog.js';
import { pullFromCloud, pushAllToCloud, updateSyncStatus, getLastSyncTime } from '../sync/index.js';
import { log } from '../../core/log.js';

const $log = log('auth');

const AUTH_MODE_KEY = STORAGE_KEYS.AUTH_MODE;
const GUEST_MODE_CHOSEN_KEY = STORAGE_KEYS.GUEST_MODE_CHOSEN;
const LAST_EMAIL_KEY = STORAGE_KEYS.LAST_SIGNED_IN_EMAIL;

function w() { return /** @type {any} */ (window); }
function getAuth()      { return w().auth; }
function getSheetsApi() { return w().sheetsApi; }

function getAuthMode() {
    try { return localStorage.getItem(AUTH_MODE_KEY); } catch (_) { return null; }
}
function setAuthMode(mode) {
    try {
        if (mode) localStorage.setItem(AUTH_MODE_KEY, mode);
        else localStorage.removeItem(AUTH_MODE_KEY);
    } catch (_) {}
}

function getGuestModeChosen() {
    try { return localStorage.getItem(GUEST_MODE_CHOSEN_KEY) === '1'; } catch (_) { return false; }
}

function setGuestModeChosen(chosen) {
    try {
        if (chosen) localStorage.setItem(GUEST_MODE_CHOSEN_KEY, '1');
        else localStorage.removeItem(GUEST_MODE_CHOSEN_KEY);
    } catch (_) {}
}

function showLanding() {
    const el = $('#landing-overlay');
    if (el) el.hidden = false;
    document.body.classList.add('landing-open');
}
function hideLanding() {
    const el = $('#landing-overlay');
    if (el) el.hidden = true;
    document.body.classList.remove('landing-open');
}

/**
 * Reset all per-user data in localStorage and in the store to defaults.
 * Does NOT touch Google Drive — only this device.
 */
export function wipeLocalData({ keepSettings = false } = {}) {
    const freshCategories = JSON.parse(JSON.stringify(DEFAULT_CATEGORIES));
    const freshSettings = keepSettings
        ? store.getState().settings
        : { ...DEFAULT_SETTINGS };

    try {
        localStorage.setItem('expenses', '[]');
        localStorage.setItem('categories', JSON.stringify(freshCategories));
        if (!keepSettings) localStorage.setItem('settings', JSON.stringify(freshSettings));

        // Drop every cached spreadsheet ID — they belong to specific accounts.
        const toRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k && k.startsWith(STORAGE_KEYS.SHEET_ID_PREFIX)) toRemove.push(k);
        }
        toRemove.forEach(k => localStorage.removeItem(k));
    } catch (_) {}

    // Push the cleared snapshot into the store.
    store.update(
        keepSettings
            ? { expenses: [], categories: freshCategories }
            : { expenses: [], categories: freshCategories, settings: freshSettings },
        EVENTS.EXPENSES_CHANGED,
        EVENTS.CATEGORIES_CHANGED,
        ...(keepSettings ? [] : [EVENTS.SETTINGS_CHANGED])
    );
}

async function activateCloudBackend({ initial = false } = {}) {
    const auth = getAuth();

    try {
        updateSyncStatus('syncing');

        const profile = auth.getProfile();
        const newEmail = profile ? profile.email : null;
        const lastEmail = (() => {
            try { return localStorage.getItem(LAST_EMAIL_KEY); } catch (_) { return null; }
        })();
        const switchedAccount = !!(newEmail && lastEmail && newEmail !== lastEmail);

        if (switchedAccount) {
            wipeLocalData({ keepSettings: false });
        }

        await storage.useSheets();
        setAuthMode('google');
        if (newEmail) {
            try { localStorage.setItem(LAST_EMAIL_KEY, newEmail); } catch (_) {}
        }

        // First-sign-in migration prompt (per account).
        const migrationKey = newEmail ? `cloudMigrated:${newEmail}` : null;
        const alreadyMigrated = migrationKey
            ? (() => { try { return localStorage.getItem(migrationKey) === '1'; } catch { return false; } })()
            : false;

        const localExpenses = store.getState().expenses;
        if (initial === false && !switchedAccount && !alreadyMigrated && localExpenses.length > 0) {
            const wantsMigrate = await dialog.confirm({
                title: 'Upload local data?',
                message:
                    `You have ${localExpenses.length} local entries. Upload them to your Google Sheet?\n\n` +
                    `Choose "Upload" to push your local data, or "Use sheet" to keep whatever's already in the sheet (local data may be overwritten).`,
                confirmText: 'Upload',
                cancelText: 'Use sheet'
            });
            if (wantsMigrate) {
                await pushAllToCloud();
            }
        }
        await pullFromCloud();

        if (migrationKey) {
            try { localStorage.setItem(migrationKey, '1'); } catch (_) {}
        }
    } catch (e) {
        $log.error('cloud activation failed', e);
        updateSyncStatus('error');
        storage.useLocal();
    }
}

function setupLanding() {
    const auth = getAuth();
    const signinBtn = $('#landing-signin-btn');
    const guestBtn = $('#landing-guest-btn');

    if (signinBtn) {
        signinBtn.addEventListener('click', async () => {
            if (!auth.isConfigured()) {
                showToast('Google sign-in is not configured for this deployment yet.', 'error');
                return;
            }
            const ok = await auth.signIn();
            if (ok) {
                hideLanding();
                await activateCloudBackend({ initial: false });
                renderAuthUi();
            }
        });
    }
    if (guestBtn) {
        guestBtn.addEventListener('click', () => {
            setAuthMode('guest');
            setGuestModeChosen(true);
            hideLanding();
            renderAuthUi();
        });
    }
}

function setupAuthUi() {
    const auth = getAuth();

    const signinBtn        = $('#signin-btn');
    const profileBtn       = $('#auth-trigger');
    const menu             = $('#auth-menu');
    const signoutBtn       = $('#signout-btn');
    const banner           = $('#signin-banner');
    const bannerSigninBtn  = $('#banner-signin-btn');
    const bannerCloseBtn   = $('#banner-close');
    const profileSigninBtn  = $('#profile-signin-btn');
    const profileSignoutBtn = $('#profile-signout-btn');
    const profilePullBtn    = $('#profile-pull-btn');
    const profilePushBtn    = $('#profile-push-btn');

    const doSignIn = async () => {
        if (!auth.isConfigured()) {
            await dialog.alert({
                title: 'Sign-in not configured',
                message: 'Google sign-in is not configured for this deployment yet.\n\nSee OAUTH_SETUP.md for instructions.',
                tone: 'error'
            });
            return;
        }
        const ok = await auth.signIn();
        if (ok) {
            await activateCloudBackend({ initial: false });
            renderAuthUi();
        }
    };
    const doSignOut = async () => {
        const confirmed = await dialog.confirm({
            title: 'Sign out of this device?',
            message:
                'Your data stays safe in your Google Sheet on Drive — this only removes the local cached copy so the next person using this browser doesn’t see your data.',
            confirmText: 'Sign out',
            tone: 'warn'
        });
        if (!confirmed) return;

        await auth.signOut();
        storage.useLocal();
        setAuthMode(null);
        try { localStorage.removeItem(LAST_EMAIL_KEY); } catch (_) {}
        wipeLocalData();
        updateSyncStatus('offline');
        renderAuthUi();
        showLanding();
    };

    if (signinBtn) signinBtn.addEventListener('click', doSignIn);
    if (bannerSigninBtn) bannerSigninBtn.addEventListener('click', doSignIn);
    if (profileSigninBtn) profileSigninBtn.addEventListener('click', doSignIn);
    if (signoutBtn) signoutBtn.addEventListener('click', doSignOut);
    if (profileSignoutBtn) profileSignoutBtn.addEventListener('click', doSignOut);

    if (profilePullBtn) profilePullBtn.addEventListener('click', async () => {
        if (!storage.isCloud()) return;
        const ok = await dialog.confirm({
            title: 'Pull from sheet?',
            message: 'Replace local data with the contents of your Google Sheet.',
            confirmText: 'Pull',
            tone: 'warn'
        });
        if (ok) await pullFromCloud();
    });
    if (profilePushBtn) profilePushBtn.addEventListener('click', async () => {
        if (!storage.isCloud()) return;
        const ok = await dialog.confirm({
            title: 'Push to sheet?',
            message: 'Overwrite your Google Sheet with all local data.',
            confirmText: 'Push',
            tone: 'warn'
        });
        if (ok) await pushAllToCloud();
    });

    if (profileBtn && menu) {
        profileBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            menu.hidden = !menu.hidden;
        });
        document.addEventListener('click', (e) => {
            if (!menu.hidden && !menu.contains(e.target) && e.target !== profileBtn) {
                menu.hidden = true;
            }
        });
    }

    if (bannerCloseBtn && banner) {
        bannerCloseBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            banner.hidden = true;
            try { localStorage.setItem(STORAGE_KEYS.SIGNIN_BANNER_DISMISSED, '1'); } catch (_) {}
        });
    }
}

function oldestExpenseDateLabel() {
    const expenses = store.getState().expenses;
    if (!expenses.length) return '—';
    const dates = expenses.map(e => (e.date || '').substring(0, 10)).filter(Boolean).sort();
    if (!dates.length) return '—';
    try {
        const d = new Date(dates[0] + 'T00:00:00');
        return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    } catch (_) {
        return dates[0];
    }
}

function setAvatar(imgEl, fallbackEl, url) {
    if (!imgEl && !fallbackEl) return;
    const showFallback = () => {
        if (imgEl) { imgEl.hidden = true; imgEl.removeAttribute('src'); }
        if (fallbackEl) fallbackEl.hidden = false;
    };
    if (url && imgEl) {
        imgEl.onerror = showFallback;
        imgEl.onload = () => {
            imgEl.hidden = false;
            if (fallbackEl) fallbackEl.hidden = true;
        };
        imgEl.hidden = true;
        if (fallbackEl) fallbackEl.hidden = false;
        imgEl.src = url;
    } else {
        showFallback();
    }
}

export function renderAuthUi() {
    const auth = getAuth();
    if (!auth) return;
    const sheetsApi = getSheetsApi();

    const signinBtn = $('#signin-btn');
    const profileEl = $('#auth-profile');
    const banner    = $('#signin-banner');
    const profile   = auth.getProfile();
    const signedIn  = auth.isSignedIn();

    // Header widget
    if (signinBtn && profileEl) {
        if (signedIn && profile) {
            signinBtn.hidden = true;
            profileEl.hidden = false;

            setAvatar($('#auth-avatar'), $('#auth-avatar-fallback'), profile.picture);
            const nameEl = $('#auth-name');
            if (nameEl) nameEl.textContent = profile.name || profile.email || '';
            const menuName = $('#auth-menu-name');
            if (menuName) menuName.textContent = profile.name || '';
            const menuEmail = $('#auth-menu-email');
            if (menuEmail) menuEmail.textContent = profile.email || '';

            const sheetLink = $('#open-sheet-link');
            if (sheetLink) {
                const url = sheetsApi && sheetsApi.getSpreadsheetUrl();
                if (url) {
                    sheetLink.href = url;
                    sheetLink.style.display = '';
                } else {
                    sheetLink.style.display = 'none';
                }
            }
        } else {
            signinBtn.hidden = !auth.isConfigured();
            profileEl.hidden = true;
        }
    }

    if (banner) {
        const dismissed = (() => {
            try { return localStorage.getItem(STORAGE_KEYS.SIGNIN_BANNER_DISMISSED) === '1'; } catch (_) { return false; }
        })();
        const isGuest = getAuthMode() === 'guest';
        banner.hidden = signedIn || !auth.isConfigured() || dismissed || !isGuest;
    }

    if (!signedIn) updateSyncStatus('offline');

    // Profile page
    const profileSignedOut = $('#profile-signed-out');
    const profileSignedIn  = $('#profile-signed-in');
    if (profileSignedOut && profileSignedIn) {
        profileSignedOut.hidden = signedIn;
        profileSignedIn.hidden = !signedIn;
        if (signedIn && profile) {
            setAvatar($('#profile-avatar'), $('#profile-avatar-fallback'), profile.picture);
            const pName = $('#profile-name');
            if (pName) pName.textContent = profile.name || '';
            const pEmail = $('#profile-email');
            if (pEmail) pEmail.textContent = profile.email || '';
            const pSheet = $('#profile-sheet-link');
            if (pSheet) {
                const url = sheetsApi && sheetsApi.getSpreadsheetUrl();
                if (url) { pSheet.href = url; pSheet.style.display = ''; }
                else { pSheet.style.display = 'none'; }
            }
        }

        const entriesEl = signedIn
            ? $('#profile-stat-entries-in')
            : $('#profile-stat-entries');
        if (entriesEl) entriesEl.textContent = store.getState().expenses.length;

        const sinceEl = $('#profile-stat-since');
        if (sinceEl) sinceEl.textContent = oldestExpenseDateLabel();

        const lastSyncEl = $('#profile-stat-lastsync');
        if (lastSyncEl) {
            const t = getLastSyncTime();
            lastSyncEl.textContent = t ? t.toLocaleTimeString() : '—';
        }
    }
}

async function initAuthAndStorage() {
    try {
        const auth = getAuth();
        const clientId = w().GOOGLE_OAUTH_CLIENT_ID;
        const configured = await auth.init(clientId);

        auth.onChange(renderAuthUi);
        setupAuthUi();
        setupLanding();

        if (!configured) {
            setAuthMode('guest');
            setGuestModeChosen(true);
            renderAuthUi();
            return;
        }

        const mode = getAuthMode();

        if (mode === 'google' && auth.getProfile()) {
            const ok = await auth.silentSignIn();
            if (ok) {
                await activateCloudBackend({ initial: true });
                renderAuthUi();
                return;
            }
            setAuthMode(null);
        }

        if (mode === 'guest') {
            setGuestModeChosen(true);
            renderAuthUi();
            return;
        }

        if (getGuestModeChosen()) {
            setAuthMode('guest');
            renderAuthUi();
            return;
        }

        showLanding();
        renderAuthUi();
    } finally {
        document.body.classList.remove('auth-pending');
    }
}

export function mount() {
    // Re-render profile page when the expense list changes (e.g. after a
    // pull/push or local edit).
    store.subscribe(EVENTS.EXPENSES_CHANGED, renderAuthUi);

    // Kick off auth init asynchronously.
    initAuthAndStorage().catch(err => $log.error('init failed', err));
}
