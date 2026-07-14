// js/core/constants.js
// Single source of truth for shared constants. Do not redefine these
// elsewhere — import from here.

/** localStorage keys. Bump SCHEMA_VERSION (schema.js) before renaming any. */
export const STORAGE_KEYS = Object.freeze({
    EXPENSES: 'expenses',
    CATEGORIES: 'categories',
    SETTINGS: 'settings',
    CATEGORY_PICKER_VIEW: 'categoryPickerView',
    SIGNIN_BANNER_DISMISSED: 'signinBannerDismissed',
    AUTH_MODE: 'authMode',
    GUEST_MODE_CHOSEN: 'guestModeChosen',
    LAST_SIGNED_IN_EMAIL: 'lastSignedInEmail',
    SCHEMA_VERSION: 'schemaVersion',
    // expenseSheetId is namespaced per-email: `expenseSheetId:${email}`
    SHEET_ID_PREFIX: 'expenseSheetId:',
    LAST_SYNC_TIME: 'lastSyncTime',
    SYNC_QUEUE: 'syncQueue',
    // Assistant keys live outside the `settings` object on purpose:
    // storage.saveSettings() mirrors settings to the user's Google Sheet,
    // and the API key / entitlement state must never leave this browser.
    ASSISTANT_API_KEY: 'assistantApiKey',
    ASSISTANT_PROVIDER: 'assistantProvider',
    ASSISTANT_MODEL: 'assistantModel',
    ASSISTANT_TRIAL_START: 'assistantTrialStart',
    ASSISTANT_LICENSE_KEY: 'assistantLicenseKey',
    ASSISTANT_LOG: 'assistantLog',
    ASSISTANT_ONBOARDED: 'assistantOnboarded',
    ASSISTANT_LEARNED: 'assistantLearned'
    // (voiceLang / voiceOnlineConsent / voiceTipDismissed belonged to the
    // removed voice-input feature; stale values in existing browsers are inert.)
});

/** Default settings applied for new users / when localStorage is empty. */
export const DEFAULT_SETTINGS = Object.freeze({
    currency: 'USD',
    monthlyBudget: 0,
    warningThreshold: 80,
    enableNotifications: true,
    theme: 'dark'
});

/** Supported currencies. Keep `code` matching the key. */
export const CURRENCIES = Object.freeze({
    USD: { symbol: '$',  code: 'USD', locale: 'en-US' },
    EUR: { symbol: '€',  code: 'EUR', locale: 'de-DE' },
    GBP: { symbol: '£',  code: 'GBP', locale: 'en-GB' },
    BDT: { symbol: '৳',  code: 'BDT', locale: 'bn-BD' },
    INR: { symbol: '₹',  code: 'INR', locale: 'en-IN' },
    JPY: { symbol: '¥',  code: 'JPY', locale: 'ja-JP' },
    CAD: { symbol: 'C$', code: 'CAD', locale: 'en-CA' },
    AUD: { symbol: 'A$', code: 'AUD', locale: 'en-AU' }
});

/** Supported themes (must match `[data-theme="..."]` in CSS). */
export const THEMES = Object.freeze(['dark', 'panda', 'peaceful', 'edgy']);

/** Expense vs income — used as `expense.type`. */
export const ENTRY_TYPES = Object.freeze({
    EXPENSE: 'expense',
    INCOME: 'income'
});

