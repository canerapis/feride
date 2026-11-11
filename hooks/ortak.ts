import type { Durum, Etkinlik, IsTuru, LimitOkuma, Sablon, Seviye } from '../types'

// ---------------------------------------------------------------------------
// Seviyeler, modeller, şablonlar
// ---------------------------------------------------------------------------

export const MODEL: Record<Seviye, string> = { ustat: 'fable', usta: 'opus', kalfa: 'sonnet', cirak: 'haiku' }
export const SEVIYE_ADI: Record<Seviye, string> = { ustat: 'üstat', usta: 'usta', kalfa: 'kalfa', cirak: 'çırak' }
export const BIR_ALT: Record<Seviye, Seviye> = { ustat: 'usta', usta: 'kalfa', kalfa: 'cirak', cirak: 'cirak' }
export const SIRA: Record<Seviye, number> = { ustat: 3, usta: 2, kalfa: 1, cirak: 0 }

export const DURUM_ADI: Record<Durum, string> = {
  bekliyor: 'sırasını bekliyor',
  calisiyor: 'çalışıyor',
  bitti: 'bitirdi',
  hata: 'takıldı',
}

/** Patron Feride (ana oturum) hep en üst modelde çalışır; limit dolmak üzereyken bir alttakine iner. */
export const PATRON_MODELI = 'fable'
export const PATRON_YEDEK_MODELI = 'opus'
/** Bir pencerenin dolu yüzdesi buna varınca Feride yedek modele iner. */
export const PATRON_ESIGI = 99

// Bir üyenin tahmini harcaması, 5 saatlik pencerenin yüzdesi olarak. Gerçek
// harcama her iş bitiminde ölçülür ve `katsayi` ile düzeltilir ($.store).
const MALIYET: Record<Seviye, number> = { ustat: 5, usta: 3, kalfa: 1, cirak: 0.3 }
// Haftalık pencerenin yüzde biri, 5 saatlik pencerenin kabaca kaç yüzdesi eder.
const HAFTA_ORANI = 10

export type SablonAyari = {
  ad: string
  /** Bu şablonda verilebilecek en yüksek seviye. */
  tavan: Seviye
  /** Dar boğazda kalan yüzde bunun altındaysa herkes çırak olur. */
  herkesCirak: number
  /** ...bunun altındaysa tavan kalfaya iner. */
  tavanKalfa: number
  /** ...bunun altındaysa yalnızca bir üye usta ya da üstü kalır. */
  tekUst: number
  /** 5 saatlik pencerede kalanın ekibe ayrılan oranı. */
  pay: number
  /** Diğer pencerelerde kalanın ekibe ayrılan oranı. */
  haftaPay: number
  ozet: string
}

export const SABLON: Record<Sablon, SablonAyari> = {
  hafif: {
    ad: 'hafif',
    tavan: 'kalfa',
    herkesCirak: 25,
    tavanKalfa: 0,
    tekUst: 0,
    pay: 0.3,
    haftaPay: 0.15,
    ozet: 'limiti korur: en fazla kalfa (sonnet), çoğu iş çırakta (haiku)',
  },
  orta: {
    ad: 'orta',
    tavan: 'usta',
    herkesCirak: 15,
    tavanKalfa: 30,
    tekUst: 60,
    pay: 0.5,
    haftaPay: 0.25,
    ozet: 'dengeli: gerektiğinde usta (opus), limit daraldıkça kademe iner',
  },
  guclu: {
    ad: 'güçlü',
    tavan: 'ustat',
    herkesCirak: 5,
    tavanKalfa: 10,
    tekUst: 25,
    pay: 0.9,
    haftaPay: 0.5,
    ozet: 'limiti riske atar: zor işe üstat (fable) verilebilir, seviyeler ancak limit bitmek üzereyken iner',
  },
}

export const SABLON_SIRASI: readonly Sablon[] = ['hafif', 'orta', 'guclu']

