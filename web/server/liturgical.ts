/**
 * liturgical.ts — computed liturgical calendar for both rites.
 *
 * Roman (international) rite: Gregorian computus, seasons, Sunday cycle
 * (A/B/C), weekday cycle (I/II), major fixed + movable celebrations.
 *
 * Ge'ez rite (Ethiopian): Ethiopian calendar conversion, weekday/month
 * names, Fasika via the Julian computus (the traditional Bahire Hasab
 * result), movable feasts by fixed offsets from Fasika, fixed feasts and
 * fasting seasons shared by the Ethiopian Catholic and Tewahedo calendars.
 *
 * Everything here is algorithmic — no AI, no lookup tables of readings.
 * Daily READINGS live in the daily_readings table (see api/readings.ts).
 */

// ---------- shared date helpers ----------
const DAY = 86400000;
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * DAY);
const ymd = (d: Date) =>
  `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
const utc = (y: number, m: number, day: number) => new Date(Date.UTC(y, m - 1, day));
const sameDay = (a: Date, b: Date) => ymd(a) === ymd(b);
const sundayOnOrBefore = (d: Date) => addDays(d, -d.getUTCDay());

// ---------- Roman rite ----------
/** Anonymous Gregorian computus (Meeus/Jones/Butcher). */
export function gregorianEaster(year: number): Date {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return utc(year, month, day);
}

function advent1(year: number): Date {
  // 4th Sunday before Christmas: the Sunday on/before Dec 24, minus 3 weeks
  const advent4 = sundayOnOrBefore(utc(year, 12, 24));
  return addDays(advent4, -21);
}

interface Celebration { name: string; nameAm: string; rank: string; color: string }

// major fixed celebrations (month-day → celebration)
const ROMAN_FIXED: Record<string, Celebration> = {
  '01-01': { name: 'Mary, Mother of God', nameAm: 'ቅድስት ማርያም የአምላክ እናት', rank: 'solemnity', color: 'white' },
  '01-06': { name: 'Epiphany of the Lord', nameAm: 'በዓለ አስተርእዮ (ኤጲፋንያ)', rank: 'solemnity', color: 'white' },
  '02-02': { name: 'Presentation of the Lord', nameAm: 'በዓለ ስምዖን (የጌታ መባ)', rank: 'feast', color: 'white' },
  '03-19': { name: 'St Joseph', nameAm: 'ቅዱስ ዮሴፍ', rank: 'solemnity', color: 'white' },
  '03-25': { name: 'Annunciation of the Lord', nameAm: 'ብሥራተ ገብርኤል', rank: 'solemnity', color: 'white' },
  '05-31': { name: 'Visitation of the BVM', nameAm: 'የማርያም ጉብኝት', rank: 'feast', color: 'white' },
  '06-24': { name: 'Nativity of John the Baptist', nameAm: 'ልደተ ዮሐንስ መጥምቅ', rank: 'solemnity', color: 'white' },
  '06-29': { name: 'Sts Peter and Paul', nameAm: 'ቅዱሳን ጴጥሮስና ጳውሎስ', rank: 'solemnity', color: 'red' },
  '07-03': { name: 'St Thomas the Apostle', nameAm: 'ቅዱስ ቶማስ ሐዋርያ', rank: 'feast', color: 'red' },
  '07-22': { name: 'St Mary Magdalene', nameAm: 'ቅድስት ማርያም መግደላዊት', rank: 'feast', color: 'white' },
  '07-25': { name: 'St James the Apostle', nameAm: 'ቅዱስ ያዕቆብ ሐዋርያ', rank: 'feast', color: 'red' },
  '08-06': { name: 'Transfiguration of the Lord', nameAm: 'በዓለ ደብረ ታቦር', rank: 'feast', color: 'white' },
  '08-10': { name: 'St Lawrence', nameAm: 'ቅዱስ ላውሬንዮስ', rank: 'feast', color: 'red' },
  '08-15': { name: 'Assumption of the BVM', nameAm: 'ፍልሰታ ለማርያም', rank: 'solemnity', color: 'white' },
  '08-24': { name: 'St Bartholomew the Apostle', nameAm: 'ቅዱስ በርተሎሜዎስ ሐዋርያ', rank: 'feast', color: 'red' },
  '09-08': { name: 'Nativity of the BVM', nameAm: 'ልደታ ለማርያም', rank: 'feast', color: 'white' },
  '09-14': { name: 'Exaltation of the Holy Cross', nameAm: 'በዓለ መስቀል', rank: 'feast', color: 'red' },
  '09-21': { name: 'St Matthew the Apostle', nameAm: 'ቅዱስ ማቴዎስ ሐዋርያ', rank: 'feast', color: 'red' },
  '09-29': { name: 'Sts Michael, Gabriel, Raphael', nameAm: 'ቅዱሳን ሚካኤል፣ ገብርኤል፣ ሩፋኤል', rank: 'feast', color: 'white' },
  '10-18': { name: 'St Luke the Evangelist', nameAm: 'ቅዱስ ሉቃስ ወንጌላዊ', rank: 'feast', color: 'red' },
  '10-28': { name: 'Sts Simon and Jude', nameAm: 'ቅዱሳን ስምዖንና ይሁዳ ሐዋርያት', rank: 'feast', color: 'red' },
  '11-01': { name: 'All Saints', nameAm: 'የቅዱሳን ሁሉ በዓል', rank: 'solemnity', color: 'white' },
  '11-02': { name: 'All Souls', nameAm: 'የሙታን ሁሉ መታሰቢያ', rank: 'commemoration', color: 'purple' },
  '11-30': { name: 'St Andrew the Apostle', nameAm: 'ቅዱስ እንድርያስ ሐዋርያ', rank: 'feast', color: 'red' },
  '12-08': { name: 'Immaculate Conception', nameAm: 'ንጽሕት ፅንሰታ ለማርያም', rank: 'solemnity', color: 'white' },
  '12-25': { name: 'Nativity of the Lord', nameAm: 'የጌታ ልደት (ገና)', rank: 'solemnity', color: 'white' },
  '12-26': { name: 'St Stephen, first martyr', nameAm: 'ቅዱስ እስጢፋኖስ ቀዳሜ ሰማዕት', rank: 'feast', color: 'red' },
  '12-27': { name: 'St John the Evangelist', nameAm: 'ቅዱስ ዮሐንስ ወንጌላዊ', rank: 'feast', color: 'white' },
  '12-28': { name: 'Holy Innocents', nameAm: 'ሕፃናተ ቤተልሔም ሰማዕታት', rank: 'feast', color: 'red' },
};

export interface RomanDay {
  date: string;
  season: string;
  seasonAm: string;
  week: number | null;
  sundayCycle: 'A' | 'B' | 'C';
  weekdayCycle: 'I' | 'II';
  dayName: string;             // e.g. "Friday of the 13th Week in Ordinary Time"
  celebration: Celebration | null;
  color: string;
}

export function romanDay(date: Date): RomanDay {
  const y = date.getUTCFullYear();
  const easter = gregorianEaster(y);
  const ashWed = addDays(easter, -46);
  const palmSun = addDays(easter, -7);
  const holyThu = addDays(easter, -3);
  const pentecost = addDays(easter, 49);
  const adv1 = advent1(y);
  const christmas = utc(y, 12, 25);
  const epiphany = utc(y, 1, 6);
  const baptism = addDays(sundayOnOrBefore(epiphany), 7); // Sunday after Jan 6
  const afterAdvent = date >= adv1;

  // cycles: liturgical years run Advent→Advent
  const cycleYear = afterAdvent ? y + 1 : y;
  const sundayCycle = (['C', 'A', 'B'] as const)[cycleYear % 3];
  const weekdayCycle = cycleYear % 2 === 0 ? 'II' : 'I';

  const weekdayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const wd = weekdayNames[date.getUTCDay()];

  let season = '', seasonAm = '', week: number | null = null, color = 'green';

  if (afterAdvent && date < christmas) {
    season = 'Advent'; seasonAm = 'የስብከት ዘመን (አድቬንት)'; color = 'purple';
    week = Math.floor((date.getTime() - adv1.getTime()) / (7 * DAY)) + 1;
  } else if (date >= christmas || date < baptism) {
    season = 'Christmas'; seasonAm = 'የልደት ዘመን'; color = 'white'; week = null;
  } else if (date >= ashWed && date < holyThu) {
    season = 'Lent'; seasonAm = 'ዓቢይ ጾም'; color = 'purple';
    const lent1 = addDays(ashWed, 4); // 1st Sunday of Lent
    week = date < lent1 ? 0 : Math.floor((date.getTime() - lent1.getTime()) / (7 * DAY)) + 1;
    if (date >= palmSun) { season = 'Holy Week'; seasonAm = 'ሰሙነ ሕማማት'; color = 'red'; week = null; }
  } else if (date >= holyThu && date < easter) {
    season = 'Sacred Triduum'; seasonAm = 'ሥሉስ ቅዱሳት ዕለታት'; color = 'red'; week = null;
  } else if (date >= easter && date <= pentecost) {
    season = 'Easter'; seasonAm = 'የትንሣኤ ዘመን'; color = 'white';
    week = Math.floor((date.getTime() - easter.getTime()) / (7 * DAY)) + 1;
  } else {
    season = 'Ordinary Time'; seasonAm = 'የተራ ዘመን'; color = 'green';
    if (date < ashWed) {
      week = Math.floor((date.getTime() - addDays(baptism, 1).getTime()) / (7 * DAY)) + 1;
      // week 1 starts the day after the Baptism (its Sunday counts as week 1's Sunday)
      week = Math.floor((sundayOnOrBefore(date).getTime() - sundayOnOrBefore(baptism).getTime()) / (7 * DAY));
      if (sameDay(date, baptism)) week = 1;
    } else {
      // post-Pentecost: number backward from Christ the King (= week 34)
      const ctk = addDays(adv1, -7);
      week = 34 - Math.floor((sundayOnOrBefore(ctk).getTime() - sundayOnOrBefore(date).getTime()) / (7 * DAY));
    }
  }

  // movable celebrations
  const movables: Array<[Date, Celebration]> = [
    [ashWed, { name: 'Ash Wednesday', nameAm: 'ረቡዕ አመድ', rank: 'special', color: 'purple' }],
    [palmSun, { name: 'Palm Sunday', nameAm: 'ሆሣዕና', rank: 'sunday', color: 'red' }],
    [holyThu, { name: 'Holy Thursday', nameAm: 'ጸሎተ ሐሙስ', rank: 'triduum', color: 'white' }],
    [addDays(easter, -2), { name: 'Good Friday', nameAm: 'ስቅለት (ዓርብ ስቅለት)', rank: 'triduum', color: 'red' }],
    [addDays(easter, -1), { name: 'Holy Saturday', nameAm: 'ቅዳሜ ሥዑር', rank: 'triduum', color: 'white' }],
    [easter, { name: 'Easter Sunday', nameAm: 'ትንሣኤ', rank: 'solemnity', color: 'white' }],
    [addDays(easter, 7), { name: 'Divine Mercy Sunday', nameAm: 'የመለኮታዊ ምሕረት እሑድ', rank: 'sunday', color: 'white' }],
    [addDays(easter, 39), { name: 'Ascension of the Lord', nameAm: 'ዕርገት', rank: 'solemnity', color: 'white' }],
    [pentecost, { name: 'Pentecost', nameAm: 'ጰራቅሊጦስ (በዓለ ኀምሳ)', rank: 'solemnity', color: 'red' }],
    [addDays(easter, 56), { name: 'The Most Holy Trinity', nameAm: 'ቅድስት ሥላሴ', rank: 'solemnity', color: 'white' }],
    [addDays(easter, 63), { name: 'Corpus Christi', nameAm: 'የክርስቶስ ሥጋና ደም በዓል', rank: 'solemnity', color: 'white' }],
    [addDays(easter, 68), { name: 'Sacred Heart of Jesus', nameAm: 'ቅዱስ ልበ ኢየሱስ', rank: 'solemnity', color: 'white' }],
    [addDays(adv1, -7), { name: 'Christ the King', nameAm: 'ክርስቶስ ንጉሥ', rank: 'solemnity', color: 'white' }],
  ];
  let celebration: Celebration | null = null;
  for (const [d, c] of movables) if (sameDay(date, d)) celebration = c;
  if (!celebration) {
    const key = `${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
    celebration = ROMAN_FIXED[key] ?? null;
  }
  if (celebration) color = celebration.color;

  const ordinal = (n: number) => {
    const s = ['th', 'st', 'nd', 'rd'], v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  };
  const dayName = celebration
    ? celebration.name
    : week !== null && season === 'Ordinary Time'
      ? `${wd} of the ${ordinal(week)} Week in Ordinary Time`
      : week !== null
        ? `${wd} of the ${ordinal(week)} Week of ${season}`
        : `${wd} — ${season}`;

  return { date: ymd(date), season, seasonAm, week, sundayCycle, weekdayCycle, dayName, celebration, color };
}

