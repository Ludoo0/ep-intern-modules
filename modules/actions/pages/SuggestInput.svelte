<script lang="ts" generics="T">
	import { Input } from '$lib/components/ui/input';

	/**
	 * Freitext mit Vorschlägen vom Server (ab 2 Zeichen, verzögert). Ein Klick auf einen Vorschlag ruft
	 * `onpick` auf; Freitext bleibt immer möglich. Ohne `active` ein normales Eingabefeld.
	 */
	let {
		id,
		value = $bindable(''),
		maxlength,
		placeholder,
		active = true,
		invalid = false,
		describedby,
		disabled = false,
		required = false,
		load,
		keyOf,
		title,
		detail,
		badge,
		onpick
	}: {
		id: string;
		value?: string;
		maxlength?: number;
		placeholder?: string;
		active?: boolean;
		invalid?: boolean;
		describedby?: string;
		disabled?: boolean;
		required?: boolean;
		load: (search: string) => Promise<T[]>;
		keyOf: (item: T) => string;
		title: (item: T) => string;
		detail?: (item: T) => string;
		/** Kurzer Hinweis rechts (z. B. „bereits angemeldet“) */
		badge?: (item: T) => string | null;
		onpick: (item: T) => void;
	} = $props();

	let open = $state(false);
	let items = $state<T[]>([]);
	let highlighted = $state(-1);
	let timer: ReturnType<typeof setTimeout> | undefined;
	let seq = 0;

	function schedule() {
		clearTimeout(timer);
		const q = value.trim();
		if (!active || q.length < 2) {
			items = [];
			return;
		}
		const mine = ++seq;
		timer = setTimeout(async () => {
			try {
				const res = await load(q);
				if (mine === seq) {
					items = res;
					highlighted = -1;
				}
			} catch {
				if (mine === seq) items = [];
			}
		}, 250);
	}

	function pick(item: T) {
		open = false;
		items = [];
		onpick(item);
	}

	function onkeydown(e: KeyboardEvent) {
		if (!open || !items.length) return;
		if (e.key === 'ArrowDown') {
			e.preventDefault();
			highlighted = (highlighted + 1) % items.length;
		} else if (e.key === 'ArrowUp') {
			e.preventDefault();
			highlighted = highlighted <= 0 ? items.length - 1 : highlighted - 1;
		} else if (e.key === 'Enter' && highlighted >= 0) {
			e.preventDefault();
			pick(items[highlighted]!);
		} else if (e.key === 'Escape') {
			open = false;
		}
	}
</script>

<div class="relative">
	<Input
		{id}
		bind:value
		{maxlength}
		{placeholder}
		{disabled}
		{required}
		autocomplete="off"
		role={active ? 'combobox' : undefined}
		aria-invalid={invalid}
		aria-describedby={describedby}
		aria-expanded={active ? open && items.length > 0 : undefined}
		aria-controls={active ? `${id}-list` : undefined}
		aria-autocomplete={active ? 'list' : undefined}
		aria-activedescendant={open && highlighted >= 0 ? `${id}-opt-${highlighted}` : undefined}
		oninput={() => {
			open = true;
			schedule();
		}}
		onfocus={() => (open = true)}
		onblur={() => setTimeout(() => (open = false), 150)}
		{onkeydown}
	/>
	{#if active && open && items.length}
		<ul
			id={`${id}-list`}
			role="listbox"
			class="absolute z-50 mt-1 max-h-64 w-full overflow-auto rounded-md border bg-popover p-1 shadow-md"
		>
			{#each items as item, i (keyOf(item))}
				{@const hint = badge?.(item) ?? null}
				<li id={`${id}-opt-${i}`} role="option" aria-selected={i === highlighted}>
					<button
						type="button"
						tabindex="-1"
						class="flex w-full items-start justify-between gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-accent {i ===
						highlighted
							? 'bg-accent'
							: ''}"
						onmousedown={(e) => e.preventDefault()}
						onclick={() => pick(item)}
					>
						<span class="flex min-w-0 flex-col">
							<span class="truncate font-medium">{title(item)}</span>
							{#if detail}
								<span class="truncate text-xs text-muted-foreground">{detail(item)}</span>
							{/if}
						</span>
						{#if hint}
							<span class="shrink-0 text-xs text-muted-foreground">{hint}</span>
						{/if}
					</button>
				</li>
			{/each}
		</ul>
	{/if}
</div>
