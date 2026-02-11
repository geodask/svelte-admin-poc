type ExportFormat = 'csv' | 'json';

type ExportColumn = {
	key: string;
	header: string;
};

function resolveValue(obj: Record<string, unknown>, key: string): unknown {
	return key.split('.').reduce((acc: unknown, part) => {
		if (acc == null) return undefined;
		return (acc as Record<string, unknown>)[part];
	}, obj);
}

function formatValue(value: unknown): string {
	if (value == null) return '';
	if (Array.isArray(value)) return value.join(', ');
	if (typeof value === 'object') return JSON.stringify(value);
	return String(value);
}

function toCsv(rows: Record<string, unknown>[], columns: ExportColumn[]): string {
	const header = columns.map((c) => `"${c.header.replace(/"/g, '""')}"`).join(',');
	const body = rows.map((row) =>
		columns
			.map((col) => {
				const val = formatValue(resolveValue(row, col.key));
				return `"${val.replace(/"/g, '""')}"`;
			})
			.join(',')
	);
	return [header, ...body].join('\n');
}

function toJson(rows: Record<string, unknown>[], columns: ExportColumn[]): string {
	const mapped = rows.map((row) => {
		const obj: Record<string, unknown> = {};
		for (const col of columns) {
			obj[col.header] = resolveValue(row, col.key);
		}
		return obj;
	});
	return JSON.stringify(mapped, null, 2);
}

function downloadBlob(content: string, filename: string, mimeType: string) {
	const blob = new Blob([content], { type: mimeType });
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = filename;
	a.click();
	URL.revokeObjectURL(url);
}

export function exportData(
	rows: Record<string, unknown>[],
	columns: ExportColumn[],
	filename: string,
	format: ExportFormat = 'csv'
) {
	if (format === 'csv') {
		downloadBlob(toCsv(rows, columns), `${filename}.csv`, 'text/csv;charset=utf-8;');
	} else {
		downloadBlob(toJson(rows, columns), `${filename}.json`, 'application/json');
	}
}

export type { ExportFormat, ExportColumn };
