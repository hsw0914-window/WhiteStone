export function formatTime(isoStr) {
  if (!isoStr) return '';
  try {
    const d = new Date(isoStr.replace(' ', 'T'));
    if (isNaN(d.getTime())) return isoStr;
    const now = new Date();
    const sameDay = d.toDateString() === now.toDateString();
    if (sameDay) {
      return d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
    }
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) return '어제';
    return d.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}
