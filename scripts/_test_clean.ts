const GEEZ: Record<string, number> = {'፩':1,'፪':2,'፫':3,'፬':4,'፭':5,'፮':6,'፯':7,'፰':8,'፱':9,'፲':10,'፳':20,'፴':30,'፵':40,'፶':50,'፷':60,'፸':70,'፹':80,'፺':90,'፻':100,'፼':10000};
const LEAD = /^\s*([\u1369-\u137C]+|\d+)\s*/;
function strip(text: string, vn: number) {
  const m = text.match(LEAD); if (!m) return text;
  const tok = m[1];
  const v = /^\d+$/.test(tok) ? +tok : [...tok].reduce((s,c)=>s+(GEEZ[c]??0),0);
  return v === vn ? text.slice(m[0].length) : text;
}
console.log(strip("፩የክርስቶስ ኢየሱስ ባሪያ", 1));
console.log(strip("1አዳምም ሚስቱን", 1));
console.log(strip("1ቆሮ. 13:13 ፍቅር", 5)); // legit, must keep
console.log(strip("፪ይሁም ወንጌል", 2));
