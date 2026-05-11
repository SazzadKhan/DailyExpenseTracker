/* ============================================================
   Premium Effects Engine
   - Subtle sound effects via WebAudio (no assets needed)
   - Haptic feedback via navigator.vibrate
   - Ripple effect on buttons
   - Confetti micro-burst on successful add
   - Stat value "tick" animation when content changes
   - Page/row entrance polish
   User-toggleable from settings (persists in localStorage).
   Respects prefers-reduced-motion for visuals.
   ============================================================ */
(function () {
    'use strict';

    const LS_SOUND  = 'fx_sound_enabled';
    const LS_HAPTIC = 'fx_haptic_enabled';

    const prefs = {
        sound:  loadPref(LS_SOUND,  true),
        haptic: loadPref(LS_HAPTIC, true),
    };

    const reduceMotion = window.matchMedia
        && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function loadPref(key, fallback) {
        try {
            const v = localStorage.getItem(key);
            if (v === null) return fallback;
            return v === '1' || v === 'true';
        } catch { return fallback; }
    }
    function savePref(key, val) {
        try { localStorage.setItem(key, val ? '1' : '0'); } catch {}
    }

    // ---------------- Web Audio ----------------
    let audioCtx = null;
    function getCtx() {
        if (!prefs.sound) return null;
        if (audioCtx) return audioCtx;
        try {
            const Ctx = window.AudioContext || window.webkitAudioContext;
            if (!Ctx) return null;
            audioCtx = new Ctx();
        } catch { audioCtx = null; }
        return audioCtx;
    }
    // Unlock audio on first user gesture (mobile policy)
    function unlock() {
        const ctx = getCtx();
        if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
    }
    ['pointerdown', 'keydown', 'touchstart'].forEach(ev =>
        document.addEventListener(ev, unlock, { once: true, passive: true })
    );

    /**
     * Play a short envelope-shaped tone (or chord).
     * opts: { freq, type, dur, gain, slideTo }
     */
    function tone(opts) {
        const ctx = getCtx();
        if (!ctx) return;
        const {
            freq = 440, type = 'sine', dur = 0.12,
            gain = 0.06, slideTo = null, delay = 0
        } = opts || {};
        const start = ctx.currentTime + delay;
        const osc = ctx.createOscillator();
        const g   = ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, start);
        if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, start + dur);
        g.gain.setValueAtTime(0.0001, start);
        g.gain.exponentialRampToValueAtTime(gain, start + 0.008);
        g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
        osc.connect(g).connect(ctx.destination);
        osc.start(start);
        osc.stop(start + dur + 0.02);
    }

    const sounds = {
        tap:     () => tone({ freq: 520, type: 'sine',     dur: 0.06, gain: 0.035 }),
        nav:     () => tone({ freq: 660, type: 'triangle', dur: 0.09, gain: 0.04, slideTo: 880 }),
        success: () => {
            tone({ freq: 660,  type: 'triangle', dur: 0.10, gain: 0.05 });
            tone({ freq: 880,  type: 'triangle', dur: 0.12, gain: 0.05, delay: 0.07 });
            tone({ freq: 1320, type: 'triangle', dur: 0.18, gain: 0.05, delay: 0.15 });
        },
        warn:    () => tone({ freq: 380, type: 'square',   dur: 0.14, gain: 0.04, slideTo: 280 }),
        error:   () => {
            tone({ freq: 300, type: 'sawtooth', dur: 0.12, gain: 0.05 });
            tone({ freq: 180, type: 'sawtooth', dur: 0.18, gain: 0.05, delay: 0.10 });
        },
        delete:  () => tone({ freq: 220, type: 'triangle', dur: 0.18, gain: 0.05, slideTo: 110 }),
        toggle:  () => tone({ freq: 700, type: 'sine',     dur: 0.07, gain: 0.035 }),
    };

    function playSound(name) {
        if (!prefs.sound) return;
        const fn = sounds[name];
        if (fn) try { fn(); } catch {}
    }

    // ---------------- Haptics ----------------
    function haptic(pattern) {
        if (!prefs.haptic) return;
        if (!('vibrate' in navigator)) return;
        try { navigator.vibrate(pattern); } catch {}
    }
    const HAPTIC = {
        tap:     8,
        nav:     12,
        success: [12, 40, 18],
        warn:    [20, 30, 20],
        error:   [40, 30, 40, 30, 40],
        delete:  [16, 24, 16],
    };

    // ---------------- Ripple ----------------
    function spawnRipple(el, x, y) {
        if (reduceMotion) return;
        const rect = el.getBoundingClientRect();
        const size = Math.max(rect.width, rect.height) * 2.2;
        const ripple = document.createElement('span');
        ripple.className = 'fx-ripple';
        ripple.style.width = ripple.style.height = size + 'px';
        ripple.style.left = (x - rect.left) + 'px';
        ripple.style.top  = (y - rect.top)  + 'px';
        // Make sure host can contain the ripple
        const cs = getComputedStyle(el);
        if (cs.position === 'static') el.style.position = 'relative';
        el.appendChild(ripple);
        setTimeout(() => ripple.remove(), 650);
    }

    // ---------------- Confetti burst ----------------
    let confettiHost = null;
    function confettiAt(x, y) {
        if (reduceMotion) return;
        if (!confettiHost) {
            confettiHost = document.createElement('div');
            confettiHost.className = 'fx-confetti-host';
            document.body.appendChild(confettiHost);
        }
        const colors = ['#ff6b6b', '#ffd166', '#06d6a0', '#4cc9f0', '#b388ff', '#ff9f1c'];
        const N = 22;
        for (let i = 0; i < N; i++) {
            const piece = document.createElement('span');
            piece.className = 'fx-confetti';
            piece.style.left = x + 'px';
            piece.style.top  = y + 'px';
            piece.style.background = colors[i % colors.length];
            const angle = (Math.PI * 2 * i) / N + (Math.random() - 0.5) * 0.4;
            const dist  = 80 + Math.random() * 120;
            const dx = Math.cos(angle) * dist;
            const dy = Math.sin(angle) * dist - 40; // bias upward
            piece.style.setProperty('--dx', dx + 'px');
            piece.style.setProperty('--dy', dy + 'px');
            piece.style.setProperty('--rot', (Math.random() * 720 - 360) + 'deg');
            piece.style.animationDelay = (Math.random() * 60) + 'ms';
            confettiHost.appendChild(piece);
            setTimeout(() => piece.remove(), 1300);
        }
    }

    // ---------------- Event delegation ----------------
    function isInteractive(el) {
        return el && (
            el.matches('button, [role="button"], .nav-item, .category-tile, .subcategory-chip, .settings-tab, .type-filter-btn, .view-toggle-btn')
        );
    }

    // Selectors to skip ripple/sound on (small/precision buttons where overlay would interfere)
    const SKIP_FX = '.emoji-btn, .emoji-selected-display, .modal-close, .alert-close, .banner-close, .auth-caret, input, select, textarea';

    document.addEventListener('pointerdown', (e) => {
        if (e.target.closest(SKIP_FX)) return;
        const target = e.target.closest(
            'button, .nav-item, .category-tile, .subcategory-chip, .settings-tab, .type-filter-btn, .view-toggle-btn, [role="button"]'
        );
        if (!target) return;
        if (target.disabled) return;
        // Ripple
        spawnRipple(target, e.clientX, e.clientY);
    }, { passive: true });

    document.addEventListener('click', (e) => {
        if (e.target.closest(SKIP_FX)) {
            // Still play a soft tap for emoji selection
            if (e.target.closest('.emoji-btn')) {
                playSound('tap'); haptic(HAPTIC.tap);
            }
            return;
        }
        const target = e.target.closest(
            'button, .nav-item, .category-tile, .subcategory-chip, .settings-tab, .type-filter-btn, .view-toggle-btn, [role="button"]'
        );
        if (!target) return;
        if (target.disabled) return;

        // Pick the right sound/haptic by role
        if (target.matches('.nav-item, .settings-tab, .type-filter-btn, .view-toggle-btn')) {
            playSound('nav');
            haptic(HAPTIC.nav);
        } else if (target.matches('.btn-delete, .danger, [id*="delete" i], [id*="signout" i]')) {
            playSound('delete');
            haptic(HAPTIC.delete);
        } else if (target.matches('.category-tile, .subcategory-chip')) {
            playSound('tap');
            haptic(HAPTIC.tap);
            target.classList.remove('fx-pick');
            // restart animation
            void target.offsetWidth;
            target.classList.add('fx-pick');
        } else {
            playSound('tap');
            haptic(HAPTIC.tap);
        }
    }, { passive: true });

    // ---------------- Toast → sound/haptic by type ----------------
    const bodyObs = new MutationObserver((muts) => {
        for (const m of muts) {
            for (const node of m.addedNodes) {
                if (!(node instanceof HTMLElement)) continue;
                if (node.classList && node.classList.contains('toast-notification')) {
                    if (node.classList.contains('toast-success')) {
                        playSound('success'); haptic(HAPTIC.success);
                    } else if (node.classList.contains('toast-error')) {
                        playSound('error'); haptic(HAPTIC.error);
                    } else if (node.classList.contains('toast-warning')) {
                        playSound('warn'); haptic(HAPTIC.warn);
                    }
                }
            }
        }
    });
    bodyObs.observe(document.body, { childList: true });

    // ---------------- Stat value "tick" animation ----------------
    function observeStat(el) {
        if (!el || el.__fxObserved) return;
        el.__fxObserved = true;
        let last = el.textContent;
        const obs = new MutationObserver(() => {
            if (el.textContent !== last) {
                last = el.textContent;
                el.classList.remove('fx-tick');
                void el.offsetWidth;
                el.classList.add('fx-tick');
            }
        });
        obs.observe(el, { childList: true, characterData: true, subtree: true });
    }

    // ---------------- Expense add: confetti + row stagger ----------------
    function hookForm() {
        const form = document.getElementById('expense-form');
        if (form && !form.__fxHooked) {
            form.__fxHooked = true;
            form.addEventListener('submit', () => {
                // Defer to next frame so validation didn't block
                requestAnimationFrame(() => {
                    const btn = document.getElementById('btn-add-transaction');
                    if (!btn) return;
                    const r = btn.getBoundingClientRect();
                    // Confetti only fires if a success toast actually appears,
                    // but firing here gives instant feedback; the success sound
                    // is bound to the toast.
                    setTimeout(() => {
                        // Only confetti if the form's modal closed (= success)
                        const modal = document.getElementById('add-modal');
                        const visible = modal && getComputedStyle(modal).display !== 'none' && modal.classList.contains('show');
                        const open = modal && (modal.classList.contains('show') || getComputedStyle(modal).display !== 'none');
                        if (!open) {
                            confettiAt(r.left + r.width / 2, r.top + r.height / 2);
                        }
                    }, 120);
                });
            });
        }
    }

    function staggerNewRows(container) {
        if (!container || reduceMotion) return;
        const rows = container.querySelectorAll('tr, .expense-card');
        rows.forEach((row, i) => {
            if (row.__fxIn) return;
            row.__fxIn = true;
            row.style.animationDelay = Math.min(i * 25, 250) + 'ms';
            row.classList.add('fx-in');
            setTimeout(() => row.classList.remove('fx-in'), 600);
        });
    }
    function watchTable(id) {
        const el = document.getElementById(id);
        if (!el) return;
        new MutationObserver(() => staggerNewRows(el)).observe(el, { childList: true });
    }

    // ---------------- Settings UI injection ----------------
    function injectSettingsToggles() {
        const general = document.getElementById('general-tab');
        if (!general || document.getElementById('fx-feel-group')) return;

        const wrap = document.createElement('div');
        wrap.id = 'fx-feel-group';
        wrap.style.marginTop = '18px';
        wrap.innerHTML = `
            <h4>Feel & Feedback</h4>
            <div class="settings-group">
                <div class="form-group checkbox-group">
                    <input type="checkbox" id="fx-sound-toggle" ${prefs.sound ? 'checked' : ''}>
                    <label for="fx-sound-toggle">🔊 Sound effects</label>
                </div>
                <div class="form-group checkbox-group">
                    <input type="checkbox" id="fx-haptic-toggle" ${prefs.haptic ? 'checked' : ''}>
                    <label for="fx-haptic-toggle">📳 Haptic feedback (mobile)</label>
                </div>
            </div>
        `;
        general.appendChild(wrap);

        document.getElementById('fx-sound-toggle').addEventListener('change', (e) => {
            prefs.sound = e.target.checked;
            savePref(LS_SOUND, prefs.sound);
            if (prefs.sound) { unlock(); playSound('toggle'); }
        });
        document.getElementById('fx-haptic-toggle').addEventListener('change', (e) => {
            prefs.haptic = e.target.checked;
            savePref(LS_HAPTIC, prefs.haptic);
            if (prefs.haptic) haptic(HAPTIC.tap);
        });
    }

    // ---------------- Init ----------------
    function init() {
        ['today-total', 'month-total', 'budget-status', 'filtered-total', 'total-entries']
            .forEach(id => observeStat(document.getElementById(id)));
        watchTable('expense-tbody');
        watchTable('recent-expense-tbody');
        watchTable('expense-cards');
        watchTable('recent-expense-cards');
        hookForm();
        injectSettingsToggles();

        // Re-hook if form/settings re-render later
        new MutationObserver(() => {
            hookForm();
            injectSettingsToggles();
        }).observe(document.body, { childList: true, subtree: true });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Public API for app.js to hook richer events if desired
    window.fx = {
        play: playSound,
        haptic: (name) => haptic(HAPTIC[name] || name),
        confettiAt,
        prefs,
    };
})();
