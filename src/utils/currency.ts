const SYMBOLS: Record<string, string> = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  JPY: '¥',
  INR: '₹',
  CHF: 'CHF ',
  CAD: 'C$',
  AUD: 'A$',
};

export function formatAmount(amount: number, currencyCode?: string | null): string {
  const code = (currencyCode ?? 'GBP').toUpperCase();
  const symbol = SYMBOLS[code] ?? `${code} `;
  return `${symbol}${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