// ---------- Ge'ez rite (Ethiopian calendar) ----------
const ETH_MONTHS = ['መስከረም', 'ጥቅምት', 'ኅዳር', 'ታኅሣሥ', 'ጥር', 'የካቲት', 'መጋቢት', 'ሚያዝያ', 'ግንቦት', 'ሰኔ', 'ሐምሌ', 'ነሐሴ', 'ጳጉሜን'];
const ETH_WEEKDAYS = ['እሑድ', 'ሰኞ', 'ማክሰኞ', 'ረቡዕ', 'ሐሙስ', 'ዓርብ', 'ቅዳሜ'];

function gregToJdn(y: number, m: number, d: number): number {
  const a = Math.floor((14 - m) / 12), yy = y + 4800 - a, mm = m + 12 * a - 3;
  return d + Math.floor((153 * mm + 2) / 5) + 365 * yy + Math.floor(yy / 4) - Math.floor(yy / 100) + Math.floor(yy / 400) - 32045;
}

export interface EthDate { year: number; month: number; day: number; monthName: string; weekday: string }

export function toEthiopian(date: Date): EthDate {
  const jdn = gregToJdn(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
  const r = (jdn - 1723856) % 1461;
  const n = (r % 365) + 365 * Math.floor(r / 1460);
  const year = 4 * Math.floor((jdn - 1723856) / 1461) + Math.floor(r / 365) - Math.floor(r / 1460);
  const month = Math.floor(n / 30) + 1;
  const day = (n % 30) + 1;
  return { year, month, day, monthName: ETH_MONTHS[month - 1], weekday: ETH_WEEKDAYS[date.getUTCDay()] };
}

/** Julian computus (Meeus), returned as a Gregorian-calendar Date (valid 1900–2099: +13 days). */
export function geezFasika(gregorianYear: number): Date {
  const y = gregorianYear;
  const a = y % 4, b = y % 7, c = y % 19;
  const d = (19 * c + 15) % 30;
  const e = (2 * a + 4 * b - d + 34) % 7;
  const month = Math.floor((d + e + 114) / 31);
  const day = ((d + e + 114) % 31) + 1;
  return addDays(utc(y, month, day), 13); // Julian → Gregorian (1900–2099)
}

interface EthFeast { name: string; note?: string }

// fixed feasts by (eth month, eth day)
const ETH_FIXED: Record<string, EthFeast> = {
  '1-1': { name: 'እንቁጣጣሽ (ዘመን መለወጫ)' },
  '1-17': { name: 'በዓለ መስቀል' },
  '3-6': { name: 'ቁስቋም ማርያም' },
  '4-29': { name: 'በዓለ ልደት (ገና)' },
  '5-11': { name: 'በዓለ ጥምቀት' },
  '5-12': { name: 'ቃና ዘገሊላ' },
  '7-29': { name: 'በዓለ ስቅለት መታሰቢያ' },
  '12-16': { name: 'ፍልሰታ ለማርያም (ዕርገተ ማርያም)' },
};

// monthly commemorations (day of every Ethiopian month)
const ETH_MONTHLY: Record<number, string> = {
  5: 'አቡነ ገብረ መንፈስ ቅዱስ / ጴጥሮስ ወጳውሎስ',
  12: 'ቅዱስ ሚካኤል',
  19: 'ቅዱስ ገብርኤል',
  21: 'እመቤታችን ቅድስት ማርያም',
  23: 'ቅዱስ ጊዮርጊስ',
  27: 'መድኃኔ ዓለም',
  29: 'በዓለ ወልድ (አምላክ)',
};

export interface GeezDay {
  date: string;
  eth: EthDate;
  ethDateAm: string;            // ሰኔ 26 ቀን 2018 ዓ.ም.
  feasts: string[];
  fasting: string | null;
  movableContext: string | null; // e.g. ትንሣኤ በ40 ቀን ውስጥ
}

export function geezDay(date: Date): GeezDay {
  const eth = toEthiopian(date);
  const y = date.getUTCFullYear();
  // Fasika of the CURRENT Gregorian year window
  let fasika = geezFasika(y);
  if (date > addDays(fasika, 60) && date.getUTCMonth() > 7) fasika = geezFasika(y + 1);

  const feasts: string[] = [];
  const fixed = ETH_FIXED[`${eth.month}-${eth.day}`];
  if (fixed) feasts.push(fixed.name);

  // movable days (relative to Fasika)
  const movables: Array<[number, string]> = [
    [-69, 'ጾመ ነነዌ (መጀመሪያ)'],
    [-55, 'ዓቢይ ጾም (መጀመሪያ)'],
    [-28, 'ደብረ ዘይት'],
    [-7, 'ሆሣዕና'],
    [-2, 'ስቅለት'],
    [0, 'ትንሣኤ (ፋሲካ)'],
    [24, 'ርክበ ካህናት'],
    [39, 'ዕርገት'],
    [49, 'ጰራቅሊጦስ'],
    [50, 'ጾመ ሐዋርያት (መጀመሪያ)'],
  ];
  for (const [off, name] of movables)
    if (sameDay(date, addDays(fasika, off))) feasts.push(name);

  if (feasts.length === 0 && ETH_MONTHLY[eth.day]) feasts.push(`ወርኃዊ መታሰቢያ፦ ${ETH_MONTHLY[eth.day]}`);

  // fasting seasons
  let fasting: string | null = null;
  const off = Math.round((date.getTime() - fasika.getTime()) / DAY);
  if (off >= -69 && off <= -67) fasting = 'ጾመ ነነዌ';
  else if (off >= -55 && off < 0) fasting = 'ዓቢይ ጾም';
  else if (off >= 50 && (eth.month < 11 || (eth.month === 11 && eth.day <= 5))) fasting = 'ጾመ ሐዋርያት';
  else if (eth.month === 12 && eth.day <= 15) fasting = 'ጾመ ፍልሰታ';
  else if ((eth.month === 3 && eth.day >= 15) || eth.month === 4 && eth.day <= 28) fasting = 'ጾመ ነቢያት';
  else if (date.getUTCDay() === 3 || date.getUTCDay() === 5) {
    // ordinary Wednesday/Friday fast (outside the 50 days of Eastertide)
    if (!(off > 0 && off < 50)) fasting = date.getUTCDay() === 3 ? 'ጾመ ረቡዕ' : 'ጾመ ዓርብ';
  }

  const movableContext = off === 0 ? null
    : off > 0 && off <= 49 ? `ከትንሣኤ በኋላ ${off} ቀን`
    : off < 0 && off >= -55 ? `እስከ ትንሣኤ ${-off} ቀን` : null;

  return {
    date: ymd(date),
    eth,
    ethDateAm: `${eth.weekday}፣ ${eth.monthName} ${eth.day} ቀን ${eth.year} ዓ.ም.`,
    feasts,
    fasting,
    movableContext,
  };
}
