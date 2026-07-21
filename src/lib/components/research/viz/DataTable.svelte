<!--
  The "as a table" fallback every graph offers — the raw numbers behind the picture, for a screen
  reader, for a copy-paste, and for anyone who trusts a column over a shape. Pure presentation: it
  takes columns + rows and renders a plain table, tabular-nums on the numeric columns. A graph keeps
  one of these in a <details> beside it, so the numbers are never pixels-only.
-->
<script lang="ts">
	interface Column {
		key: string;
		label: string;
		/** Right-aligned + tabular figures — the default, since most graph data is numeric. */
		numeric?: boolean;
	}

	let {
		caption,
		columns,
		rows
	}: {
		caption: string;
		columns: Column[];
		rows: Record<string, string | number>[];
	} = $props();
</script>

<table>
	<caption>{caption}</caption>
	<thead>
		<tr>
			{#each columns as column (column.key)}
				<th scope="col" class:numeric={column.numeric ?? true}>{column.label}</th>
			{/each}
		</tr>
	</thead>
	<tbody>
		{#each rows as row, i (i)}
			<tr>
				{#each columns as column (column.key)}
					<td class:numeric={column.numeric ?? true} class:tabular={column.numeric ?? true}>
						{row[column.key]}
					</td>
				{/each}
			</tr>
		{/each}
	</tbody>
</table>

<style>
	table {
		width: 100%;
		border-collapse: collapse;
		font-size: var(--fs-sm);
	}

	caption {
		text-align: left;
		font-size: var(--fs-eyebrow);
		font-weight: var(--fw-semibold);
		letter-spacing: var(--tracking-wide);
		text-transform: uppercase;
		color: var(--ink3);
		padding-bottom: var(--sp-2);
	}

	th,
	td {
		padding: 5px var(--sp-3);
		text-align: left;
		border-bottom: 1px solid var(--line);
	}

	th {
		font-weight: var(--fw-semibold);
		color: var(--ink2);
	}

	td {
		color: var(--ink);
	}

	.numeric {
		text-align: right;
	}
</style>
