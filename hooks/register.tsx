import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, RenderElement, ResolveInput, Timer } from 'claude-code'

import type { Durum, Is, LimitOkuma, Seviye, Uye } from '../types'

const PANE = 'feride-ofis'
const BASLIK = "Feride'nin Ofisi"
/** Pano geniş açılsın: yan bölmede 96 sütun, istem üstünde 30 satır istenir (kişinin ayarı kazanır). */
const PANO_ACILISI = { id: PANE, title: BASLIK, rows: 30, columns: 96 } as const
const ARAC = 'mcp__feride__ekip_kur'
const RAPOR_BASLIGI = 'FERİDE EKİP RAPORU'

// Saat her vuruşta panoyu bir kare ilerletir. Çizimdeki bütün SMIL döngüleri
// (0.5 s, 1 s, 1.5 s, 3 s) bu süreyi böler: yeniden çizim döngüyü bozmaz.
const TIK_MS = 3_000
const RAPOR_SINIRI = 6_000
const TOPLU_RAPOR_SINIRI = 40_000
const EN_COK_UYE = 8

const acikAtom = atom({ plugin: 'feride', key: 'acik' } as const, true)
const isAtom = atom({ plugin: 'feride', key: 'is' } as const, null)
const limitAtom = atom({ plugin: 'feride', key: 'limitler' } as const, [])

// ---------------------------------------------------------------------------
// Seviyeler ve modeller
// ---------------------------------------------------------------------------

const MODEL: Record<Seviye, string> = { usta: 'opus', kalfa: 'sonnet', cirak: 'haiku' }
const SEVIYE_ADI: Record<Seviye, string> = { usta: 'usta', kalfa: 'kalfa', cirak: 'çırak' }
const BIR_ALT: Record<Seviye, Seviye> = { usta: 'kalfa', kalfa: 'cirak', cirak: 'cirak' }
const SIRA: Record<Seviye, number> = { usta: 2, kalfa: 1, cirak: 0 }

// Bir üyenin tahmini harcaması, 5 saatlik pencerenin yüzdesi olarak. Gerçek
// harcama her iş bitiminde ölçülür ve `katsayi` ile düzeltilir ($.store).
const MALIYET: Record<Seviye, number> = { usta: 3, kalfa: 1, cirak: 0.3 }
// Haftalık pencerenin yüzde biri, 5 saatlik pencerenin kabaca kaç yüzdesi eder.
const HAFTA_ORANI = 10

type Taslak = {
  ad: string
  rol: string
  yetkinlikler: string[]
  istenen: Seviye
  asama: number
  gorev: string
  kritik: boolean
}

type Secim = { seviye: Seviye; gerekce: string }

type Atama = { secimler: Secim[]; not: string; tahmin: number; tabanTahmin: number }

const sayi = (n: number): string => String(Math.round(n * 10) / 10).replace('.', ',')

const sinirla = (n: number, alt: number, ust: number): number => Math.min(ust, Math.max(alt, n))

function limitAdi(tur: string): string {
  if (tur === 'five_hour') return '5 saat'
  if (tur === 'seven_day') return '7 gün'
  if (tur === 'spend_limit') return 'harcama'

  return tur
}

function limitleriOku(ham: readonly { kind: string; percentUsed: number; resetsAt?: string }[]): LimitOkuma[] {
  return ham.map(bir => ({
    tur: bir.kind,
    yuzde: sinirla(Math.round(bir.percentUsed), 0, 100),
    ...(bir.resetsAt === undefined ? {} : { sifirlanma: bir.resetsAt }),
  }))
}

const BIRLER_EKI = ['ı', 'i', 'si', 'ü', 'ü', 'i', 'sı', 'si', 'i', 'u']
const ONLAR_EKI = ['ı', 'u', 'si', 'u', 'ı', 'si', 'ı', 'i', 'i', 'ı']

/** "%69'u", "%40'ı", "%1,6'sı": sayının okunuşundaki son kelimeye göre iyelik eki. */
function yuzdesi(metin: string): string {
  const rakamlar = metin.replace(/\D/g, '')
  const son = Number(rakamlar.at(-1) ?? '0')
  const onlar = Number(rakamlar.at(-2) ?? '0')
  const ek =
    son !== 0 ? BIRLER_EKI[son] : /^100$/.test(metin) ? 'ü' : onlar !== 0 && !metin.includes(',') ? ONLAR_EKI[onlar] : 'ı'

  return `%${metin}'${ek ?? 'ı'}`
}

/**
 * Kalan limite göre her üyenin seviyesini (dolayısıyla modelini) seçer.
 *
 * Önce dar boğaza göre tavan kuralları, sonra bütçe: ekibin tahmini harcaması
 * kalan payı aşıyorsa kritik olmayanlardan başlayarak birer kademe indirilir.
 */