export function sablonOku(deger: unknown): Sablon | undefined {
  const s = typeof deger === 'string' ? deger.toLowerCase().replace(/ü/g, 'u').replace(/ç/g, 'c').replace(/ı/g, 'i').trim() : ''

  if (s === 'hafif' || s === 'light') return 'hafif'
  if (s === 'orta' || s === 'dengeli' || s === 'medium') return 'orta'
  if (s === 'guclu' || s === 'strong' || s === 'agir') return 'guclu'

  return undefined
}

export type Taslak = {
  ad: string
  rol: string
  yetkinlikler: string[]
  istenen: Seviye
  asama: number
  gorev: string
  kritik: boolean
  isTuru: IsTuru
}

export type Secim = { seviye: Seviye; gerekce: string }

export type Atama = { secimler: Secim[]; not: string; tahmin: number; tabanTahmin: number }

export const sayi = (n: number): string => String(Math.round(n * 10) / 10).replace('.', ',')

export const sinirla = (n: number, alt: number, ust: number): number => Math.min(ust, Math.max(alt, n))

export function limitAdi(tur: string): string {
  if (tur === 'five_hour') return '5 saat'
  if (tur === 'seven_day') return '7 gün'
  if (tur === 'spend_limit') return 'harcama'

  return tur
}

export function limitleriOku(ham: readonly { kind: string; percentUsed: number; resetsAt?: string }[]): LimitOkuma[] {
  return ham.map(bir => ({
    tur: bir.kind,
    yuzde: sinirla(Math.round(bir.percentUsed), 0, 100),
    ...(bir.resetsAt === undefined ? {} : { sifirlanma: bir.resetsAt }),
  }))
}

/** Feride'nin kendi modeli: en üst model; bir pencere dolmak üzereyse bir alttaki. */
export function patronModeli(limitler: readonly LimitOkuma[]): { model: string; neden: string } {
  const dolu = limitler.find(l => l.yuzde >= PATRON_ESIGI)

  return dolu === undefined
    ? { model: PATRON_MODELI, neden: `en üst model; bir limit %${PATRON_ESIGI}'a varırsa ${PATRON_YEDEK_MODELI}` }
    : { model: PATRON_YEDEK_MODELI, neden: `${limitAdi(dolu.tur)} limiti %${dolu.yuzde} dolu, ${PATRON_MODELI} yerine bir alttaki` }
}

const BIRLER_EKI = ['ı', 'i', 'si', 'ü', 'ü', 'i', 'sı', 'si', 'i', 'u']
const ONLAR_EKI = ['ı', 'u', 'si', 'u', 'ı', 'si', 'ı', 'i', 'i', 'ı']

/** "%69'u", "%40'ı", "%1,6'sı": sayının okunuşundaki son kelimeye göre iyelik eki. */
export function yuzdesi(metin: string): string {
  const rakamlar = metin.replace(/\D/g, '')
  const son = Number(rakamlar.at(-1) ?? '0')
  const onlar = Number(rakamlar.at(-2) ?? '0')
  const ek =
    son !== 0 ? BIRLER_EKI[son] : /^100$/.test(metin) ? 'ü' : onlar !== 0 && !metin.includes(',') ? ONLAR_EKI[onlar] : 'ı'

  return `%${metin}'${ek ?? 'ı'}`
}

/**
 * Şablona ve kalan limite göre her üyenin seviyesini (dolayısıyla modelini) seçer.
 *
 * Önce iş türü ve şablon tavanı, sonra dar boğaza göre tavan kuralları, sonra
 * bütçe: ekibin tahmini harcaması ayrılan payı aşıyorsa kritik olmayanlardan
 * başlayarak birer kademe indirilir.
 */
