// js/features/categories/categories.model.js
// Pure helpers for the categories shape. NO DOM, NO globals.

import { DEFAULT_CATEGORIES } from '../../core/constants.js';

/** Category names that count as income for stats/UI purposes. */
export const INCOME_CATEGORY_NAMES = Object.freeze(['Income']);

/** @param {string} name */
export const isIncomeCategory = (name) => INCOME_CATEGORY_NAMES.includes(name);

/** Names that should not be deleted / renamed. */
export const DEFAULT_CATEGORY_NAMES = Object.freeze(Object.keys(DEFAULT_CATEGORIES));

/** @param {string} name */
export const isDefaultCategory = (name) => DEFAULT_CATEGORY_NAMES.includes(name);

/**
 * Split categories into income / expense groups, preserving insertion order.
 * @param {import('../../core/schema.js').Categories} categories
 */
export function splitByType(categories) {
    const entries = Object.entries(categories);
    return {
        income:  entries.filter(([n]) => isIncomeCategory(n)),
        expense: entries.filter(([n]) => !isIncomeCategory(n))
    };
}

/**
 * Return subcategory names for a category, or an empty array.
 * @param {import('../../core/schema.js').Categories} categories
 * @param {string} name
 */
export function subcategoriesOf(categories, name) {
    return categories[name]?.subcategories ?? [];
}
