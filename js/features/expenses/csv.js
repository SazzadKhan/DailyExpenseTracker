// js/features/expenses/csv.js
// CSV export + import for the expense list.
//
// Wiring: `mount()` binds the #export-csv button, #import-csv button, and
// the hidden #import-csv-input file picker.
//
// State: pulls expenses + settings from the store. Mutations go through
// ./actions.js (setAll for replace, add isn't used here — imported entries
// already have ids), so EXPENSES_CHANGED fires and list.js re-renders.
//
// Cloud sync: setAll skips cloud by design; we call pushAllToCloud() from
// features/sync after a replace/merge import if signed in.

import { store } from '../../core/store.js';
import { log } from '../../core/log.js';
import { dialog } from '../../services/dialog.js';
import { storage } from '../../services/storage.js';
import { showToast } from '../../core/toast.js';
import { normalizeDateString } from '../../core/format.js';
import { setAll as setAllExpenses } from './actions.js';
import { pushAllToCloud } from '../sync/index.js';
import { checkBudgetAlert } from '../budget/index.js';

const $log = log('expenses/csv');

function getExpenses() { return store.getState().expenses || []; }
function getCurrency() { return store.getState().settings?.currency || 'USD'; }

// ===== Export =====
export function exportToCSV() {
    const expenses = getExpenses();
    if (expenses.length === 0) {
        showToast('No expenses to export', 'warning');
        return;
    }

    const defaultCurrency = getCurrency();
    const headers = ['Date', 'Category', 'Subcategory', 'Amount', 'Currency', 'Description'];
    const csvRows = [headers.join(',')];

    expenses.forEach(e => {
        const row = [
            e.date,
            `"${(e.category || '').replace(/"/g, '""')}"`,
            `"${(e.subcategory || '').replace(/"/g, '""')}"`,
            parseFloat(e.amount).toFixed(2),
            e.currency || defaultCurrency,
            `"${(e.description || '').replace(/"/g, '""')}"`
        ];
        csvRows.push(row.join(','));
    });

    const csvContent = csvRows.join('\r\n');
    const filename = `expenses_${new Date().toISOString().split('T')[0]}.csv`;

    const encodedContent = encodeURIComponent(csvContent);
    const dataUri = 'data:text/csv;charset=utf-8,' + encodedContent;

    const link = document.createElement('a');
    link.setAttribute('href', dataUri);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    $log.info(`exported ${expenses.length} entries -> ${filename}`);
}

// ===== Import =====
export function importFromCSV(file) {
    const reader = new FileReader();

    reader.onload = async function (e) {
        try {
            const content = e.target.result;
            const lines = content.split('\n').filter(line => line.trim());

            if (lines.length < 2) {
                await dialog.alert({ title: 'Import failed', message: 'CSV file is empty or has no data rows.', tone: 'error' });
                return;
            }

            const header = parseCSVLine(lines[0]).map(h => h.toLowerCase().trim());

            const dateIdx = header.findIndex(h => h === 'date');
            const categoryIdx = header.findIndex(h => h === 'category');
            const subcategoryIdx = header.findIndex(h => h === 'subcategory');
            const amountIdx = header.findIndex(h => h === 'amount');
            const descriptionIdx = header.findIndex(h => h === 'description' || h === 'notes');
            const currencyIdx = header.findIndex(h => h === 'currency');

            if (dateIdx === -1 || categoryIdx === -1 || amountIdx === -1) {
                await dialog.alert({ title: 'Import failed', message: 'CSV must have at least Date, Category, and Amount columns.', tone: 'error' });
                return;
            }

            const defaultCurrency = getCurrency();
            const newExpenses = [];
            const errors = [];

            for (let i = 1; i < lines.length; i++) {
                const values = parseCSVLine(lines[i]);
                if (values.length < 3) continue;

                const date = values[dateIdx]?.trim();
                const category = values[categoryIdx]?.trim();
                const amount = parseFloat(values[amountIdx]?.trim().replace(/[^0-9.-]/g, ''));
                const subcategory = subcategoryIdx !== -1 ? values[subcategoryIdx]?.trim() : 'Other';
                const description = descriptionIdx !== -1 ? values[descriptionIdx]?.trim() : '';
                const currency = currencyIdx !== -1 ? values[currencyIdx]?.trim() : defaultCurrency;

                if (!date || !category || isNaN(amount)) {
                    errors.push(`Row ${i + 1}: Invalid data`);
                    continue;
                }

                const formattedDate = normalizeDateString(date);
                if (!formattedDate || !formattedDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
                    errors.push(`Row ${i + 1}: Invalid date format`);
                    continue;
                }

                newExpenses.push({
                    id: Date.now().toString() + '_' + i,
                    date: formattedDate,
                    category,
                    subcategory: subcategory || 'Other',
                    amount,
                    description,
                    currency
                });
            }

            if (newExpenses.length === 0) {
                await dialog.alert({
                    title: 'Nothing to import',
                    message: 'No valid expenses found in CSV file.' + (errors.length ? '\n\nErrors:\n' + errors.slice(0, 5).join('\n') : ''),
                    tone: 'error'
                });
                return;
            }

            const action = await dialog.confirm({
                title: `Import ${newExpenses.length} entries?`,
                message:
                    (errors.length > 0 ? `${errors.length} rows had errors and were skipped.\n\n` : '') +
                    `Choose “Add” to merge with existing entries, or “Replace” to overwrite everything.`,
                confirmText: 'Add',
                cancelText: 'Replace'
            });

            let nextList;
            if (action) {
                nextList = [...getExpenses(), ...newExpenses];
            } else {
                const confirmReplace = await dialog.confirm({
                    title: 'Replace all entries?',
                    message: 'This will DELETE all existing entries and replace them with the imported data.',
                    confirmText: 'Replace',
                    tone: 'danger'
                });
                if (!confirmReplace) return;
                nextList = newExpenses;
            }

            setAllExpenses(nextList);

            if (storage.isCloud?.()) {
                try { pushAllToCloud(); }
                catch (err) { $log.warn('pushAllToCloud failed', err); }
            }

            checkBudgetAlert();

            showToast(`Imported ${newExpenses.length} entries`, 'success');

        } catch (error) {
            $log.error('CSV import error', error);
            await dialog.alert({ title: 'Import failed', message: 'Failed to parse CSV file. Please check the format.', tone: 'error' });
        }
    };

    reader.readAsText(file);
}

// Helper: parse one CSV line, respecting "quoted, values" with "" escapes.
export function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
            if (inQuotes && line[i + 1] === '"') {
                current += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (char === ',' && !inQuotes) {
            result.push(current);
            current = '';
        } else {
            current += char;
        }
    }
    result.push(current);
    return result.map(v => v.replace(/^"|"$/g, '').trim());
}

export function mount() {
    const exportBtn = document.getElementById('export-csv');
    const importBtn = document.getElementById('import-csv');
    const fileInput = document.getElementById('import-csv-input');

    exportBtn?.addEventListener('click', exportToCSV);
    importBtn?.addEventListener('click', () => fileInput?.click());
    fileInput?.addEventListener('change', (e) => {
        const f = e.target.files?.[0];
        if (f) {
            importFromCSV(f);
            e.target.value = '';
        }
    });

    $log.info('mounted');
}