export function modelSec(
  taslaklar: readonly Taslak[],
  limitler: readonly LimitOkuma[],
  simdi: number,
  katsayi: number,
  sablon: Sablon,
): Atama {
  const S = SABLON[sablon]
  const secimler: Secim[] = taslaklar.map(t => ({ seviye: t.istenen, gerekce: 'istenen seviye verildi' }))
  const taban = (): number => secimler.reduce((toplam, s) => toplam + MALIYET[s.seviye], 0)
  const indir = (i: number, hedef: Seviye, neden: string): void => {
    const secim = secimler[i]
    const taslak = taslaklar[i]

    if (secim === undefined || taslak === undefined || SIRA[secim.seviye] <= SIRA[hedef]) return
    secimler[i] = { seviye: hedef, gerekce: `${SEVIYE_ADI[taslak.istenen]} istenmişti; ${neden}` }
  }

  taslaklar.forEach((t, i) => {
    // En üst model yalnızca gerektiğinde: düz metin ya da türü belirsiz iş için verilmez.
    if (t.isTuru === 'metin') indir(i, 'usta', 'düz metin işine en üst model verilmez')
    else if (t.isTuru === 'genel') indir(i, 'usta', 'iş türü belirtilmediği için en üst model verilmedi')
    indir(i, S.tavan, `"${S.ad}" şablonunun tavanı ${SEVIYE_ADI[S.tavan]}`)
  })

  const baslik = `Şablon: ${S.ad}.`

  if (limitler.length === 0) {
    return {
      secimler,
      not: `${baslik} Limit bilgisi okunamadı (abonelik dışı oturum olabilir): seviyeler limite göre düşürülmedi.`,
      tahmin: taban() * katsayi,
      tabanTahmin: taban(),
    }
  }

  const parcalar: string[] = []
  let dar = 100
  let butce = Number.POSITIVE_INFINITY

  for (const limit of limitler) {
    let kalan = 100 - limit.yuzde
    const sifirlanma = limit.sifirlanma === undefined ? Number.NaN : Date.parse(limit.sifirlanma)
    const yakinda = limit.tur === 'five_hour' && sifirlanma - simdi > 0 && sifirlanma - simdi < 20 * 60_000

    parcalar.push(`${limitAdi(limit.tur)} penceresinin ${yuzdesi(String(kalan))} boşta${yakinda ? ' (birazdan sıfırlanıyor)' : ''}`)
    // Sıfırlanmasına az kalmış pencere dar boğaz sayılmaz: artan pay yanar.
    if (yakinda) kalan = Math.max(kalan, 70)
    dar = Math.min(dar, kalan)
    butce = Math.min(butce, limit.tur === 'five_hour' ? kalan * S.pay : kalan * S.haftaPay * HAFTA_ORANI)
  }

  let kural = 'istenen seviyeler karşılanabiliyor'

  if (dar < S.herkesCirak) {
    kural = `dar boğaz %${dar}: herkes çırak`
    secimler.forEach((_, i) => indir(i, 'cirak', `limitin yalnızca ${yuzdesi(String(dar))} kaldı, herkes çırak`))
  } else if (dar < S.tavanKalfa) {
    kural = `dar boğaz %${dar}: tavan kalfa`
    secimler.forEach((_, i) => indir(i, 'kalfa', `limitin ${yuzdesi(String(dar))} kaldı, tavan kalfa`))
  } else if (dar < S.tekUst) {
    kural = `dar boğaz %${dar}: en fazla bir usta`
    const ustler = secimler.flatMap((s, i) => (SIRA[s.seviye] >= SIRA.usta ? [i] : []))
    const kalacak = ustler.find(i => taslaklar[i]?.kritik === true) ?? ustler[0]

    for (const i of ustler) if (i !== kalacak) indir(i, 'kalfa', `limitin ${yuzdesi(String(dar))} kaldı, tek usta hakkı var`)
  }

  let kesinti = 0

  while (taban() * katsayi > butce) {
    // Önce kritik olmayan, sonra en pahalı, sonra en son aşamadaki.
    let aday = -1

    secimler.forEach((s, i) => {
      if (s.seviye === 'cirak') return
      if (aday === -1) {
        aday = i

        return
      }

      const eski = secimler[aday]
      const kritik = taslaklar[i]?.kritik === true
      const eskiKritik = taslaklar[aday]?.kritik === true

      if (eski === undefined) return
      if (kritik !== eskiKritik) {
        if (!kritik) aday = i

        return
      }

      if (SIRA[s.seviye] >= SIRA[eski.seviye]) aday = i
    })

    const secim = secimler[aday]

    if (secim === undefined) break
    indir(aday, BIR_ALT[secim.seviye], `ekibin tahmini harcaması ayrılan payı (%${sayi(butce)}) aşıyordu`)
    kesinti += 1
  }

  const tahmin = taban() * katsayi
  const pay = Number.isFinite(butce) ? ` (ayrılan pay %${sayi(butce)})` : ''

  return {
    secimler,
    not:
      `${baslik} ${parcalar.join(', ')}. Kural: ${kural}${kesinti > 0 ? `; bütçe için ${kesinti} kademe indirildi` : ''}. ` +
      `Tahmini harcama: 5 saatlik pencerenin ≈${yuzdesi(sayi(tahmin))}${pay}.`,
    tahmin,
    tabanTahmin: taban(),
  }
}