/** Default categories used when a user has no saved categories yet. */
export const DEFAULT_CATEGORIES = Object.freeze({
    Income:             { icon: '💰', subcategories: ['Salary', 'Freelance', 'Gift', 'Investment', 'Other'] },
    'Food & Dining':    { icon: '🍔', subcategories: ['Groceries', 'Restaurants', 'Coffee & Snacks', 'Fast Food', 'Delivery', 'Other'] },
    Transportation:     { icon: '🚗', subcategories: ['Fuel/Gas', 'Public Transit', 'Uber/Lyft', 'Parking', 'Car Maintenance', 'Other'] },
    Shopping:           { icon: '🛍️', subcategories: ['Clothes', 'Electronics', 'Home & Garden', 'Gifts', 'Online Shopping', 'Other'] },
    Entertainment:      { icon: '🎬', subcategories: ['Movies', 'Games', 'Streaming Services', 'Concerts/Events', 'Sports', 'Other'] },
    'Bills & Utilities':{ icon: '💡', subcategories: ['Electricity', 'Water', 'Internet', 'Phone', 'Rent/Mortgage', 'Insurance', 'Other'] },
    Healthcare:         { icon: '🏥', subcategories: ['Doctor Visit', 'Medicine', 'Pharmacy', 'Gym/Fitness', 'Dental', 'Other'] },
    Education:          { icon: '📚', subcategories: ['Courses', 'Books', 'Tuition', 'Supplies', 'Subscriptions', 'Other'] },
    'Personal Care':    { icon: '💆', subcategories: ['Haircut', 'Skincare', 'Spa/Massage', 'Cosmetics', 'Other'] },
    Travel:             { icon: '✈️', subcategories: ['Flights', 'Hotels', 'Car Rental', 'Activities', 'Food', 'Other'] },
    Other:              { icon: '📋', subcategories: ['Miscellaneous', 'Charity', 'Gifts Given', 'Fees', 'Other'] }
});

/** Emoji list for the category icon picker. */
export const EMOJI_LIST = Object.freeze([
    // Food & Drink
    '🍔', '🍕', '🍜', '🍣', '🍱', '🥗', '🍰', '🧁', '☕', '🍺', '🍷', '🥤', '🍿', '🧇', '🥙', '🌮', '🍛', '🥘', '🍲', '🥞',
    // Transport
    '🚗', '🚕', '🚌', '🚇', '✈️', '🚁', '🛳️', '🚂', '🛵', '🚲', '🚀', '⛵', '🛺', '🚐', '🚓', '🏎️',
    // Shopping & Money
    '🛍️', '💳', '💰', '💵', '💸', '🏷️', '🛒', '👜', '👗', '👟', '👒', '⌚', '💍', '🕶️', '🎒',
    // Home & Bills
    '🏠', '💡', '🔌', '📱', '💻', '🖥️', '📺', '🔧', '🛁', '🛏️', '🪑', '🧹', '🪴', '📦', '🔑', '🏗️',
    // Health & Fitness
    '🏥', '💊', '🩺', '💉', '🏋️', '🧘', '🚴', '⚕️', '🩹', '🦷', '👓', '🧴',
    // Education
    '📚', '🎓', '✏️', '📝', '🖊️', '📐', '🧪', '🔬', '🏫', '📖', '🗂️', '📋', '🧑‍💻',
    // Entertainment
    '🎬', '🎮', '🎵', '🎸', '🎤', '🎭', '🎨', '🎪', '🎯', '🎳', '🎲', '♟️', '🎻', '🎹', '📷',
    // Personal Care
    '💆', '💅', '🪥', '🧖', '💄', '🪒', '🪞', '👔', '👕',
    // Travel & Places
    '🗺️', '🏖️', '🏕️', '🗼', '🏔️', '🌅', '🏟️', '🌍', '🗽', '🏯', '🎡', '⛺',
    // Nature
    '🌿', '🌸', '🌺', '🍀', '🌻', '🍁', '🐾', '🐶', '🐱', '🌈', '⭐', '🌙', '☀️', '❄️',
    // Work & Office
    '💼', '📊', '📈', '📉', '🗓️', '🖇️', '📌', '📎', '🗃️', '📁', '📂', '🖨️', '📠', '🔐', '🏢',
    // Misc / Symbols
    '🎁', '🎀', '🪙', '⚡', '🔔', '🏆', '🥇', '🎖️', '🛡️', '🔖', '❓', '💬', '🔄', '♻️'
]);
