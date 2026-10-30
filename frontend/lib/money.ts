/** Amounts travel as whole piasters (contract rule): 150000 = EGP 1,500. */
export const PIASTERS_PER_POUND = 100;

export function formatMoney(piasters: number, locale: string): string {
  const pounds = piasters / PIASTERS_PER_POUND;
  const number = new Intl.NumberFormat("en-US", {
    maximumFractionDigits: Number.isInteger(pounds) ? 0 : 2,
  }).format(pounds);
  return locale === "ar" ? `${number} ج.م` : `EGP ${number}`;
}

export function percentOf(piasters: number, percent: number): number {
  return Math.round((piasters * percent) / 100);
}
