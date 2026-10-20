export function isPdf(file) {
  return Boolean(file && /\.pdf$/i.test(file.name || '') &&
    ['', 'application/pdf', 'application/octet-stream'].includes((file.type || '').toLowerCase()));
}
