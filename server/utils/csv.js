export function escapeCsvValue(value) {
  if (value === null || value === undefined) {
    return '';
  }

  let text = String(value);

  // Prevent CSV Formula Injection (prefix with single quote if starts with formula trigger)
  if (/^[=+\-@\t\r]/.test(text)) {
    text = `'${text}`;
  }

  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
}

export function toCsv(headers, rows) {
  const headerLine = headers.map((header) => escapeCsvValue(header.label)).join(',');
  const dataLines = rows.map((row) =>
    headers.map((header) => escapeCsvValue(row[header.key])).join(',')
  );

  return [headerLine, ...dataLines].join('\r\n');
}
