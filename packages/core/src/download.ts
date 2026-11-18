// Saving a file in the browser, for a list View's export. Browser-only: it touches `document`.

/** Save `csv` as a file named `filename`, through a link to it that is clicked and removed. */
export function downloadCsv(csv: string, filename: string): void {
	const href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
	const link = Object.assign(document.createElement('a'), { href, download: filename });
	document.body.append(link);
	link.click();
	link.remove();
	// After the click has started the download.
	setTimeout(() => URL.revokeObjectURL(href));
}

/** Today as `YYYY-MM-DD`, in the browser's own time zone. */
export function today(): string {
	const now = new Date();
	const pad = (value: number) => String(value).padStart(2, '0');
	return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}
