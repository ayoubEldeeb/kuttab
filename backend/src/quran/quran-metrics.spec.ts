import { AYAH_LETTERS } from './quran-metrics.data.js';
import { ayahCountOf, describeSegments, measurePortion, surahName } from './quran-metrics.js';

describe('quran metrics data', () => {
  it('has 114 surahs and 6236 ayat', () => {
    expect(AYAH_LETTERS).toHaveLength(114);
    expect(AYAH_LETTERS.flat()).toHaveLength(6236);
    expect(ayahCountOf(2)).toBe(286);
    expect(ayahCountOf(114)).toBe(6);
    expect(surahName(58)).toBe('المجادلة');
  });

  it('the whole Quran measures 480 athman', () => {
    const all = AYAH_LETTERS.map((a, i) => ({ surah: i + 1, fromAyah: 1, toAyah: a.length }));
    const m = measurePortion(all);
    expect(m.ayahCount).toBe(6236);
    expect(m.thumnAmount).toBe(480);
  });
});

describe('measurePortion', () => {
  it('counts ayat exactly (ayah 5 to 10 = 6 ayat)', () => {
    const m = measurePortion([{ surah: 78, fromAyah: 5, toAyah: 10 }]);
    expect(m.errors).toEqual([]);
    expect(m.ayahCount).toBe(6);
    expect(m.thumnAmount).toBeGreaterThan(0);
  });

  it('weights long ayat more than short ones', () => {
    const shortAyat = measurePortion([{ surah: 112, fromAyah: 1, toAyah: 4 }]); // Al-Ikhlas
    const longAyah = measurePortion([{ surah: 2, fromAyah: 282, toAyah: 282 }]); // the longest ayah
    expect(shortAyat.ayahCount).toBe(4);
    expect(longAyah.ayahCount).toBe(1);
    expect(longAyah.thumnAmount).toBeGreaterThan(shortAyat.thumnAmount);
  });

  it('sums several surahs in one portion', () => {
    const m = measurePortion([
      { surah: 80, fromAyah: 30, toAyah: 42 },
      { surah: 79, fromAyah: 1, toAyah: 5 },
    ]);
    expect(m.ayahCount).toBe(18);
    expect(describeSegments(m.segments)).toBe('عبس 30–42، النازعات 1–5');
  });

  it('reports invalid input in Arabic', () => {
    expect(measurePortion([]).errors.length).toBe(1);
    expect(measurePortion([{ surah: 0, fromAyah: 1, toAyah: 2 }]).errors[0]).toContain('السورة');
    expect(measurePortion([{ surah: 78, fromAyah: 10, toAyah: 5 }]).errors[0]).toContain('أرقام الآيات');
    expect(measurePortion([{ surah: 114, fromAyah: 1, toAyah: 40 }]).errors[0]).toContain('عدد آياتها 6');
  });

  it('accepts small numbering differences between readings', () => {
    const m = measurePortion([{ surah: 2, fromAyah: 280, toAyah: 287 }]);
    expect(m.errors).toEqual([]);
    expect(m.ayahCount).toBe(8);
  });
});
