// ===== Google Identity Services (GIS) OAuth =====
// Handles sign-in, token management, and user profile.
//
// Required scopes:
//   - openid email profile  (identity)
//   - https://www.googleapis.com/auth/spreadsheets  (read/write the user's sheet)
//   - https://www.googleapis.com/auth/drive.file    (create + access only files our app made)
//
// Public Client ID is read from window.GOOGLE_OAUTH_CLIENT_ID (set in index.html
// or via a deployment-time replacement). It is NOT a secret — see OAUTH_SETUP.md.

const AUTH_SCOPES = [
    'openid',
    'email',
    'profile',
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/drive.file'
].join(' ');

const TOKEN_STORAGE_KEY = 'auth.token';
const PROFILE_STORAGE_KEY = 'auth.profile';

const auth = {
    _tokenClient: null,
    _gisReady: false,
    _gisReadyPromise: null,
    _accessToken: null,
    _expiresAt: 0,
    _profile: null,
    _listeners: new Set(),
    _interactiveResolver: null,

    // Wait until the GIS script loads.
    _waitForGis() {
        if (this._gisReady) return Promise.resolve();
        if (this._gisReadyPromise) return this._gisReadyPromise;

        this._gisReadyPromise = new Promise((resolve, reject) => {
            const start = Date.now();
            const tick = () => {
                if (window.google && window.google.accounts && window.google.accounts.oauth2) {
                    this._gisReady = true;
                    resolve();
                } else if (Date.now() - start > 10000) {
                    reject(new Error('Google Identity Services failed to load'));
                } else {
                    setTimeout(tick, 50);
                }
            };
            tick();
        });
        return this._gisReadyPromise;
    },

    async init(clientId) {
        if (!clientId || clientId === 'YOUR_GOOGLE_OAUTH_CLIENT_ID') {
            console.warn('[auth] No OAuth Client ID configured. Sign-in disabled. See OAUTH_SETUP.md.');
            return false;
        }

        await this._waitForGis();

        this._tokenClient = google.accounts.oauth2.initTokenClient({
            client_id: clientId,
            scope: AUTH_SCOPES,
            prompt: '',
            callback: (response) => this._onTokenResponse(response),
            error_callback: (err) => this._onTokenError(err)
        });

        // Restore cached token + profile if still valid
        try {
            const cached = JSON.parse(sessionStorage.getItem(TOKEN_STORAGE_KEY) || 'null');
            if (cached && cached.expiresAt > Date.now() + 60_000) {
                this._accessToken = cached.token;
                this._expiresAt = cached.expiresAt;
            }
            const profile = JSON.parse(localStorage.getItem(PROFILE_STORAGE_KEY) || 'null');
            if (profile) this._profile = profile;
        } catch (_) { /* ignore */ }

        return true;
    },

    isConfigured() {
        return !!this._tokenClient;
    },

    isSignedIn() {
        return !!this._accessToken && this._expiresAt > Date.now() + 30_000;
    },

    getProfile() {
        return this._profile;
    },

    getAccessToken() {
        if (this.isSignedIn()) return this._accessToken;
        return null;
    },

    onChange(listener) {
        this._listeners.add(listener);
        return () => this._listeners.delete(listener);
    },

    _emit() {
        for (const l of this._listeners) {
            try { l(); } catch (e) { console.error(e); }
        }
    },

    _onTokenResponse(response) {
        if (response && response.access_token) {
            this._accessToken = response.access_token;
            const ttl = (parseInt(response.expires_in, 10) || 3600) * 1000;
            this._expiresAt = Date.now() + ttl;

            try {
                sessionStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify({
                    token: this._accessToken,
                    expiresAt: this._expiresAt
                }));
            } catch (_) { /* ignore */ }

            // Resolve any waiting interactive sign-in
            const resolver = this._interactiveResolver;
            this._interactiveResolver = null;

            // Fetch profile (best-effort) then notify listeners
            this._fetchProfile().finally(() => {
                this._emit();
                if (resolver) resolver(true);
            });
        } else {
            const resolver = this._interactiveResolver;
            this._interactiveResolver = null;
            if (resolver) resolver(false);
        }
    },

    _onTokenError(err) {
        console.warn('[auth] Token error:', err);
        const resolver = this._interactiveResolver;
        this._interactiveResolver = null;
        if (resolver) resolver(false);
    },

    async _fetchProfile() {
        if (!this._accessToken) return null;
        try {
            const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                headers: { Authorization: `Bearer ${this._accessToken}` }
            });
            if (!res.ok) return null;
            const data = await res.json();
            this._profile = {
                email: data.email,
                name: data.name || data.email,
                picture: data.picture || null,
                sub: data.sub
            };
            try { localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(this._profile)); } catch (_) {}
            return this._profile;
        } catch (e) {
            console.warn('[auth] userinfo fetch failed', e);
            return null;
        }
    },

    // Interactive sign-in — shows the Google account chooser.
    async signIn() {
        if (!this._tokenClient) throw new Error('Auth not configured');
        return new Promise((resolve) => {
            this._interactiveResolver = resolve;
            // 'consent' the first time so user sees scopes; '' afterward for silent re-grant.
            const prompt = this._profile ? '' : 'consent';
            try {
                this._tokenClient.requestAccessToken({ prompt });
            } catch (e) {
                console.error('[auth] requestAccessToken failed', e);
                this._interactiveResolver = null;
                resolve(false);
            }
        });
    },

    // Try to silently get a token (no UI). Returns true on success.
    async silentSignIn() {
        if (!this._tokenClient || !this._profile) return false;
        return new Promise((resolve) => {
            this._interactiveResolver = resolve;
            try {
                this._tokenClient.requestAccessToken({ prompt: 'none' });
            } catch (_) {
                this._interactiveResolver = null;
                resolve(false);
            }
        });
    },

    async signOut() {
        const token = this._accessToken;
        this._accessToken = null;
        this._expiresAt = 0;
        this._profile = null;
        try {
            sessionStorage.removeItem(TOKEN_STORAGE_KEY);
            localStorage.removeItem(PROFILE_STORAGE_KEY);
        } catch (_) {}

        if (token && window.google && google.accounts && google.accounts.oauth2) {
            try { google.accounts.oauth2.revoke(token, () => {}); } catch (_) {}
        }
        this._emit();
    }
};

window.auth = auth;
