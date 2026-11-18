import { apiFetch, can } from '$lib/sdk/client';
import type { BankSuggestion } from '../schemas';

/** Kontovorschläge aus der Kasse: braucht `actions.payout.view` und `treasury.bank.view` */
export function canSuggestBank(permissions: readonly string[]): boolean {
	return can(permissions, 'actions.payout.view') && can(permissions, 'treasury.bank.view');
}

export function loadBankSuggestions(search: string): Promise<BankSuggestion[]> {
	return apiFetch<BankSuggestion[]>(
		`/modules/actions/bank-suggestions?search=${encodeURIComponent(search)}`
	);
}

/** Klartext der gewählten Bankverbindung (wird serverseitig auditiert) */
export function loadBankAccount(
	ref: string
): Promise<{ holder: string; iban: string; bic: string | null }> {
	return apiFetch(`/modules/actions/bank-suggestions/${encodeURIComponent(ref)}`);
}

export const bankTitle = (s: BankSuggestion): string => s.holder ?? s.name;

export function bankDetail(s: BankSuggestion): string {
	return [
		s.holder && s.holder !== s.name ? s.name : null,
		s.ibanMasked,
		s.kind === 'payer' ? 'Zahler (Kasse)' : 'Empfänger (Kasse)'
	]
		.filter(Boolean)
		.join(' · ');
}