// ---------------------------------------------------------------------------
// Etkinlik: üyenin son araç çağrısından ne yaptığı
// ---------------------------------------------------------------------------

export function etkinlikBul(arac: string): Etkinlik {
  const a = arac.toLowerCase()

  if (/^(read|notebookread)$/.test(a)) return 'oku'
  if (/^(grep|glob|ls|toolsearch)$/.test(a)) return 'ara'
  if (/^(edit|write|multiedit|notebookedit)$/.test(a)) return 'yaz'
  if (/^(bash|powershell|bashoutput|killshell)$/.test(a)) return 'komut'
  if (/web|browser|fetch|search|http|navigate/.test(a)) return 'web'

  return 'dusun'
}

/** Araç çağrısı gelmeden önce üyenin işinin türüne göre varsayılan canlandırma. */
export const TUR_ETKINLIGI: Record<IsTuru, Etkinlik> = {
  metin: 'yaz',
  kod: 'yaz',
  arastirma: 'ara',
  inceleme: 'oku',
  genel: 'dusun',
}

// ---------------------------------------------------------------------------
// Metin yardımcıları
// ---------------------------------------------------------------------------

export const temiz = (metin: string): string =>
  metin
    .replace(/[\u0000-\u001f\u007f]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

export const kisalt = (metin: string, en: number): string =>
  metin.length <= en ? metin : `${metin.slice(0, Math.max(0, en - 1)).trimEnd()}…`

export const kacis = (metin: string): string =>
  metin.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export function karma(metin: string): number {
  let h = 2166136261

  for (let i = 0; i < metin.length; i += 1) {
    h ^= metin.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }

  return h >>> 0
}

export const sec = <T>(liste: readonly T[], h: number): T | undefined => liste[h % Math.max(1, liste.length)]

export function sar(metin: string, en: number, enCok: number): string[] {
  const satirlar: string[] = []
  let satir = ''

  for (const kelime of temiz(metin).split(' ')) {
    let k = kelime

    while (k.length > en) {
      if (satir !== '') satirlar.push(satir)
      satir = ''
      satirlar.push(k.slice(0, en))
      k = k.slice(en)
    }

    if (k === '') continue
    if (satir === '') satir = k
    else if (satir.length + 1 + k.length <= en) satir = `${satir} ${k}`
    else {
      satirlar.push(satir)
      satir = k
    }
  }

  if (satir !== '') satirlar.push(satir)
  if (satirlar.length <= enCok) return satirlar

  const kesik = satirlar.slice(0, enCok)

  kesik[enCok - 1] = `${kisalt(kesik[enCok - 1] ?? '', en - 1)}…`

  return kesik
}

export function sureMetni(ms: number): string {
  const sn = Math.max(0, Math.round(ms / 1000))

  return sn < 60 ? `${sn} sn` : `${Math.floor(sn / 60)} dk ${sn % 60} sn`
}
