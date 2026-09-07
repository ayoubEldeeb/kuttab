export const formatPart = (part: string | null) => {
  if (!part) return '';
  
  if (part.includes('|')) {
    return part.split('|')[1].trim();
  }
  
  if (part.includes('سورة') && part.includes('(') && part.includes('-')) {
    const surahPart = part.substring(part.indexOf('سورة'), part.indexOf('-')).trim();
    const ayahPart = part.substring(part.indexOf('(')).trim();
    return `${surahPart} ${ayahPart}`;
  }
  
  return part;
};
