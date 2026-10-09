/** 27 becomes "2 yr 3 mo"; 12 becomes "1 yr"; 0 becomes "0 mo". */
export function formatMonths(totalMonths: number): string {
  const years = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;
  const parts = [years > 0 ? `${years} yr` : '', months > 0 || years === 0 ? `${months} mo` : ''];
  return parts.filter(Boolean).join(' ');
}