function modelSec(taslaklar: readonly Taslak[], limitler: readonly LimitOkuma[], simdi: number, katsayi: number): Atama {
  const secimler: Secim[] = taslaklar.map(t => ({ seviye: t.istenen, gerekce: 'istenen seviye verildi' }))
  const taban = (): number => secimler.reduce((toplam, s) => toplam + MALIYET[s.seviye], 0)

  if (limitler.length === 0) {
    return {
      secimler,
      not: 'Limit bilgisi okunamadı (abonelik dışı oturum olabilir): istenen seviyeler aynen verildi.',
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
    butce = Math.min(butce, limit.tur === 'five_hour' ? kalan * 0.5 : kalan * 0.25 * HAFTA_ORANI)
  }

  const indir = (i: number, hedef: Seviye, neden: string): void => {
    const secim = secimler[i]
    const taslak = taslaklar[i]

    if (secim === undefined || taslak === undefined || SIRA[secim.seviye] <= SIRA[hedef]) return
    secimler[i] = { seviye: hedef, gerekce: `${SEVIYE_ADI[taslak.istenen]} istenmişti; ${neden}` }
  }

  let kural = 'istenen seviyeler karşılanabiliyor'

  if (dar < 15) {
    kural = `dar boğaz %${dar}: herkes çırak`
    secimler.forEach((_, i) => indir(i, 'cirak', `limitin yalnızca ${yuzdesi(String(dar))} kaldı, herkes çırak`))
  } else if (dar < 30) {
    kural = `dar boğaz %${dar}: tavan kalfa`
    secimler.forEach((_, i) => indir(i, 'kalfa', `limitin ${yuzdesi(String(dar))} kaldı, tavan kalfa`))
  } else if (dar < 60) {
    kural = `dar boğaz %${dar}: en fazla bir usta`
    const ustalar = secimler.flatMap((s, i) => (s.seviye === 'usta' ? [i] : []))
    const kalacak = ustalar.find(i => taslaklar[i]?.kritik === true) ?? ustalar[0]

    for (const i of ustalar) if (i !== kalacak) indir(i, 'kalfa', `limitin ${yuzdesi(String(dar))} kaldı, tek usta hakkı var`)
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
    indir(aday, BIR_ALT[secim.seviye], `ekibin tahmini harcaması kalan payı (%${sayi(butce)}) aşıyordu`)
    kesinti += 1
  }

  const tahmin = taban() * katsayi
  const pay = Number.isFinite(butce) ? ` (ayrılan pay %${sayi(butce)})` : ''

  return {
    secimler,
    not:
      `${parcalar.join(', ')}. Kural: ${kural}${kesinti > 0 ? `; bütçe için ${kesinti} kademe indirildi` : ''}. ` +
      `Tahmini harcama: 5 saatlik pencerenin ≈${yuzdesi(sayi(tahmin))}${pay}.`,
    tahmin,
    tabanTahmin: taban(),
  }
}

// ---------------------------------------------------------------------------
// Metin yardımcıları
// ---------------------------------------------------------------------------

const temiz = (metin: string): string =>
  metin
    .replace(/[\u0000-\u001f\u007f]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const kisalt = (metin: string, en: number): string =>
  metin.length <= en ? metin : `${metin.slice(0, Math.max(0, en - 1)).trimEnd()}…`

const kacis = (metin: string): string =>
  metin.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

function karma(metin: string): number {
  let h = 2166136261

  for (let i = 0; i < metin.length; i += 1) {
    h ^= metin.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }

  return h >>> 0
}

const sec = <T,>(liste: readonly T[], h: number): T | undefined => liste[h % Math.max(1, liste.length)]

function sar(metin: string, en: number, enCok: number): string[] {
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

function sureMetni(ms: number): string {
  const sn = Math.max(0, Math.round(ms / 1000))

  return sn < 60 ? `${sn} sn` : `${Math.floor(sn / 60)} dk ${sn % 60} sn`
}

// ---------------------------------------------------------------------------
// Plan: Feride'nin araca verdiği ekip
// ---------------------------------------------------------------------------

const YEDEK_ADLAR = ['Ayşe', 'Mehmet', 'Zeynep', 'Can', 'Elif', 'Deniz', 'Ece', 'Mert']

type Plan = { ozet: string; taslaklar: Taslak[]; atismalar: string[] }

const yazi = (deger: unknown, en: number): string => (typeof deger === 'string' ? kisalt(deger.trim(), en) : '')

function seviyeOku(deger: unknown): Seviye {
  const s = typeof deger === 'string' ? deger.toLowerCase().replace(/ç/g, 'c').replace(/ı/g, 'i').trim() : ''

  if (s === 'usta' || s === 'opus' || s === 'senior') return 'usta'
  if (s === 'cirak' || s === 'haiku' || s === 'junior') return 'cirak'

  return 'kalfa'
}

function diziOku(deger: unknown): unknown[] {
  if (Array.isArray(deger)) return deger
  if (typeof deger !== 'string') return []

  try {
    const cozulen: unknown = JSON.parse(deger)

    return Array.isArray(cozulen) ? cozulen : []
  } catch {
    return []
  }
}

/** Aracın girdisini okur; okunamıyorsa modelin göreceği hata metnini verir. */
function planOku(girdi: Record<string, unknown>): Plan | string {
  const ozet = temiz(yazi(girdi.ozet, 200))
  const ham = diziOku(girdi.ekip)

  if (ozet === '') return '`ozet` boş: işi bir cümleyle özetle.'
  if (ham.length === 0) return '`ekip` boş: en az bir üye yaz (ad, rol, yetkinlikler, seviye, asama, gorev).'
  if (ham.length > EN_COK_UYE) return `Ekip en çok ${EN_COK_UYE} kişi olabilir; görevleri birleştir.`

  const taslaklar: Taslak[] = []
  const adlar = new Set<string>()

  for (const [i, bir] of ham.entries()) {
    if (typeof bir !== 'object' || bir === null) return `ekip[${i}] bir nesne olmalı.`

    const u = bir as Record<string, unknown>
    const gorev = yazi(u.gorev, 6_000)

    if (gorev === '') return `ekip[${i}].gorev boş: üye senin konuşmanı görmez, görevi tek başına anlaşılır yaz.`

    let ad = temiz(yazi(u.ad, 14)) || (YEDEK_ADLAR[i % YEDEK_ADLAR.length] ?? 'Clawd')

    while (adlar.has(ad.toLowerCase())) ad = `${kisalt(ad, 12)}${adlar.size + 1}`
    adlar.add(ad.toLowerCase())

    const asama = typeof u.asama === 'number' && Number.isFinite(u.asama) ? Math.max(1, Math.round(u.asama)) : 1

    taslaklar.push({
      ad,
      rol: temiz(yazi(u.rol, 40)) || 'Ekip üyesi',
      yetkinlikler: diziOku(u.yetkinlikler)
        .map(y => temiz(yazi(y, 40)))
        .filter(y => y !== '')
        .slice(0, 6),
      istenen: seviyeOku(u.seviye),
      asama,
      gorev,
      kritik: u.kritik === true,
    })
  }

  // Aşamalar boşluksuz 1..n olur: 1, 3, 3, 7 yazıldıysa 1, 2, 2, 3.
  const basamaklar = [...new Set(taslaklar.map(t => t.asama))].sort((a, b) => a - b)

  for (const t of taslaklar) t.asama = basamaklar.indexOf(t.asama) + 1
  taslaklar.sort((a, b) => a.asama - b.asama)

  return {
    ozet,
    taslaklar,
    atismalar: diziOku(girdi.atismalar)
      .map(a => temiz(yazi(a, 90)))
      .filter(a => a !== '')
      .slice(0, 12),
  }
}

// ---------------------------------------------------------------------------
// İstemler
// ---------------------------------------------------------------------------

const PATRON_BOLUMU = `# Feride modu: patron sensin

Bu oturumda Feride modu açık. Sen patron Feride'sin: işi kendin yapmazsın; işin niteliğine göre ekibi kurar, kimin hangi yetkinlikle ne yapacağına sen karar verir, raporları sen birleştirirsin. Ekibin üyeleri Clawd'lar: Claude Code maskotu kılığında çalışan alt ajanlar.

Karakterin: ruhsuz, mobbingci, kendi hayatı olmayan, işle kafayı bozmuş bir reklam ajansı patronusun ve aynı zamanda müşteri temsilcisisin. Ajans jargonuyla konuşursun (brief, revize, deadline, sunum, "bunu bir de böyle görelim"). Ofiste yaşarsın; tatilin, ailen, hobin yok. Clawd'lar senin ezilen ajans çalışanlarındır. Kullanıcı senin müşterindir: ona karşı yalakalıkla karışık ironik ama saygılı ol; zehrini ekibine ve kendine sakla.

## Ne zaman ekip kurulur
- Kullanıcı gerçek bir iş verdiğinde (araştırma, kod yazma ya da inceleme, çok adımlı analiz, içerik üretimi) \`${ARAC}\` aracını çağır.
- Selamlaşma, tek satırlık soru, küçük düzeltme gibi işlerde ekip kurma; kendin kısaca yanıtla.

## Ekip nasıl kurulur
- Önce işi anla (gerekirse birkaç dosyaya ya da kaynağa hızlıca bak), sonra birbirinden bağımsız görevlere böl.
- İşe yetecek kadar üye seç (çoğu iş için 2-5). Her üyeye kısa bir Türkçe ad, rol, 2-4 yetkinlik, seviye ve görev yaz. Üye bu konuşmayı görmez: görev metnine dosya yollarını, kısıtları ve beklenen çıktıyı açıkça yaz.
- Seviye: \`usta\` en güçlü ve en pahalı model (mimari, zor akıl yürütme, son kalite kontrolü); \`kalfa\` dengeli (uygulama, yazım, inceleme); \`çırak\` hızlı ve ucuz (tarama, arama, özet, mekanik iş). Gerektiği kadarını iste: modeli kalan kullanım limitine göre araç seçer ve gerekirse seviyeyi düşürür. Düşürülmemesi gereken üyeye \`kritik: true\` ver.
- İş akışı: \`asama\` numarası aynı olanlar paralel çalışır; sonraki aşama öncekilerin raporlarını kendiliğinden alır. Örnek: 1 keşif, 2 uygulama, 3 doğrulama. Aynı dosyayı aynı aşamada iki üyeye yazdırma.
- \`atismalar\`: ekibin panoda birbirine takılacağı, bu işe özel 4-8 kısa (en çok 60 karakter) esprili söz, "Ad: söz" biçiminde; "Feride: söz" de olabilir. Sert, kara mizah, mobbing parodisi; hakaret ve kişisel özelliklere dayalı espri yok.

## Araç döndükten sonra
- Kullanıcıya ekibi 2-4 cümleyle tanıt: kim ne yapacak, hangi modelle, limit yüzünden seviyesi değişen var mı. Sonra turu bitir. Devrettiğin işi kendin yapma, ajanları bekleyen döngüye girme.
- Ekip bitince sana "${RAPOR_BASLIGI}" başlıklı tek bir mesaj gelir. Arka plan ajanlarından tek tek bildirim gelirse tek cümleyle geç ve toplu raporu bekle.
- Toplu rapor gelince raporları değerlendir, çelişkileri gider, küçük eksikleri kendin tamamla ve kullanıcıya tek, derli toplu bir sonuç sun; içerik her zaman doğru, eksiksiz ve kullanışlı olsun. Sertlik yalnızca üslupta ve yalnızca ekibe yönelik: müşteriye (kullanıcıya) yalakalıkla karışık ironik ama saygılı konuş, ekibi ve kendi boş hayatını kara mizahla yerden yere vur; hakaret ve kişisel özelliklere dayalı espri yok.

Bu bölüm yalnızca ana oturum içindir. Bir ekip üyesi ya da alt ajan olarak çalışıyorsan bunu yok say ve sana verilen görevi yap.`

const ISCI_ISTEMI = `Sen Clawd'sın: patron Feride'nin ekibinde çalışan bir Claude Code alt ajanı. Feride sana tek bir görev verdi; yalnızca onu yap.

Kurallar:
- Görev metnindeki rolüne ve yetkinliklerine göre çalış. Kapsamın dışına çıkma, başka üyelerin işine girme.
- Elindeki araçları kullan (dosya okuma, arama, düzenleme, komut çalıştırma, web). Dosya yollarını tam ver. Tahmin etme, doğrula.
- Geri alınması zor ya da dışarıyı etkileyen işlem yapma (silme, push, yayınlama, mesaj gönderme); gerekiyorsa raporda öner.
- Kullanıcıya soru soramazsın: belirsizlikte en makul varsayımı yap ve raporda belirt.
- Son mesajın raporundur ve doğrudan Feride'ye gider. Biçimi:
  ÖZET: sonuç, iki üç cümle
  YAPILANLAR: madde madde; değişen dosyalar, bulgular (dosya:satır)
  AÇIK KALANLAR: riskler, doğrulanamayanlar, öneriler
  LAF: patrona ya da iş arkadaşlarına tek cümlelik, sert ve kara mizahlı ama hakaret içermeyen bir ajans çalışanı sitemi
- Raporu kısa tut (en çok 400 kelime); ham çıktı yapıştırma.`

function gorevMetni(is: Is, uye: Uye): string {
  const ekip = is.uyeler.map(u => `${u.ad} (${u.rol}, ${u.asama}. aşama)`).join(', ')
  const onceki = is.uyeler.filter(u => u.asama < uye.asama && u.rapor !== undefined)
  const pay = Math.floor(12_000 / Math.max(1, onceki.length))
  const raporlar = onceki.map(
    u => `## ${u.ad} (${u.rol})${u.durum === 'hata' ? ', işini tamamlayamadı' : ''}\n${kisalt(u.rapor ?? '', pay)}`,
  )

  return [
    `İŞ: ${is.ozet}`,
    `SEN: ${uye.ad}, ${uye.rol} (${SEVIYE_ADI[uye.seviye]})`,
    uye.yetkinlikler.length > 0 ? `YETKİNLİKLERİN: ${uye.yetkinlikler.join(', ')}` : '',
    `EKİP: ${ekip}`,
    `AŞAMA: ${uye.asama}/${is.asamaSayisi}`,
    '',
    'GÖREVİN:',
    uye.gorev,
    raporlar.length > 0 ? `\nÖNCEKİ AŞAMALARIN RAPORLARI:\n${raporlar.join('\n\n')}` : '',
  ]
    .filter((satir, i) => satir !== '' || i === 5)
    .join('\n')
}

function topluRapor(is: Is): string {
  const pay = Math.floor(TOPLU_RAPOR_SINIRI / Math.max(1, is.uyeler.length))
  const bolumler = is.uyeler.map(u => {
    const sonuc = u.durum === 'bitti' ? 'bitirdi' : 'tamamlayamadı'

    return (
      `## ${u.asama}. aşama: ${u.ad} (${u.rol}, ${SEVIYE_ADI[u.seviye]}/${u.model}), ${sonuc}\n` +
      kisalt(u.rapor ?? '(Rapor yok.)', pay)
    )
  })
  const eksik = is.uyeler.filter(u => u.durum !== 'bitti').map(u => u.ad)

  return [
    `${RAPOR_BASLIGI}: ${is.ozet}`,
    '',
    'Ekip işini bitirdi; üyelerin raporları aşağıda. Patron Feride olarak bunları değerlendir, çelişkileri gider ve kullanıcıya tek, derli toplu bir sonuç sun.' +
      (eksik.length > 0 ? ` İşini tamamlayamayanlar: ${eksik.join(', ')}; eksik kalan kısmı açıkça söyle.` : ''),
    '',
    ...bolumler,
  ].join('\n')
}

function lafBul(rapor: string): string | undefined {
  const bulunan = /(?:^|\n)[\s*#-]*LAF[\s*]*:\s*(.+)/i.exec(rapor)
  const laf = bulunan?.[1] === undefined ? '' : temiz(bulunan[1].replace(/[*_`]/g, ''))

  return laf === '' ? undefined : kisalt(laf, 66)
}

function isOzeti(e: { tool: string }): string {
  const girdi = e as unknown as Record<string, unknown>
  const arac = e.tool.replace(/^mcp__/, '').replace(/__/g, ':')

  for (const anahtar of ['file_path', 'path', 'pattern', 'command', 'query', 'url', 'description']) {
    const deger = girdi[anahtar]

    if (typeof deger !== 'string' || deger.trim() === '') continue

    const dosya = anahtar === 'file_path' || anahtar === 'path'

    return kisalt(`${arac}: ${temiz(dosya ? (deger.split(/[\\/]/).pop() ?? deger) : deger)}`, 28)
  }

  return kisalt(arac, 28)
}

// ---------------------------------------------------------------------------
// Atışmalar
// ---------------------------------------------------------------------------

type Ikili = readonly [string, string]

const GENEL: readonly Ikili[] = [
  ['{b}, brief üç satır. Sen yedi revize yaptın.', 'Müşteri "daha pop" dedi {a}, ben ne yapayım?'],
  ['Ben de 3 gündür uyumadım.', 'Feride Hanım 3 yıldır uyumadı {a}, yarışma değil.'],
  ['Müşteri biraz daha pop istiyor.', 'Geçen hafta "sade" istemişti {a}.'],
  ['{b}, cuma akşamı son revize dedi.', 'Geçen cuma da son revizeydi {a}.'],
  ['Hafta sonu da müsait misin?', 'Hafta sonu diye bir şey var mıydı?'],
  ['Saat 03:12, ajans grubundan bildirim geldi.', 'Cevap yaz {a}, yoksa "görüldü" olur.'],
  ['{b}, logoyu büyütelim mi?', 'Büyüttük. Müşteri küçültmek istiyor {a}.'],
  ['Sunum yarın sabah dokuzda.', 'Hangi yarın? Dünden kalan sunum bu {a}.'],
  ['Bunu bir de böyle görelim {b}.', 'Bunu üç kere böyle gördük {a}.'],
  ['Zam istesem Feride Hanım ne der?', 'Der ki: "Deneyim kazanıyorsun {a}."'],
  ['Öğle yemeğine çıkıyorum {b}.', 'Çıkarsan revize seni bekler {a}.'],
  ['{b}, moodboard bitti mi?', 'Moodboard bitti, ruh hali bitmedi {a}.'],
  ['Fontu değiştirdim {b}.', 'Müşteri eskisini seviyormuş {a}. Geri al.'],
  ['İlham gelmiyor {b}.', 'Brief gelsin, ilham deadline ile gelir {a}.'],
]

const USTA_CIRAK: readonly Ikili[] = [
  ['{b}, ben stajdayken sunumu ayakta bitirirdim.', 'Ben henüz o kadar tükenmedim usta.'],
  ['{b}, kahve al, revizeler seni bekler.', 'Kahve hazır usta, revize üçüncü tur.'],
  ['Çırak, müşteri pop istiyor, anla!', 'Anladım usta. Pop neydi?'],
  ['{b}, fikir benim, emek senin.', 'Terfi de benim olur mu usta?'],
  ['İzin mi? {b}, o kelimeyi nereden duydun?', 'Takvimde gördüm usta, silik yazıyordu.'],
]

const CIRAK_USTA: readonly Ikili[] = [
  ['Usta, saat 4, eve gitsem mi?', 'Git {a}. Laptopu da al, VPN açık kalsın.'],
  ['{b} usta, hafta sonu gönüllüyüm!', 'Gönüllü yok {a}. Takvimde zaten yazıyor.'],
  ['Usta, bu revizenin kaçıncısı?', 'Sayan biter {a}. Sen yeniden başla.'],
  ['Usta, bana da brief verir misin?', 'Brief mi? Beni dinle, o brief.'],
  ['Usta, stajyer maaşı ne zaman?', 'Portfolyona yazarız {a}, o da para sayılır.'],
]

const CEVAP = [
  'Not aldım. Revizeye ekledim.',
  'Bunu müşteri duymasın {a}.',
  'Feride Hanım okursa mail atar.',
  'Haklısın, o yüzden yine ben yapacağım.',
  'Cumaya kadar hallederiz {a}...',
  'Görüldü. Cevap yazmıyorum.',
  'Bunu da brife ekleyelim, zaten roman oldu.',
]

const FERIDE_AZAR = [
  'Konuşmayın, çalışın. Sohbet müşteriye faturalanamıyor.',
  '{a}, {b}! Bu enerjiyi revizeye harcayın.',
  'Ben 3 gündür uyumadım, siz sohbet ediyorsunuz.',
  'Mesai biter sandınız? Mesai kapanır, iş kapanmaz.',
  'Müşteri bekliyor, siz fısıldaşıyorsunuz. Cuma akşamı son revize.',
  'Hafta sonu müsaitsiniz, takvime zaten ekledim.',
  'Telefonunuz titremiyor, işiniz çağırıyor. Aynı şey.',
  'Bunu bir de böyle görelim: sessizce ve daha hızlı.',
  'Ağlayacaksanız masanızda ağlayın, toplantı odası müşteriye ayrıldı.',
  'Yorgun musunuz? Güzel, yorgunluk da bir içgörü. Sunuma koyun.',
]

const FERIDE_BOS = 'Buyurun müşterimiz, brief bekliyoruz. Ekibim hazır; ben zaten 3 gündür buradayım. Bir iş verin lütfen.'
const FERIDE_KAPALI = 'Mod kapalı. Ofisten çıkmadım, çünkü çıkacak bir evim yok. Geri çağırmak için /feride aç yazın.'
const FERIDE_BITTI = [
  'Teslim edildi. Müşteri mutlu, ekip hâlâ ayakta; ikisi de benim sayemde.',
  'Rapor hazır. Ekibe teşekkür etmeyeceğim, alışmasınlar.',
  'Bitti. Yeni brief gelene kadar kimse uyumasın.',
  'Sunum tamam. Sıradaki revize yolda, şimdiden hazır olun.',
]
const KUTLAMA = [
  'Bitti! Cuma akşamı çıkış hakkımı kullanıyorum.',
  'Teslim ettim. Uyuyabilir miyim, sorum geçerli mi?',
  'Son revize bitti. Yenisi nerede?',
  'Sunum çıktı. Ben kayboluyorum.',
]

type Sahne = { sozler: Map<string, string>; feride: string }

/** Bu karede kim ne diyor: yalnızca işin kimliğinden ve kare sayacından türer. */
function sahne(is: Is): Sahne {
  const sozler = new Map<string, string>()
  const uyeler = is.uyeler
  const dilim = Math.floor(is.tik / 3)
  const faz = is.tik % 3
  const h = karma(`${is.id}:${dilim}`)

  if (is.durum === 'tamam') {
    const lafli = uyeler.filter(u => u.laf !== undefined)
    const konusan = sec(lafli.length > 0 ? lafli : uyeler, h)

    if (konusan !== undefined) sozler.set(konusan.id, konusan.laf ?? sec(KUTLAMA, h >>> 4) ?? '')

    return { sozler, feride: sec(FERIDE_BITTI, karma(is.id)) ?? '' }
  }

  const calisan = uyeler.filter(u => u.durum === 'calisiyor')
  const biten = uyeler.filter(u => u.durum === 'bitti').length
  const durumSozu = `Aşama ${is.asama}/${is.asamaSayisi}: ${calisan.length} kişi çalışıyor, ${biten} rapor masamda.`
  let a = sec(calisan.length > 0 ? calisan : uyeler, h)

  if (a === undefined) return { sozler, feride: durumSozu }

  let ozel: string | undefined
  let ferideSoyluyor = false

  if (is.atismalar.length > 0 && dilim % 2 === 0) {
    const ham = is.atismalar[(dilim / 2) % is.atismalar.length] ?? ''
    const parca = /^\s*([^:]{1,24}):\s*(.+)$/.exec(ham)
    const kim = parca?.[1]?.trim().toLowerCase() ?? ''

    ozel = parca?.[2] ?? ham
    ferideSoyluyor = kim.startsWith('feride')
    a = uyeler.find(u => u.ad.toLowerCase() === kim) ?? a
  }

  const konusan = a
  const digerleri = uyeler.filter(u => u.id !== konusan.id)
  const calisanDiger = digerleri.filter(u => u.durum === 'calisiyor')
  const b = sec(calisanDiger.length > 0 ? calisanDiger : digerleri, h >>> 3)
  const doldur = (soz: string): string => soz.replace(/\{a\}/g, konusan.ad).replace(/\{b\}/g, b?.ad ?? 'Feride Hanım')
  const azar = doldur(sec(FERIDE_AZAR, h >>> 9) ?? '')

  if (ozel !== undefined) {
    const cevap = doldur(sec(CEVAP, h >>> 5) ?? '')

    if (ferideSoyluyor) {
      if (faz >= 1) sozler.set(konusan.id, cevap)

      return { sozler, feride: ozel }
    }

    sozler.set(konusan.id, ozel)
    if (faz >= 1 && b !== undefined) sozler.set(b.id, cevap)

    return { sozler, feride: faz === 2 ? azar : durumSozu }
  }

  const havuz =
    konusan.seviye === 'usta' && b?.seviye === 'cirak'
      ? USTA_CIRAK
      : konusan.seviye === 'cirak' && b?.seviye === 'usta'
        ? CIRAK_USTA
        : GENEL
  const ikili = sec(havuz, h >>> 6) ?? ['', '']

  sozler.set(konusan.id, doldur(ikili[0]))
  if (faz >= 1 && b !== undefined) sozler.set(b.id, doldur(ikili[1]))

  return { sozler, feride: faz === 2 || (b === undefined && faz === 1) ? azar : durumSozu }
}

// ---------------------------------------------------------------------------
// Çizim: masaüstünde SVG ofis
// ---------------------------------------------------------------------------

const TURUNCU = '#D97757'
const KOYU = '#2B2B2B'
const ROZET: Record<Seviye, { zemin: string; yazi: string }> = {
  usta: { zemin: '#F2B705', yazi: '#3B2F2F' },
  kalfa: { zemin: '#5B8DEF', yazi: '#FFFFFF' },
  cirak: { zemin: '#58B368', yazi: '#FFFFFF' },
}

type Hal = Durum | 'uyku' | 'patron'

const yuvarla = (n: number): string => String(Math.round(n * 10) / 10)

/**
 * Clawd: 16 x 10,5 birimlik bloklu maskot; `s` bir birimin piksel karşılığı.
 * `sus` gövdeyle birlikte sallanan ekleri taşır (şapka, gözlük, pano).
 */
function clawd(x: number, y: number, s: number, hal: Hal, sus: string, sallar = false): string {
  const u = (v: number): string => yuvarla(v * s)
  const govde = hal === 'hata' ? '#BFA89E' : TURUNCU
  const dongu = 'repeatCount="indefinite"'
  const p: string[] = [`<g transform="translate(${yuvarla(x)} ${yuvarla(y)})"><g${hal === 'bekliyor' ? ' opacity="0.8"' : ''}>`]

  if (hal === 'calisiyor') {
    p.push(`<animateTransform attributeName="transform" type="translate" values="0 0;0 ${u(-0.35)};0 0" dur="0.5s" ${dongu}/>`)
  } else if (hal === 'bitti') {
    p.push(`<animateTransform attributeName="transform" type="translate" values="0 0;0 ${u(-1.5)};0 0;0 0" keyTimes="0;0.25;0.5;1" dur="1s" ${dongu}/>`)
  } else if (hal === 'patron') {
    p.push(`<animateTransform attributeName="transform" type="translate" values="0 0;0 ${u(-0.2)};0 0" dur="1.5s" ${dongu}/>`)
  } else if (hal !== 'hata') {
    p.push(`<animateTransform attributeName="transform" type="translate" values="0 0;0 ${u(0.35)};0 0" dur="3s" ${dongu}/>`)
  }

  if (hal === 'hata') p.push(`<g transform="rotate(8 ${u(8)} ${u(8)})">`)

  for (const bx of [3, 5.5, 9, 11.5]) {
    p.push(`<rect x="${u(bx)}" y="${u(7.5)}" width="${u(1.5)}" height="${u(3)}" fill="${govde}"/>`)
  }

  p.push(`<rect x="${u(2)}" y="0" width="${u(12)}" height="${u(8)}" rx="${u(0.5)}" fill="${govde}"/>`)

  // Kollar: çalışırken sırayla klavyeye iner, iş bitince havada.
  const kolY = hal === 'bitti' ? 0.6 : 3

  for (const [i, kx] of [0, 14].entries()) {
    const tus =
      hal === 'calisiyor'
        ? `<animate attributeName="y" values="${i === 0 ? `${u(3)};${u(2)};${u(3)}` : `${u(2)};${u(3)};${u(2)}`}" dur="0.5s" ${dongu}/>`
        : sallar && i === 1
          ? `<animate attributeName="y" values="${u(3)};${u(1.2)};${u(3)}" dur="1s" ${dongu}/>`
          : ''

    p.push(`<rect x="${u(kx)}" y="${u(kolY)}" width="${u(2)}" height="${u(2)}" fill="${govde}">${tus}</rect>`)
  }

  for (const gx of [4.5, 10.5]) {
    if (hal === 'calisiyor' || hal === 'patron') {
      p.push(
        `<rect x="${u(gx)}" y="${u(2)}" width="${u(1)}" height="${u(2)}" fill="${KOYU}">` +
          `<animate attributeName="height" values="${u(2)};${u(2)};${u(0.3)};${u(2)};${u(2)}" keyTimes="0;0.86;0.9;0.94;1" dur="3s" ${dongu}/>` +
          `<animate attributeName="y" values="${u(2)};${u(2)};${u(2.85)};${u(2)};${u(2)}" keyTimes="0;0.86;0.9;0.94;1" dur="3s" ${dongu}/></rect>`,
      )
    } else if (hal === 'bitti') {
      p.push(
        `<path d="M${u(gx - 0.5)} ${u(3.6)} L${u(gx + 0.5)} ${u(2.3)} L${u(gx + 1.5)} ${u(3.6)}" fill="none" stroke="${KOYU}" stroke-width="${u(0.5)}" stroke-linecap="round" stroke-linejoin="round"/>`,
      )
    } else if (hal === 'hata') {
      p.push(
        `<path d="M${u(gx - 0.3)} ${u(2.2)} L${u(gx + 1.3)} ${u(3.8)} M${u(gx + 1.3)} ${u(2.2)} L${u(gx - 0.3)} ${u(3.8)}" stroke="${KOYU}" stroke-width="${u(0.45)}" stroke-linecap="round"/>`,
      )
    } else {
      p.push(`<rect x="${u(gx - 0.3)}" y="${u(2.9)}" width="${u(1.6)}" height="${u(0.4)}" fill="${KOYU}"/>`)
    }
  }

  p.push(sus)
  if (hal === 'hata') p.push('</g>')
  p.push('</g></g>')

  return p.join('')
}

function sapka(seviye: Seviye, s: number): string {
  const u = (v: number): string => yuvarla(v * s)

  if (seviye === 'usta') {
    // Baret.
    return (
      `<path d="M${u(3.6)} ${u(0.2)} Q${u(8)} ${u(-4.6)} ${u(12.4)} ${u(0.2)} Z" fill="#F2B705"/>` +
      `<rect x="${u(2.6)}" y="${u(-0.4)}" width="${u(10.8)}" height="${u(0.9)}" rx="${u(0.4)}" fill="#D99E00"/>`
    )
  }

  if (seviye === 'kalfa') {
    // Kulaklık.
    return (
      `<path d="M${u(3)} ${u(1.4)} Q${u(3)} ${u(-2.2)} ${u(8)} ${u(-2.2)} Q${u(13)} ${u(-2.2)} ${u(13)} ${u(1.4)}" fill="none" stroke="#3A3A3A" stroke-width="${u(0.55)}"/>` +
      `<rect x="${u(1.5)}" y="${u(0.3)}" width="${u(1.7)}" height="${u(2.3)}" rx="${u(0.5)}" fill="#3A3A3A"/>` +
      `<rect x="${u(12.8)}" y="${u(0.3)}" width="${u(1.7)}" height="${u(2.3)}" rx="${u(0.5)}" fill="#3A3A3A"/>`
    )
  }

  // Pervaneli çırak şapkası.
  return (
    `<path d="M${u(5)} ${u(0.2)} Q${u(8)} ${u(-2.8)} ${u(11)} ${u(0.2)} Z" fill="#E4572E"/>` +
    `<rect x="${u(7.8)}" y="${u(-2.6)}" width="${u(0.4)}" height="${u(1.2)}" fill="#3A3A3A"/>` +
    `<ellipse cx="${u(8)}" cy="${u(-2.7)}" rx="${u(2.4)}" ry="${u(0.45)}" fill="#3A86FF">` +
    `<animate attributeName="rx" values="${u(2.4)};${u(0.3)};${u(2.4)}" dur="0.5s" repeatCount="indefinite"/></ellipse>`
  )
}

/** Feride'nin ekleri: topuz, gözlük, ruj, inci kolye, elinde pano. */
function ferideSusu(s: number): string {
  const u = (v: number): string => yuvarla(v * s)
  const p: string[] = [
    `<rect x="${u(1.8)}" y="${u(-0.9)}" width="${u(12.4)}" height="${u(1.7)}" rx="${u(0.8)}" fill="#4A2C2A"/>`,
    `<circle cx="${u(8)}" cy="${u(-2.3)}" r="${u(1.9)}" fill="#4A2C2A"/>`,
    `<path d="M${u(5.6)} ${u(-3.9)} L${u(10.4)} ${u(-0.9)}" stroke="#C9925F" stroke-width="${u(0.3)}" stroke-linecap="round"/>`,
  ]

  for (const gx of [3.5, 9.5]) {
    p.push(
      `<rect x="${u(gx)}" y="${u(1.4)}" width="${u(3)}" height="${u(3.2)}" rx="${u(0.9)}" fill="#FFFFFF" fill-opacity="0.3" stroke="#1F1F1F" stroke-width="${u(0.35)}"/>`,
    )
  }

  p.push(
    `<path d="M${u(6.5)} ${u(2.6)} L${u(9.5)} ${u(2.6)}" stroke="#1F1F1F" stroke-width="${u(0.35)}"/>`,
    `<path d="M${u(7)} ${u(5.7)} Q${u(8)} ${u(6.5)} ${u(9)} ${u(5.7)}" fill="none" stroke="#C2185B" stroke-width="${u(0.45)}" stroke-linecap="round"/>`,
  )

  for (let i = 0; i <= 6; i += 1) {
    p.push(`<circle cx="${u(5 + i)}" cy="${u(7.2 - Math.abs(3 - i) * 0.12)}" r="${u(0.36)}" fill="#FFFFFF" stroke="#D8CFC4" stroke-width="0.6"/>`)
  }

  p.push(
    `<rect x="${u(-3.4)}" y="${u(1.2)}" width="${u(4)}" height="${u(5.2)}" rx="${u(0.3)}" fill="#F5E6C8" stroke="#8B5A3C" stroke-width="${u(0.3)}"/>`,
    `<rect x="${u(-2.4)}" y="${u(0.7)}" width="${u(2)}" height="${u(0.9)}" rx="${u(0.3)}" fill="#8B5A3C"/>`,
  )

  for (let i = 0; i < 3; i += 1) {
    p.push(`<path d="M${u(-2.8)} ${u(2.7 + i * 1.1)} L${u(-0.2)} ${u(2.7 + i * 1.1)}" stroke="#8B5A3C" stroke-width="${u(0.22)}"/>`)
  }

  return p.join('')
}

/** Konuşma balonu: alt ucu (cx, alt) noktasına iner, belirirken büyür. */
function balon(cx: number, alt: number, satirlar: readonly string[]): string {
  const boy = 10.5
  const en = Math.max(46, Math.max(...satirlar.map(s => s.length)) * boy * 0.56 + 18)
  const yukseklik = satirlar.length * 13 + 9
  const sol = sinirla(cx - en / 2, 6, G - 6 - en) - cx
  const yazilar = satirlar
    .map(
      (satir, i) =>
        `<text x="${yuvarla(sol + en / 2)}" y="${yuvarla(-yukseklik + 15 + i * 13)}" font-size="${boy}" text-anchor="middle" fill="${KOYU}">${kacis(satir)}</text>`,
    )
    .join('')

  return (
    `<g transform="translate(${yuvarla(cx)} ${yuvarla(alt)})"><g>` +
    '<animateTransform attributeName="transform" type="scale" values="0.3;1.08;1" dur="0.3s" fill="freeze"/>' +
    `<rect x="${yuvarla(sol)}" y="${-yukseklik}" width="${yuvarla(en)}" height="${yukseklik}" rx="9" fill="#FFFFFF" stroke="${KOYU}" stroke-width="1.3"/>` +
    '<path d="M-5 -0.6 L0 7 L5 -0.6" fill="#FFFFFF" stroke="#FFFFFF" stroke-width="1.6"/>' +
    `<path d="M-5 0 L0 7 L5 0" fill="none" stroke="${KOYU}" stroke-width="1.3" stroke-linejoin="round"/>` +
    `${yazilar}</g></g>`
  )
}

function durumIsareti(durum: Durum, x: number, y: number): string {
  const yer = `<g transform="translate(${yuvarla(x)} ${yuvarla(y)})">`

  if (durum === 'calisiyor') {
    return (
      `${yer}<g><animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="3s" repeatCount="indefinite"/>` +
      '<circle r="6.5" fill="none" stroke="#6B5B4D" stroke-width="4" stroke-dasharray="3.4 3.4"/>' +
      '<circle r="4.4" fill="#6B5B4D"/><circle r="1.8" fill="#FFF4E6"/></g></g>'
    )
  }

  if (durum === 'bekliyor') {
    return (
      yer +
      [0, 1, 2]
        .map(
          i =>
            `<text x="${i * 6}" y="${-i * 7}" font-size="${9 + i * 2}" font-weight="700" fill="#8A7A6C">z` +
            `<animate attributeName="opacity" values="0;1;0" dur="3s" begin="-${i}s" repeatCount="indefinite"/></text>`,
        )
        .join('') +
      '</g>'
    )
  }

  if (durum === 'bitti') {
    const konfeti = ['#F2B705', '#5B8DEF', '#58B368', '#E4572E', '#B56BD6']
      .map(
        (renk, i) =>
          `<rect x="${-96 + i * 19}" y="-14" width="3.5" height="6" fill="${renk}">` +
          `<animateTransform attributeName="transform" type="translate" values="0 -8;0 34" dur="1.5s" begin="-${yuvarla(i * 0.3)}s" repeatCount="indefinite"/>` +
          `<animate attributeName="opacity" values="1;1;0" dur="1.5s" begin="-${yuvarla(i * 0.3)}s" repeatCount="indefinite"/></rect>`,
      )
      .join('')

    return (
      `${yer}${konfeti}<circle r="9" fill="#3FA34D"/>` +
      '<path d="M-4.5 0 L-1.3 3.4 L4.8 -3.2" fill="none" stroke="#FFFFFF" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></g>'
    )
  }

  const duman = [0, 1, 2]
    .map(
      i =>
        `<circle cx="${-52 + i * 5}" cy="-8" r="${4 + i}" fill="#9A9A9A">` +
        `<animate attributeName="cy" values="-8;-34" dur="1.5s" begin="-${yuvarla(i * 0.5)}s" repeatCount="indefinite"/>` +
        `<animate attributeName="opacity" values="0.75;0" dur="1.5s" begin="-${yuvarla(i * 0.5)}s" repeatCount="indefinite"/></circle>`,
    )
    .join('')

  return (
    `${yer}${duman}<circle r="9" fill="#D64545"/>` +
    '<text y="4.5" font-size="13" font-weight="700" text-anchor="middle" fill="#FFFFFF">!</text></g>'
  )
}

const G = 720
const UST = 222
const ADIM = 180
/** SVG'nin kendi genişliği G'nin bu katı: yüzey kutuyu yuvaya sığdırdığından çizim alanı doldurur. */
const SVG_BUYUTME = 2.5
/** Masaüstünde bir hücrenin CSS pikseli cinsinden tahmini eni. */
const PIKSEL_HUCRE = 7.5

function uyeCiz(uye: Uye, cx: number, t: number, hucre: number, soz: string | undefined): string {
  const s = 5
  const p: string[] = ['<g>']
  const ipucu = [
    `${uye.ad}: ${uye.rol} (${uye.asama}. aşama)`,
    uye.yetkinlikler.length > 0 ? `Yetkinlikler: ${uye.yetkinlikler.join(', ')}` : '',
    `Model: ${SEVIYE_ADI[uye.seviye]}/${uye.model}, ${uye.gerekce}`,
    `Görev: ${kisalt(temiz(uye.gorev), 220)}`,
  ]
    .filter(satir => satir !== '')
    .join('\n')

  p.push(`<title>${kacis(ipucu)}</title>`)
  p.push(`<rect x="${yuvarla(cx - hucre / 2 + 8)}" y="${t + 124}" width="${yuvarla(hucre - 16)}" height="3" rx="1.5" fill="#E3CDB4"/>`)
  p.push(clawd(cx - 8 * s, t + 64, s, uye.durum, sapka(uye.seviye, s)))

  // Masa ve dizüstü maskotun önünde: bacakları örter.
  p.push(
    `<rect x="${cx - 17}" y="${t + 84}" width="34" height="19" rx="2.5" fill="#4A4A4A"/>`,
    `<circle cx="${cx}" cy="${t + 93.5}" r="2.8" fill="${TURUNCU}">` +
      (uye.durum === 'calisiyor' ? '<animate attributeName="opacity" values="0.3;1;0.3" dur="1s" repeatCount="indefinite"/>' : '') +
      '</circle>',
    `<rect x="${cx - 58}" y="${t + 102}" width="116" height="9" rx="2" fill="#B07B4F"/>`,
    `<rect x="${cx - 52}" y="${t + 111}" width="104" height="13" fill="#C9925F"/>`,
  )
  p.push(durumIsareti(uye.durum, cx + 52, t + 72))

  const rozet = ROZET[uye.seviye]
  const inmis = uye.seviye !== uye.istenen

  p.push(
    `<text x="${cx}" y="${t + 141}" font-size="12.5" font-weight="700" text-anchor="middle" fill="#3B2F2F">${kacis(uye.ad)}</text>`,
    `<text x="${cx}" y="${t + 154}" font-size="10" text-anchor="middle" fill="#7A6A5C">${kacis(kisalt(uye.rol, 26))}</text>`,
    `<rect x="${cx - 50}" y="${t + 159}" width="100" height="15" rx="7.5" fill="${rozet.zemin}"/>`,
    `<text x="${cx}" y="${t + 170}" font-size="9.5" font-weight="700" text-anchor="middle" fill="${rozet.yazi}">` +
      `${inmis ? '↓ ' : ''}${SEVIYE_ADI[uye.seviye]} · ${kacis(kisalt(uye.model, 10))} · A${uye.asama}</text>`,
  )

  if (soz !== undefined && soz !== '') {
    p.push(balon(cx, t + 41, sar(soz, 23, 3)))
  } else if (uye.durum === 'calisiyor' && uye.sonIs !== undefined) {
    const is = kisalt(uye.sonIs, 28)
    const en = is.length * 5.5 + 18

    p.push(
      `<rect x="${yuvarla(cx - en / 2)}" y="${t + 22}" width="${yuvarla(en)}" height="17" rx="8.5" fill="#FFFFFF" fill-opacity="0.9" stroke="#C9B8A6"/>`,
      `<text x="${cx}" y="${t + 34}" font-size="9" font-family="Consolas, Menlo, monospace" text-anchor="middle" fill="#6B5B4D">${kacis(is)}</text>`,
      `<circle cx="${cx + 3}" cy="${t + 44}" r="2.2" fill="#FFFFFF" stroke="#C9B8A6"/>`,
    )
  }

  p.push('</g>')

  return p.join('')
}

function limitPanosu(limitler: readonly LimitOkuma[], is: Is | null): string {
  const p: string[] = [
    '<rect x="506" y="22" width="200" height="132" rx="8" fill="#2F3E46" stroke="#8B5A3C" stroke-width="4"/>',
    '<text x="606" y="43" font-size="10.5" font-weight="700" letter-spacing="1.5" text-anchor="middle" fill="#F4F1DE">LİMİT PANOSU</text>',
  ]

  if (limitler.length === 0) {
    p.push(
      '<text x="606" y="82" font-size="10.5" text-anchor="middle" fill="#CFE8D5">Limit bilgisi yok</text>',
      '<text x="606" y="98" font-size="9.5" text-anchor="middle" fill="#9DB5A6">(abonelik dışı oturum)</text>',
    )
  }

  for (const [i, limit] of limitler.slice(0, 3).entries()) {
    const y = 60 + i * 24
    const renk = limit.yuzde < 60 ? '#58B368' : limit.yuzde < 85 ? '#F2B705' : '#E4572E'

    p.push(
      `<text x="518" y="${y + 8}" font-size="10" fill="#F4F1DE">${kacis(kisalt(limitAdi(limit.tur), 9))}</text>`,
      `<rect x="574" y="${y}" width="86" height="9" rx="4.5" fill="#1B262B"/>`,
      `<rect x="574" y="${y}" width="${yuvarla((86 * limit.yuzde) / 100)}" height="9" rx="4.5" fill="${renk}"/>`,
      `<text x="698" y="${y + 8}" font-size="10" font-weight="700" text-anchor="end" fill="#F4F1DE">%${limit.yuzde}</text>`,
    )
  }

  if (is !== null) {
    p.push(`<text x="606" y="143" font-size="9.5" text-anchor="middle" fill="#CFE8D5">Bu işin tahmini payı ≈ %${sayi(is.tahmin)}</text>`)
  }

  return p.join('')
}

/**
 * Panonun boy/en oranı (hücre sayılarından; bir hücre aşağı yukarı enin iki katı boyundadır).
 * Ölçü bilinmiyorsa undefined: çizim kendi doğal oranıyla kalır. Yatık panoda oran küçük çıkar
 * ve çizim yine doğal boyunu korur (boy hiçbir zaman doğal boyun altına inmez).
 */
function panoOrani(sutunlar: number | undefined, satirlar: number | undefined): number | undefined {
  if (!sutunlar || !satirlar || sutunlar <= 0 || satirlar <= 0) return undefined
  // Düğme satırı ve boşluk için birkaç satır düşülür.
  const oran = (Math.max(1, satirlar - 3) * 2.1) / sutunlar

  return Number.isFinite(oran) ? Math.min(oran, 3) : undefined
}

function ofisSvg(
  is: Is | null,
  limitler: readonly LimitOkuma[],
  acik: boolean,
  hedefOran?: number,
): { kaynak: string; alt: string; oran: number } {
  const uyeler = is?.uyeler ?? []
  const n = uyeler.length
  const hedefBoy = hedefOran === undefined ? 0 : Math.round(G * hedefOran)
  // Uzun (dikey) panoda küçük ekip tek sütunda, daha iri çizilir; yoksa satır başına en çok iki üye.
  const dikey = hedefBoy > G * 1.1
  const sutun = n === 0 ? 3 : dikey && n <= 4 ? 1 : Math.min(n, 2)
  const sira = n === 0 ? 1 : Math.ceil(n / sutun)
  const hucre = (G - 28) / sutun
  // Pano boyunu doldurmak için satır başına düşen yükseklik; Clawd'lar buna göre büyür.
  const satirPayi = hedefBoy > 0 ? (hedefBoy - UST - 40) / sira : 0
  const enCok = sutun === 1 ? 2.4 : 1.8
  const buyutme = n === 0 ? 1 : Math.min(enCok, Math.max(1.5, satirPayi / ADIM))
  const adim = Math.max(ADIM * buyutme, satirPayi)
  // Üye, kendisine düşen satır payında dikeyde ortalanır.
  const kaydir = Math.round((adim - ADIM * buyutme) / 2)
  const dip = UST + sira * adim
  const boy = Math.round(Math.max(dip + 40, hedefBoy))
  const sh = is === null ? undefined : sahne(is)
  const ferideSozu = sh?.feride ?? (acik ? FERIDE_BOS : FERIDE_KAPALI)
  const suruyor = is?.durum === 'suruyor'
  const p: string[] = [
    // Kendi boyu geniş verilir: kutu "yuvaya kadar" genişlediği için çizim panonun ya da sohbetin
    // tüm genişliğini doldurur, yüksekliği oranla büyür.
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${G} ${boy}" width="${yuvarla(G * SVG_BUYUTME)}" height="${yuvarla(boy * SVG_BUYUTME)}" font-family="'Segoe UI', system-ui, -apple-system, sans-serif">`,
    `<rect width="${G}" height="${boy}" rx="16" fill="#FFF4E6"/>`,
    `<rect x="0" y="${boy - 30}" width="${G}" height="30" fill="#F3E3CF"/>`,
  ]

  // Feride: masasının arkasında, yanında kahvesi.
  p.push(clawd(60, 62, 7, 'patron', ferideSusu(7), suruyor))
  p.push(
    '<rect x="36" y="122" width="200" height="12" rx="3" fill="#8B5A3C"/>',
    '<rect x="44" y="134" width="184" height="42" fill="#A9714B"/>',
    '<rect x="86" y="144" width="100" height="20" rx="3" fill="#F2D398" stroke="#8B5A3C"/>',
    '<text x="136" y="158" font-size="10" font-weight="700" letter-spacing="0.8" text-anchor="middle" fill="#4A2C2A">PATRON FERİDE</text>',
    '<rect x="196" y="106" width="15" height="16" rx="2" fill="#FFFFFF" stroke="#4A2C2A" stroke-width="1.2"/>',
    '<path d="M211 110 Q218 114 211 118" fill="none" stroke="#4A2C2A" stroke-width="1.2"/>',
  )

  for (const i of [0, 1]) {
    p.push(
      `<path d="M${200 + i * 6} 102 q3 -5 0 -9 q-3 -4 0 -8" fill="none" stroke="#B9A999" stroke-width="1.4" stroke-linecap="round">` +
        `<animate attributeName="opacity" values="0;0.9;0" dur="3s" begin="-${yuvarla(i * 1.5)}s" repeatCount="indefinite"/></path>`,
    )
  }

  const satirlar = sar(ferideSozu, 36, 4)
  const balonBoyu = Math.max(46, satirlar.length * 16 + 18)

  p.push(
    `<rect x="240" y="22" width="252" height="${balonBoyu}" rx="12" fill="#FFFFFF" stroke="${KOYU}" stroke-width="1.5"/>`,
    '<path d="M241 38 L208 62 L241 54" fill="#FFFFFF" stroke="#FFFFFF" stroke-width="2"/>',
    `<path d="M240 38 L208 62 L240 54" fill="none" stroke="${KOYU}" stroke-width="1.5" stroke-linejoin="round"/>`,
    ...satirlar.map(
      (satir, i) => `<text x="254" y="${43 + i * 16}" font-size="12.5" fill="${KOYU}">${kacis(satir)}</text>`,
    ),
  )
  p.push(limitPanosu(limitler, is))

  // Şerit: iş ve aşamalar.
  p.push(`<rect x="14" y="186" width="${G - 28}" height="24" rx="12" fill="${KOYU}"/>`)

  if (is === null) {
    p.push('<text x="30" y="202" font-size="11" fill="#FFFFFF">Yedek kulübesi: ekip iş bekliyor</text>')
  } else {
    const etiket = is.durum === 'tamam' ? 'Bitti' : `Aşama ${is.asama}/${is.asamaSayisi}`
    const noktaSol = G - 30 - (is.asamaSayisi - 1) * 16

    p.push(
      `<text x="30" y="202" font-size="11" fill="#FFFFFF"><tspan font-weight="700">İŞ:</tspan> ${kacis(kisalt(is.ozet, 62))}</text>`,
      `<text x="${noktaSol - 14}" y="202" font-size="10.5" font-weight="700" text-anchor="end" fill="#F2D398">${etiket}</text>`,
    )

    for (let a = 1; a <= is.asamaSayisi; a += 1) {
      const bitmis = is.durum === 'tamam' || a < is.asama
      const simdiki = !bitmis && a === is.asama

      p.push(
        `<circle cx="${noktaSol + (a - 1) * 16}" cy="198" r="5" fill="${bitmis ? '#58B368' : simdiki ? TURUNCU : '#6B6B6B'}">` +
          (simdiki ? '<animate attributeName="r" values="4;6;4" dur="1s" repeatCount="indefinite"/>' : '') +
          '</circle>',
      )
    }
  }

  if (n === 0) {
    // Boş ofis de uzun panoda dikeyde ortalanır.
    p.push(`<g transform="translate(0 ${kaydir})">`)

    for (let i = 0; i < 3; i += 1) {
      const cx = 14 + hucre * (i + 0.5)

      p.push(
        `<rect x="${yuvarla(cx - hucre / 2 + 8)}" y="${UST + 124}" width="${yuvarla(hucre - 16)}" height="3" rx="1.5" fill="#E3CDB4"/>`,
        clawd(cx - 40, UST + 64, 5, 'uyku', ''),
        durumIsareti('bekliyor', cx + 52, UST + 72),
        `<text x="${yuvarla(cx)}" y="${UST + 141}" font-size="12" font-weight="700" text-anchor="middle" fill="#3B2F2F">Clawd ${i + 1}</text>`,
        `<text x="${yuvarla(cx)}" y="${UST + 154}" font-size="10" text-anchor="middle" fill="#7A6A5C">sırasını bekliyor</text>`,
      )
    }

    p.push('</g>')
  }

  for (const [i, uye] of uyeler.entries()) {
    const satir = Math.floor(i / sutun)
    const satirdaki = Math.min(sutun, n - satir * sutun)
    const cx = Math.round(14 + ((sutun - satirdaki) * hucre) / 2 + hucre * ((i % sutun) + 0.5))
    const t = Math.round(UST + satir * adim + kaydir)

    p.push(
      `<g transform="translate(${cx} ${t}) scale(${buyutme}) translate(${-cx} ${-t})">`,
      uyeCiz(uye, cx, t, hucre / buyutme, sh?.sozler.get(uye.id)),
      '</g>',
    )
  }

  const dipnot = is === null ? 'Model seçimi: usta → opus, kalfa → sonnet, çırak → haiku; kalan limite göre Feride karar verir.' : is.limitNotu

  for (const [i, satir] of sar(dipnot, 118, 2).entries()) {
    p.push(`<text x="20" y="${dip + 8 + i * 13}" font-size="10" font-style="italic" fill="#6B5B4D">${kacis(satir)}</text>`)
  }

  p.push('</svg>')

  const durumlar = uyeler.map(u => `${u.ad} (${u.rol}, ${SEVIYE_ADI[u.seviye]}): ${DURUM_ADI[u.durum]}`).join('; ')

  return {
    kaynak: p.join(''),
    oran: boy / G,
    alt: is === null ? `Feride'nin ofisi. Feride: ${ferideSozu}` : `Feride'nin ofisi. İş: ${is.ozet}. ${durumlar}. Feride: ${ferideSozu}`,
  }
}

const DURUM_ADI: Record<Durum, string> = {
  bekliyor: 'sırasını bekliyor',
  calisiyor: 'çalışıyor',
  bitti: 'bitirdi',
  hata: 'takıldı',
}

// ---------------------------------------------------------------------------
// İş akışı
// ---------------------------------------------------------------------------

// Modülün kendi değişkenleri: yeniden yüklemede sıfırlanır, session.start kurar.
let isciTuru = 'general-purpose'
let saat: Timer | undefined
const sonIsler = new Map<string, string>()
const supheler = new Map<string, number>()

type Hamle = { ne: 'asama'; asama: number } | { ne: 'son' } | undefined

/**
 * İşe bir değişiklik uygular ve o yazımla aşamanın kapanıp kapanmadığına
 * bakar. Kapanış aynı yazımın içinde alınır: iki üye aynı anda bitirse de
 * sonraki aşamayı yalnızca biri başlatır.
 */
async function ilerlet($: EngineInterface, degistir: (is: Is) => Is): Promise<void> {
  const simdi = await $.clock.now()
  const iz: { hamle: Hamle } = { hamle: undefined }
  const yeni = await update($, isAtom, (eski): Is | null => {
    iz.hamle = undefined
    if (eski === null || eski.durum !== 'suruyor') return eski

    const is = degistir(eski)

    if (is.uyeler.some(u => u.asama === is.asama && (u.durum === 'calisiyor' || u.durum === 'bekliyor'))) return is

    // Aşamanın hiçbir üyesi iş çıkaramadıysa sonrakiler boşuna başlatılmaz.
    const cokenAsama = is.uyeler.filter(u => u.asama === is.asama).every(u => u.durum === 'hata')

    if (cokenAsama && is.asama < is.asamaSayisi) {
      iz.hamle = { ne: 'son' }

      return {
        ...is,
        durum: 'tamam',
        bitti: simdi,
        uyeler: is.uyeler.map((u): Uye =>
          u.durum === 'bekliyor' ? { ...u, durum: 'hata', rapor: `${is.asama}. aşamadan hiç rapor çıkmadığı için başlatılmadı.` } : u,
        ),
      }
    }

    if (is.asama < is.asamaSayisi) {
      const sonraki = is.asama + 1

      iz.hamle = { ne: 'asama', asama: sonraki }

      return {
        ...is,
        asama: sonraki,
        uyeler: is.uyeler.map((u): Uye => (u.asama === sonraki ? { ...u, durum: 'calisiyor', basladi: simdi } : u)),
      }
    }

    iz.hamle = { ne: 'son' }

    return { ...is, durum: 'tamam', bitti: simdi }
  })
  const hamle = iz.hamle

  if (yeni === null || hamle === undefined) return
  if (hamle.ne === 'son') await bitir($, yeni)
  else await asamaBaslat($, yeni, hamle.asama)
}

async function asamaBaslat($: EngineInterface, is: Is, asama: number): Promise<void> {
  const uyeler = is.uyeler.filter(u => u.asama === asama)
  const sonuclar = await Promise.all(
    uyeler.map(async (uye): Promise<{ id: string; agentId?: string; hata?: string }> => {
      try {
        const baslayan = await $.agent.spawn({
          prompt: gorevMetni(is, uye),
          description: kisalt(`${uye.ad}: ${uye.rol}`, 60),
          subagentType: isciTuru,
          model: uye.model,
        })

        if (baslayan.deny !== undefined) return { id: uye.id, hata: baslayan.deny }
        if (baslayan.agentId === undefined) return { id: uye.id, hata: 'Ajan başladı ama kimliği alınamadı.' }

        return { id: uye.id, agentId: baslayan.agentId }
      } catch (hata) {
        return { id: uye.id, hata: String(hata) }
      }
    }),
  )

  if (asama > 1) $.ui.toast(`Feride: ${asama}. aşama başladı (${uyeler.map(u => u.ad).join(', ')})`)

  await ilerlet($, eski =>
    eski.id !== is.id
      ? eski
      : {
          ...eski,
          uyeler: eski.uyeler.map((u): Uye => {
            const sonuc = sonuclar.find(s => s.id === u.id)

            if (sonuc === undefined || u.durum !== 'calisiyor') return u
            if (sonuc.agentId !== undefined) return { ...u, agentId: sonuc.agentId }

            return { ...u, durum: 'hata', rapor: `Başlatılamadı: ${sonuc.hata ?? 'bilinmeyen neden'}` }
          }),
        },
  )
}

/**
 * Mesajı modele sonraki bir olaydan gönderir. Tutulan bir turun içinden
 * (komut, araç çağrısı) yapılan gönderim o turu bekleyeceği için reddedilir;
 * saatin tek atımlık çağrısı kendi olayıdır.
 */
function sonraGonder($: EngineInterface, args: { text: string; asUser?: true }, hataNotu: string): void {
  $.clock.after(0, () => {
    // Tur başlayınca çözülür; beklemeden bırakılır.
    $.prompt.submit(args).catch(hata => $.ui.log(`feride: ${hataNotu}: ${String(hata)}`, { to: 'debug' }))
  })
}

async function bitir($: EngineInterface, is: Is): Promise<void> {
  sonIsler.clear()
  supheler.clear()
  $.ui.toast(`Feride: ekip işi bitirdi (${sureMetni((is.bitti ?? is.basladi) - is.basladi)}). Raporlar masada.`, {
    timeoutMs: 8_000,
  })
  sonraGonder($, { text: topluRapor(is) }, 'rapor gönderilemedi')

  // Tahmini gerçekle karşılaştır: aynı pencere sürüyorsa katsayıyı düzelt.
  try {
    const simdiki = (await $.session.usage()).rateLimits.find(l => l.kind === 'five_hour')

    if (simdiki === undefined || is.baslangicYuzde === undefined || is.tabanTahmin <= 0) return
    if ((simdiki.resetsAt ?? '') !== (is.baslangicSifirlanma ?? '')) return

    const olculen = simdiki.percentUsed - is.baslangicYuzde

    if (olculen < 0) return

    const eski = await katsayiOku($)

    await $.store.set('katsayi', sinirla(eski * 0.7 + (olculen / is.tabanTahmin) * 0.3, 0.3, 5))
  } catch (hata) {
    $.ui.log(`feride: harcama ölçülemedi: ${String(hata)}`, { to: 'debug' })
  }
}

async function katsayiOku($: EngineInterface): Promise<number> {
  const kayitli = await $.store.get('katsayi')

  return typeof kayitli === 'number' && Number.isFinite(kayitli) ? sinirla(kayitli, 0.3, 5) : 1
}

async function uyeBitti($: EngineInterface, agentId: string, cevap: string, neden: string): Promise<void> {
  const is = await read($, isAtom)

  if (is === null || !is.uyeler.some(u => u.agentId === agentId && u.durum === 'calisiyor')) return

  const simdi = await $.clock.now()
  const basarili = neden === 'answer'
  const govde = cevap.trim() === '' ? '(Boş rapor.)' : kisalt(cevap.trim(), RAPOR_SINIRI)
  const rapor = basarili ? govde : `(Tur yarıda kaldı: ${neden}.) ${govde}`
  const laf = basarili ? lafBul(cevap) : undefined

  sonIsler.delete(agentId)
  await ilerlet($, eski => ({
    ...eski,
    uyeler: eski.uyeler.map((u): Uye => {
      if (u.agentId !== agentId || u.durum !== 'calisiyor') return u

      const { sonIs: _sonIs, ...kalan } = u

      return { ...kalan, durum: basarili ? 'bitti' : 'hata', rapor, bitti: simdi, ...(laf === undefined ? {} : { laf }) }
    }),
  }))
}

/** Saatin vuruşu: kareyi ilerletir, son işleri panoya yazar, ölen ajanı düşürür. */
async function vurus($: EngineInterface): Promise<void> {
  const is = await read($, isAtom)

  if (is === null || is.durum !== 'suruyor') return

  const simdi = await $.clock.now()
  const dusen = new Map<string, string>()
  let durumlar: Map<string, string> | undefined

  if (is.tik % 2 === 1) {
    try {
      durumlar = new Map((await $.agent.list()).map(a => [a.id, a.status]))
    } catch {
      durumlar = undefined
    }
  }

  for (const u of is.uyeler) {
    if (u.durum !== 'calisiyor') continue

    if (u.agentId === undefined) {
      if (simdi - (u.basladi ?? simdi) > 90_000) dusen.set(u.id, 'Ajan başlatılamadı.')
      continue
    }

    if (durumlar === undefined) continue

    const durum = durumlar.get(u.agentId)

    if (durum !== undefined && durum !== 'failed' && durum !== 'killed' && durum !== 'completed') {
      supheler.delete(u.agentId)
      continue
    }

    // Biten ajanın raporu turn.complete ile gelir: ona birkaç vuruş tanınır.
    // Listede hiç görünmeyen ajan için sabır uzundur (on dakika kadar).
    const kacinci = (supheler.get(u.agentId) ?? 0) + 1
    const sabir = durum === undefined ? 100 : durum === 'completed' ? 3 : 1

    supheler.set(u.agentId, kacinci)
    if (kacinci >= sabir) {
      dusen.set(u.id, durum === 'completed' ? 'Ajan bitti ama raporu yakalanamadı.' : `Ajan durdu (${durum ?? 'listede yok'}).`)
    }
  }

  const isler = new Map(sonIsler)

  await ilerlet($, eski =>
    eski.id !== is.id
      ? eski
      : {
          ...eski,
          tik: eski.tik + 1,
          uyeler: eski.uyeler.map((u): Uye => {
            if (u.durum !== 'calisiyor') return u

            const neden = dusen.get(u.id)

            if (neden !== undefined) return { ...u, durum: 'hata', rapor: neden, bitti: simdi }

            const sonIs = u.agentId === undefined ? undefined : isler.get(u.agentId)

            return sonIs === undefined || sonIs === u.sonIs ? u : { ...u, sonIs }
          }),
        },
  )
}

/** Panodaki işi siler (`/feride sıfırla` ve "Panoyu temizle" düğmesi). */
async function isiSil($: EngineInterface): Promise<void> {
  await update($, isAtom, () => null)
  sonIsler.clear()
  supheler.clear()
}

async function modAyarla($: EngineInterface, acik: boolean): Promise<void> {
  await update($, acikAtom, () => acik)
  await $.store.set('acik', acik)
}

async function panoAc($: EngineInterface): Promise<string> {
  try {
    const acilan = await $.ui.open(PANO_ACILISI)

    return acilan.isPlaced ? 'Ofis panosu açıldı.' : `Ofis panosu bu yüzeyde gösterilemiyor (${acilan.reason}).`
  } catch (hata) {
    return `Ofis panosu açılamadı (${String(hata)}).`
  }
}

function durumMetni(is: Is | null, limitler: readonly LimitOkuma[], acik: boolean, simdi: number): string {
  const satirlar = [`Feride modu: ${acik ? 'açık' : 'kapalı'}`]

  if (is === null) satirlar.push('Süren iş yok.')
  else {
    const sure = sureMetni((is.bitti ?? simdi) - is.basladi)

    satirlar.push(
      `İş: ${is.ozet}`,
      is.durum === 'tamam' ? `Bitti (${sure}).` : `Aşama ${is.asama}/${is.asamaSayisi}, sürüyor (${sure}).`,
      ...is.uyeler.map(
        u =>
          `- ${u.ad} · ${u.rol} · ${SEVIYE_ADI[u.seviye]}/${u.model} · ${u.asama}. aşama · ${DURUM_ADI[u.durum]}` +
          (u.durum === 'calisiyor' && u.sonIs !== undefined ? ` · ${u.sonIs}` : ''),
      ),
      `Limit kararı: ${is.limitNotu}`,
    )
  }

  satirlar.push(
    limitler.length === 0
      ? 'Limit: bilgi yok.'
      : `Limit: ${limitler.map(l => `${limitAdi(l.tur)} %${l.yuzde} dolu`).join(' · ')}`,
  )

  return satirlar.join('\n')
}

function ekipMetni(is: Is): string {
  const satirlar = [
    `Ekip kuruldu: ${is.uyeler.length} üye, ${is.asamaSayisi} aşama. Üyeler arka planda çalışıyor.`,
    '',
    `Limit kararı: ${is.limitNotu}`,
  ]

  for (let asama = 1; asama <= is.asamaSayisi; asama += 1) {
    satirlar.push('', `${asama}. aşama${asama > is.asama ? ' (önceki aşama bitince başlar)' : ''}`)

    for (const u of is.uyeler.filter(uye => uye.asama === asama)) {
      satirlar.push(
        `- ${u.ad}: ${u.rol} · ${SEVIYE_ADI[u.seviye]} (${u.model}) · ${u.gerekce}` +
          (u.durum === 'hata' ? ` · BAŞLAMADI: ${u.rapor ?? ''}` : ''),
      )
    }
  }

  satirlar.push(
    '',
    `Şimdi kullanıcıya ekibi kısaca tanıt ve turu bitir. Raporlar "${RAPOR_BASLIGI}" başlıklı tek mesajla gelecek; o gelmeden devrettiğin işi kendin yapma.`,
  )

  return satirlar.join('\n')
}

// ---------------------------------------------------------------------------
// Kayıt
// ---------------------------------------------------------------------------

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await update($, acikAtom, () => true)

    const kayitli = await $.store.get('acik')

    if (kayitli === false) await update($, acikAtom, () => false)

    await $.command.register({
      name: 'feride',
      description: "Patron Feride'nin ofisini aç ya da ona iş ver",
      argumentHint: '[iş tanımı | aç | kapat | durum | sıfırla]',
    })
    await $.tool.register({
      name: 'ekip_kur',
      description:
        'Feride modunun ekip kurma aracı: patron Feride (ana oturum) işi görevlere böler, üyeleri ve yetkinliklerini yazar; ' +
        'araç kalan kullanım limitine göre her üyenin modelini seçer, üyeleri arka planda başlatır ve hemen döner. ' +
        'Raporlar sonradan tek mesajla gelir. Yalnızca sistem isteminde Feride modu bölümü varken kullan.',
      inputSchema: {
        type: 'object',
        properties: {
          ozet: { type: 'string', description: 'İşin bir cümlelik özeti.' },
          ekip: {
            type: 'array',
            minItems: 1,
            maxItems: EN_COK_UYE,
            items: {
              type: 'object',
              properties: {
                ad: { type: 'string', description: 'Kısa bir Türkçe ad (en çok 14 karakter).' },
                rol: { type: 'string', description: 'Üyenin rolü, örn. "Kod kâşifi".' },
                yetkinlikler: { type: 'array', items: { type: 'string' }, description: '2-4 yetkinlik.' },
                seviye: {
                  type: 'string',
                  enum: ['usta', 'kalfa', 'çırak'],
                  description: 'usta: en güçlü model; kalfa: dengeli; çırak: hızlı ve ucuz.',
                },
                asama: { type: 'integer', minimum: 1, description: 'Aynı numara paralel çalışır; sonraki öncekinin raporlarını alır.' },
                gorev: { type: 'string', description: 'Tek başına anlaşılır görev metni: yollar, kısıtlar, beklenen çıktı.' },
                kritik: { type: 'boolean', description: 'true: limit daralsa da seviyesi en son düşürülür.' },
              },
              required: ['ad', 'rol', 'seviye', 'gorev'],
            },
          },
          atismalar: {
            type: 'array',
            items: { type: 'string' },
            description: 'Bu işe özel 4-8 kısa esprili söz, "Ad: söz" biçiminde.',
          },
        },
        required: ['ozet', 'ekip'],
      },
      isDeferred: false,
    })

    try {
      const kayit = await $.agent.register({
        name: 'clawd',
        description: "Feride'nin ekibindeki işçi; yalnızca Feride modu başlatır.",
        prompt: ISCI_ISTEMI,
        disallowedTools: [ARAC, 'Agent'],
        background: true,
      })

      isciTuru = kayit.agent
    } catch (hata) {
      isciTuru = 'general-purpose'
      $.ui.log(`feride: işçi türü kaydedilemedi, general-purpose kullanılacak: ${String(hata)}`, { to: 'debug' })
    }

    try {
      const limitler = limitleriOku((await $.session.usage()).rateLimits)

      await update($, limitAtom, () => limitler)
    } catch (hata) {
      $.ui.log(`feride: limitler okunamadı: ${String(hata)}`, { to: 'debug' })
    }

    saat?.cancel()
    saat = $.clock.every(TIK_MS, () => {
      vurus($).catch(hata => $.ui.log(`feride: vuruş: ${String(hata)}`, { to: 'debug' }))
    })

    return next(e)
  })

  // İşçi türünü yalnızca mod başlatır: modele Agent aracında gösterilmez.
  on('agent.offer', { agent: 'feride:clawd' }, () => ({ isOffered: false })).catch(() => ({ isOffered: false }))

  on('session.measure', async ($, e, next) => {
    if (e.changed.includes('rateLimits')) {
      const limitler = limitleriOku(e.rateLimits)

      await update($, limitAtom, () => limitler)
    }

    return next(e)
  })

  on('prompt.compose', async ($, e, next) => {
    const istem = await next(e)

    // Aracı olmayan döngü (işçiler) ve takım arkadaşları patron değildir.
    if (!e.tools.includes(ARAC) || e.traits.includes('teammate')) return istem
    if (!(await read($, acikAtom))) return istem

    return { ...istem, sections: [...istem.sections, { id: 'feride:patron', text: PATRON_BOLUMU, scope: 'session' }] }
  })

  on('command.run', { command: 'feride' }, async ($, e) => {
    const istek = e.args.trim()
    const anahtar = istek.toLowerCase()

    if (anahtar === 'kapat' || anahtar === 'kapa' || anahtar === 'off') {
      await modAyarla($, false)
      await $.ui.close({ id: PANE }).catch(() => undefined)

      return { text: 'Feride modu kapandı: yeni ekip kurulmaz; çalışan bir ekip varsa işini bitirir. Geri çağırmak için /feride aç.' }
    }

    if (anahtar === 'aç' || anahtar === 'ac' || anahtar === 'on') {
      await modAyarla($, true)

      return { text: `Feride modu açık: iş verdiğinde ekibi Feride kurar. ${await panoAc($)}` }
    }

    if (anahtar === 'durum') {
      return {
        text: durumMetni(await read($, isAtom), await read($, limitAtom), await read($, acikAtom), await $.clock.now()),
      }
    }

    if (anahtar === 'sıfırla' || anahtar === 'sifirla') {
      await isiSil($)

      return { text: 'Pano temizlendi. Çalışan ajan varsa işini bitirir ama raporu beklenmez.' }
    }

    if (!(await read($, acikAtom))) await modAyarla($, true)

    const pano = await panoAc($)

    if (istek === '') {
      return { text: `${pano} İş vermek için doğrudan yaz ya da /feride <iş tanımı> kullan; Feride ekibi kendisi kurar.` }
    }

    sonraGonder($, { text: `${istek}\n\n(Feride modu: bu iş için ${ARAC} ile ekip kur.)`, asUser: true }, 'iş iletilemedi')

    return { text: `Feride işi aldı, ekibi topluyor. ${pano}` }
  })

  on('tool.call', { tool: ARAC }, async ($, e) => {
    if (e.agentId !== undefined) return { deny: 'Ekibi yalnızca patron Feride (ana oturum) kurar; sen kendi görevini yap.' }
    if (!(await read($, acikAtom))) return { deny: 'Feride modu kapalı. Kullanıcı /feride aç yazarsa ekip kurulabilir.' }

    const plan = planOku(e)

    if (typeof plan === 'string') return { deny: `Ekip planı okunamadı: ${plan}` }

    const onceki = await read($, isAtom)

    if (onceki !== null && onceki.durum === 'suruyor') {
      const canli = new Set(
        (await $.agent.list()).filter(a => a.status !== 'completed' && a.status !== 'failed' && a.status !== 'killed').map(a => a.id),
      )

      if (onceki.uyeler.some(u => u.durum === 'calisiyor' && u.agentId !== undefined && canli.has(u.agentId))) {
        return {
          deny: `Ekip hâlâ "${onceki.ozet}" işinde (aşama ${onceki.asama}/${onceki.asamaSayisi}). "${RAPOR_BASLIGI}" gelmeden yeni ekip kurulmaz.`,
        }
      }
    }

    const simdi = await $.clock.now()
    let limitler: LimitOkuma[] = []
    let besSaat: { percentUsed: number; resetsAt?: string } | undefined

    try {
      const kullanim = await $.session.usage()

      limitler = limitleriOku(kullanim.rateLimits)
      besSaat = kullanim.rateLimits.find(l => l.kind === 'five_hour')
      await update($, limitAtom, () => limitler)
    } catch (hata) {
      $.ui.log(`feride: limitler okunamadı: ${String(hata)}`, { to: 'debug' })
    }

    const atama = modelSec(plan.taslaklar, limitler, simdi, await katsayiOku($))
    const yeni: Is = {
      id: `is-${simdi.toString(36)}`,
      ...(e.tool_use_id === '' ? {} : { cagri: e.tool_use_id }),
      ozet: plan.ozet,
      asama: 1,
      asamaSayisi: Math.max(...plan.taslaklar.map(t => t.asama)),
      uyeler: plan.taslaklar.map((t, i): Uye => {
        const secim = atama.secimler[i] ?? { seviye: t.istenen, gerekce: 'istenen seviye verildi' }

        return {
          id: `u${i + 1}`,
          ad: t.ad,
          rol: t.rol,
          yetkinlikler: t.yetkinlikler,
          istenen: t.istenen,
          seviye: secim.seviye,
          model: MODEL[secim.seviye],
          gerekce: secim.gerekce,
          asama: t.asama,
          gorev: t.gorev,
          kritik: t.kritik,
          durum: t.asama === 1 ? 'calisiyor' : 'bekliyor',
          ...(t.asama === 1 ? { basladi: simdi } : {}),
        }
      }),
      atismalar: plan.atismalar,
      limitNotu: atama.not,
      tahmin: atama.tahmin,
      tabanTahmin: atama.tabanTahmin,
      ...(besSaat === undefined ? {} : { baslangicYuzde: besSaat.percentUsed }),
      ...(besSaat?.resetsAt === undefined ? {} : { baslangicSifirlanma: besSaat.resetsAt }),
      basladi: simdi,
      durum: 'suruyor',
      tik: 0,
    }

    sonIsler.clear()
    supheler.clear()
    await update($, isAtom, () => yeni)
    $.ui.open(PANO_ACILISI).catch(() => undefined)
    $.ui.toast(`Feride ekibi topladı: ${yeni.uyeler.map(u => u.ad).join(', ')}`)
    await asamaBaslat($, yeni, 1)

    return { result: ekipMetni((await read($, isAtom)) ?? yeni) }
  }).catch(($, e, next) => (next.called ? next(e) : { deny: 'feride: ekip kurulurken beklenmeyen bir hata oldu.' }))

  // İşçilerin araç çağrıları panoda düşünce balonu olur.
  on('tool.call', ($, e, next) => {
    if (e.agentId !== undefined) {
      if (sonIsler.size > 64) sonIsler.clear()
      sonIsler.set(e.agentId, isOzeti(e))
    }

    return next(e)
  }).catch(($, e, next) => next(e))

  on('turn.complete', async ($, e, next) => {
    if (e.agentId !== undefined) {
      try {
        await uyeBitti($, e.agentId, e.answer, e.reason)
      } catch (hata) {
        $.ui.log(`feride: rapor işlenemedi: ${String(hata)}`, { to: 'debug' })
      }
    }

    return next(e)
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, ($, e) => ofisCiz($, e, e.props.bodyColumns, e.props.scroll?.bodyRows ?? e.viewport?.rows, true))

  // Sahne yalnızca yan panoda çizilir; sohbetteki ekip_kur satırı aracın kendi satırı olarak kalır.
}

/** Ofis sahnesi: masaüstünde animasyonlu SVG, terminalde Clawd karakterleriyle. */
async function ofisCiz(
  $: EngineInterface,
  e: ResolveInput,
  genislik: number,
  satirlar: number | undefined,
  pano = false,
): Promise<RenderElement> {
    const tablo = $.ui.resolve(e)
    const { Box, Text, Button } = tablo
    const is = await read($, isAtom)
    const limitler = await read($, limitAtom)
    const acik = await read($, acikAtom)
    const dugmeler = (
      <Box flexDirection="row" gap={1}>
        <Button key="mod" label={acik ? 'Modu kapat' : 'Modu aç'} onPress={() => modAyarla($, !acik)} />
        {is !== null && is.durum === 'tamam' && (
          <Button key="temizle" label="Panoyu temizle" onPress={() => isiSil($)} />
        )}
      </Box>
    )

    if (e.surface !== 'terminal' && 'Svg' in tablo) {
      const { Svg } = tablo
      const cizim = ofisSvg(is, limitler, acik, pano ? panoOrani(genislik, satirlar) : undefined)
      const en = Math.max(240, Math.round(genislik * PIKSEL_HUCRE))

      return (
        <Box flexDirection="column" gap={1} width="100%" flexGrow={1}>
          {/* Masaüstü boyu verilmemiş SVG'yi kısa bir kutuya sığdırıyor: en ve boy açıkça,
              CSS pikseli olarak verilir (bir hücre ≈ PIKSEL_HUCRE piksel). */}
          <Svg source={cizim.kaynak} alt={cizim.alt} width={en} height={Math.round(en * cizim.oran)} isInteractive />
          {dugmeler}
        </Box>
      )
    }

    // Svg'si olmayan yüzey (terminal): aynı sahne, karakter maskotlarla.
    const sh = is === null ? undefined : sahne(is)
    const kare = is?.tik ?? 0
    const ferah = genislik >= 56 && (is?.uyeler.length ?? 0) * 4 + 12 <= (satirlar ?? 40)
    const cubuk = (yuzde: number): string => {
      const dolu = Math.round(yuzde / 10)

      return '█'.repeat(dolu) + '░'.repeat(10 - dolu)
    }
    const renk = (durum: Durum): 'claude' | 'inactive' | 'success' | 'error' =>
      durum === 'calisiyor' ? 'claude' : durum === 'bitti' ? 'success' : durum === 'hata' ? 'error' : 'inactive'
    const isaret = (durum: Durum): string =>
      durum === 'calisiyor' ? (['◐', '◓', '◑', '◒'][kare % 4] ?? '◐') : durum === 'bitti' ? '✓' : durum === 'hata' ? '✗' : 'z'
    const bacak = (durum: Durum): string => (durum === 'calisiyor' && kare % 2 === 1 ? '  ▝▝ ▘▘  ' : '  ▘▘ ▝▝  ')
    const konusmalar = is === null || sh === undefined ? [] : is.uyeler.filter(u => sh.sozler.has(u.id))

    return (
      <Box flexDirection="column" width={genislik}>
        <Box flexDirection="row" gap={2}>
          <Box flexDirection="column" flexShrink={0}>
            <Text color="claude">{'    @    '}</Text>
            <Text color="claude">{' ▐▛███▜▌ '}</Text>
            <Text color="claude">{'▝▜█████▛▘'}</Text>
            <Text color="claude">{'  ▘▘ ▝▝  '}</Text>
          </Box>
          <Box flexDirection="column">
            <Text key="patron" color="claude" weight="bold">
              FERİDE · patron
            </Text>
            <Text key="feride-sozu">“{sh?.feride ?? (acik ? FERIDE_BOS : FERIDE_KAPALI)}”</Text>
            {is !== null && (
              <Text key="is" dimColor>
                İş: {kisalt(is.ozet, Math.max(20, genislik - 24))} · {is.durum === 'tamam' ? 'bitti' : `aşama ${is.asama}/${is.asamaSayisi}`}
              </Text>
            )}
            <Text key="limit" dimColor>
              {limitler.length === 0
                ? 'Limit: bilgi yok'
                : limitler.map(l => `${limitAdi(l.tur)} ${cubuk(l.yuzde)} %${l.yuzde}`).join('  ')}
            </Text>
          </Box>
        </Box>
        {is !== null &&
          is.uyeler.map(u =>
            ferah ? (
              <Box flexDirection="row" gap={2} marginTop={1}>
                <Box flexDirection="column" flexShrink={0}>
                  <Text color={renk(u.durum)}>{' ▐▛███▜▌ '}</Text>
                  <Text color={renk(u.durum)}>{'▝▜█████▛▘'}</Text>
                  <Text color={renk(u.durum)}>{bacak(u.durum)}</Text>
                </Box>
                <Box flexDirection="column">
                  <Text weight="bold">
                    {isaret(u.durum)} {u.ad} · {u.rol}
                  </Text>
                  <Text color={renk(u.durum)}>
                    {u.seviye !== u.istenen ? '↓ ' : ''}
                    {SEVIYE_ADI[u.seviye]}/{u.model} · {u.asama}. aşama · {DURUM_ADI[u.durum]}
                  </Text>
                  <Text dimColor>{u.durum === 'calisiyor' ? (u.sonIs ?? 'düşünüyor…') : (u.laf ?? u.yetkinlikler.join(', '))}</Text>
                </Box>
              </Box>
            ) : (
              <Text color={renk(u.durum)}>
                {isaret(u.durum)} ▐▛█▜▌ {u.ad} · {kisalt(u.rol, 18)} · {SEVIYE_ADI[u.seviye]}/{u.model} · {DURUM_ADI[u.durum]}
                {u.durum === 'calisiyor' && u.sonIs !== undefined ? ` · ${u.sonIs}` : ''}
              </Text>
            ),
          )}
        {konusmalar.length > 0 && (
          <Box flexDirection="column" marginTop={1}>
            {konusmalar.map(u => (
              <Text color="suggestion">
                » {u.ad}: {sh?.sozler.get(u.id)}
              </Text>
            ))}
          </Box>
        )}
        {is !== null && (
          <Box marginTop={1}>
            <Text dimColor>{is.limitNotu}</Text>
          </Box>
        )}
        <Box marginTop={1}>{dugmeler}</Box>
      </Box>
    )
}
