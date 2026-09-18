/**
 * Formata uma data para o padrão DD/MM/AAAA
 * @param date Data a ser formatada (Date, número ou string ISO)
 * @returns String formatada como DD/MM/AAAA
 */
export function formatDateDDMMYYYY(date: Date | number | string): string {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return String(date);

  const day = d.getDate().toString().padStart(2, '0');
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const year = d.getFullYear();

  return `${day}/${month}/${year}`;
}
