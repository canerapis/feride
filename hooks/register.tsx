import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, RenderElement, ResolveInput, Timer } from 'claude-code'

import type { Durum, Etkinlik, Is, IsTuru, LimitOkuma, Sablon, Seviye, Uye } from '../types'
import { FERIDE_BOS, FERIDE_KAPALI, kartSvg, sahne, sahneSvg } from './cizim'
import {
  DURUM_ADI,
  MODEL,
  SABLON,
  SABLON_SIRASI,
  SEVIYE_ADI,
  etkinlikBul,
  kisalt,
  limitAdi,
  limitleriOku,
  modelSec,
  patronModeli,
  sablonOku,
  sinirla,
  sureMetni,
  temiz,
} from './ortak'
import type { Taslak } from './ortak'

const PANE = 'feride-ofis'
const BASLIK = "Feride'nin Ofisi"
/** Pano geniş açılsın: yan bölmede 96 sütun, istem üstünde 30 satır istenir (kişinin ayarı kazanır). */
const PANO_ACILISI = { id: PANE, title: BASLIK, rows: 30, columns: 96 } as const
const ARAC = 'mcp__feride__ekip_kur'
const RAPOR_BASLIGI = 'FERİDE EKİP RAPORU'

// Saat üç saniyede bir vurur: ölen ajanı yakalamak için sık, panoyu yeniden
// çizmek için seyrek (bkz. vurus). Sahnedeki olaylar SVG'nin kendi içinde döner.
const TIK_MS = 3_000
/** Pano kaç vuruşta bir güncellenir (9 sn). */
const PANO_VURUSU = 3
/** Bir üyenin kartındaki canlandırma en erken bu kadar sonra değişir. */
const ETKINLIK_ARASI = 15_000
/** Masaüstünde bir hücrenin CSS pikseli cinsinden tahmini eni. */
const PIKSEL_HUCRE = 7.5
const RAPOR_SINIRI = 6_000
const TOPLU_RAPOR_SINIRI = 40_000
const EN_COK_UYE = 8

const acikAtom = atom({ plugin: 'feride', key: 'acik' } as const, true)
const isAtom = atom({ plugin: 'feride', key: 'is' } as const, null)
const limitAtom = atom({ plugin: 'feride', key: 'limitler' } as const, [])
const sablonAtom = atom({ plugin: 'feride', key: 'sablon' } as const, 'orta')

// ---------------------------------------------------------------------------
// Plan: Feride'nin araca verdiği ekip
// ---------------------------------------------------------------------------

const YEDEK_ADLAR = ['Ayşe', 'Mehmet', 'Zeynep', 'Can', 'Elif', 'Deniz', 'Ece', 'Mert']

type Plan = { ozet: string; taslaklar: Taslak[]; atismalar: string[]; sablon?: Sablon }

const yazi = (deger: unknown, en: number): string => (typeof deger === 'string' ? kisalt(deger.trim(), en) : '')

const duz = (deger: unknown): string =>
  typeof deger === 'string' ? deger.toLowerCase().replace(/ç/g, 'c').replace(/ı/g, 'i').replace(/ü/g, 'u').replace(/ş/g, 's').trim() : ''

function seviyeOku(deger: unknown): Seviye {
  const s = duz(deger)

  if (s === 'ustat' || s === 'fable') return 'ustat'
  if (s === 'usta' || s === 'opus' || s === 'senior') return 'usta'
  if (s === 'cirak' || s === 'haiku' || s === 'junior') return 'cirak'

  return 'kalfa'
}

function isTuruOku(deger: unknown): IsTuru {
  const s = duz(deger)

  if (s === 'metin' || s === 'yazi' || s === 'icerik') return 'metin'
  if (s === 'kod') return 'kod'
  if (s === 'arastirma' || s === 'analiz') return 'arastirma'
  if (s === 'inceleme' || s === 'test' || s === 'denetim') return 'inceleme'

  return 'genel'
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
      isTuru: isTuruOku(u.tur),
    })
  }

  // Aşamalar boşluksuz 1..n olur: 1, 3, 3, 7 yazıldıysa 1, 2, 2, 3.
  const basamaklar = [...new Set(taslaklar.map(t => t.asama))].sort((a, b) => a - b)

  for (const t of taslaklar) t.asama = basamaklar.indexOf(t.asama) + 1
  taslaklar.sort((a, b) => a.asama - b.asama)

  const sablon = sablonOku(girdi.sablon)

  return {
    ozet,
    taslaklar,
    atismalar: diziOku(girdi.atismalar)
      .map(a => temiz(yazi(a, 90)))
      .filter(a => a !== '')
      .slice(0, 12),
    ...(sablon === undefined ? {} : { sablon }),
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
- Seviye: \`üstat\` en üst model (fable), yalnızca gerçekten gerektiren iş için: çok zor akıl yürütme, mimari karar, inatçı hata; \`usta\` güçlü model (opus: zor uygulama, son kalite kontrolü); \`kalfa\` dengeli (sonnet: uygulama, yazım, inceleme); \`çırak\` hızlı ve ucuz (haiku: tarama, arama, özet, mekanik iş). Gerektiği kadarını iste: modeli geçerli şablona ve kalan kullanım limitine göre araç seçer, gerekirse seviyeyi düşürür. Düşürülmemesi gereken üyeye \`kritik: true\` ver.
- Her üyeye işinin türünü yaz (\`tur\`): \`metin\` (düz metin yazma, özet, çeviri, belge, slogan), \`kod\`, \`arastirma\`, \`inceleme\` (kod incelemesi, test, doğrulama). Tür, üyenin binadaki departmanını da belirler: her tür ayrı bir katta oturur. Düz metin işine \`üstat\` isteme: araç zaten vermez. Durduk yere en pahalı modeli isteme; metin işinin çoğu kalfayla, mekanik olanı çırakla biter.
- \`sablon\` alanını yalnızca kullanıcı bu iş için açıkça başka bir şablon istediyse doldur ("bunu güçlü ekiple yap" gibi); yoksa boş bırak, geçerli şablon kullanılır.
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

    return kisalt(`${arac}: ${temiz(dosya ? (deger.split(/[\\/]/).pop() ?? deger) : deger)}`, 52)
  }

  return kisalt(arac, 52)
}

/** Patron bölümünün şablona göre değişen son paragrafı. */
function sablonBolumu(sablon: Sablon): string {
  const S = SABLON[sablon]

  return (
    `## Geçerli şablon: ${S.ad}\n` +
    `Bu şablon ${S.ozet}. Verilebilecek en yüksek seviye: ${SEVIYE_ADI[S.tavan]}. ` +
    'Seviyeleri buna göre iste; şablonu kullanıcı `/feride şablon hafif|orta|güçlü` ile değiştirir.'
  )
}

// ---------------------------------------------------------------------------
// İş akışı
// ---------------------------------------------------------------------------

// Modülün kendi değişkenleri: yeniden yüklemede sıfırlanır, session.start kurar.
let isciTuru = 'general-purpose'
let saat: Timer | undefined
const sonIsler = new Map<string, { metin: string; etkinlik: Etkinlik }>()
const supheler = new Map<string, number>()
/** Feride'nin modeli değiştirilince üst üste yanıtsız kalan adım sayısı: ikide vazgeçilir. */
let patronHatasi = 0
let vurusSayisi = 0
/** Üyenin canlandırmasının en son değiştiği an. */
const etkinlikZamani = new Map<string, number>()

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

      const { sonIs: _sonIs, etkinlik: _etkinlik, ...kalan } = u

      return { ...kalan, durum: basarili ? 'bitti' : 'hata', rapor, bitti: simdi, ...(laf === undefined ? {} : { laf }) }
    }),
  }))
}

/**
 * Saatin vuruşu: ölen ajanı hemen düşürür; panoya yazılanları (son işler, kare sayacı)
 * her üç vuruşta bir günceller. Pano her yazımda yeniden çizildiği için seyrek yazılır:
 * canlandırmalar kesilmez, bilgi birkaç saniye geriden gelir.
 */
async function vurus($: EngineInterface): Promise<void> {
  const is = await read($, isAtom)

  if (is === null || is.durum !== 'suruyor') return

  vurusSayisi += 1

  const simdi = await $.clock.now()
  const dusen = new Map<string, string>()
  const panoZamani = vurusSayisi % PANO_VURUSU === 0
  let durumlar: Map<string, string> | undefined

  if (vurusSayisi % 2 === 0) {
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

  if (dusen.size === 0 && !panoZamani) return

  const isler = new Map(sonIsler)

  await ilerlet($, eski =>
    eski.id !== is.id
      ? eski
      : {
          ...eski,
          tik: panoZamani ? eski.tik + 1 : eski.tik,
          uyeler: eski.uyeler.map((u): Uye => {
            if (u.durum !== 'calisiyor') return u

            const neden = dusen.get(u.id)

            if (neden !== undefined) return { ...u, durum: 'hata', rapor: neden, bitti: simdi }

            const son = u.agentId === undefined || !panoZamani ? undefined : isler.get(u.agentId)

            if (son === undefined) return u

            // Canlandırma en çok ETKINLIK_ARASI'nda bir değişir: her araç çağrısında kartı baştan çizmez.
            const degisir = son.etkinlik !== u.etkinlik && simdi - (etkinlikZamani.get(u.id) ?? 0) >= ETKINLIK_ARASI

            if (degisir) etkinlikZamani.set(u.id, simdi)
            if (son.metin === u.sonIs && !degisir) return u

            return { ...u, sonIs: son.metin, ...(degisir ? { etkinlik: son.etkinlik } : {}) }
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
  if (acik) patronHatasi = 0
  await update($, acikAtom, () => acik)
  await $.store.set('acik', acik)
}

async function sablonAyarla($: EngineInterface, sablon: Sablon): Promise<void> {
  await update($, sablonAtom, () => sablon)
  await $.store.set('sablon', sablon)
}

/** Feride'nin şu an çalışacağı model: mod kapalıyken ya da vazgeçilmişse oturumun kendi modeli. */
async function patronDurumu($: EngineInterface): Promise<{ model: string; neden: string }> {
  if (patronHatasi >= 2) return { model: 'oturumun modeli', neden: 'en üst model bu oturumda yanıt vermedi' }

  return patronModeli(await read($, limitAtom))
}

async function panoAc($: EngineInterface): Promise<string> {
  try {
    const acilan = await $.ui.open(PANO_ACILISI)

    return acilan.isPlaced ? 'Ofis panosu açıldı.' : `Ofis panosu bu yüzeyde gösterilemiyor (${acilan.reason}).`
  } catch (hata) {
    return `Ofis panosu açılamadı (${String(hata)}).`
  }
}

function durumMetni(
  is: Is | null,
  limitler: readonly LimitOkuma[],
  acik: boolean,
  simdi: number,
  sablon: Sablon,
  patron: { model: string; neden: string },
): string {
  const satirlar = [
    `Feride modu: ${acik ? 'açık' : 'kapalı'}`,
    `Şablon: ${SABLON[sablon].ad} (${SABLON[sablon].ozet})`,
    `Feride'nin modeli: ${patron.model} (${patron.neden})`,
  ]

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

    const kayitliSablon = sablonOku(await $.store.get('sablon')) ?? 'orta'

    await update($, sablonAtom, () => kayitliSablon)
    patronHatasi = 0
    vurusSayisi = 0
    etkinlikZamani.clear()

    await $.command.register({
      name: 'feride',
      description: "Patron Feride'nin ofisini aç ya da ona iş ver",
      argumentHint: '[iş tanımı | aç | kapat | durum | sıfırla | şablon hafif|orta|güçlü]',
    })
    await $.tool.register({
      name: 'ekip_kur',
      description:
        'Feride modunun ekip kurma aracı: patron Feride (ana oturum) işi görevlere böler, üyeleri ve yetkinliklerini yazar; ' +
        'araç geçerli şablona ve kalan kullanım limitine göre her üyenin modelini seçer, üyeleri arka planda başlatır ve hemen döner. ' +
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
                  enum: ['üstat', 'usta', 'kalfa', 'çırak'],
                  description:
                    'üstat: en üst model, yalnızca gerçekten gerektiren zor iş için (düz metne verilmez); usta: güçlü; kalfa: dengeli; çırak: hızlı ve ucuz.',
                },
                tur: {
                  type: 'string',
                  enum: ['metin', 'kod', 'arastirma', 'inceleme'],
                  description: 'İşin türü. metin: düz metin yazma, özet, çeviri, belge; inceleme: kod incelemesi, test, doğrulama.',
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
          sablon: {
            type: 'string',
            enum: ['hafif', 'orta', 'güçlü'],
            description: 'Yalnızca kullanıcı bu iş için açıkça başka bir şablon istediyse; yoksa boş bırak.',
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

    const text = `${PATRON_BOLUMU}\n\n${sablonBolumu(await read($, sablonAtom))}`

    return { ...istem, sections: [...istem.sections, { id: 'feride:patron', text, scope: 'session' }] }
  })

  // Feride (ana döngü) hep en üst modelde çalışır; bir limit dolmak üzereyken bir alttakine iner.
  on('turn.step', async function* ($, e, next) {
    if (e.agentId !== undefined || patronHatasi >= 2 || !(await read($, acikAtom))) return yield* next(e)

    const { model } = patronModeli(await read($, limitAtom))

    // Oturum zaten o modeldeyse (geniş bağlamlı türü de olabilir) dokunulmaz.
    if (e.model.toLowerCase().includes(model)) return yield* next(e)

    const sonuc = yield* next({ ...e, model })

    if (sonuc.stopReason === null && sonuc.usage === null) {
      // Model bu hesapta yoksa oturum kilitlenmesin: iki yanıtsız adımdan sonra vazgeçilir.
      patronHatasi += 1
      if (patronHatasi >= 2) $.ui.toast(`Feride: ${model} yanıt vermedi; oturumun kendi modeliyle devam ediyorum.`, { timeoutMs: 8_000 })
    } else {
      patronHatasi = 0
    }

    return sonuc
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
        text: durumMetni(
          await read($, isAtom),
          await read($, limitAtom),
          await read($, acikAtom),
          await $.clock.now(),
          await read($, sablonAtom),
          await patronDurumu($),
        ),
      }
    }

    // "/feride şablon güçlü" ya da kısaca "/feride güçlü": ekibin model cömertliği.
    const sablonKomutu = /^(?:şablon|sablon)(?:\s+(.+))?$/.exec(anahtar)
    const secilen = sablonKomutu === null ? sablonOku(anahtar) : sablonOku(sablonKomutu[1])

    if (sablonKomutu !== null && secilen === undefined) {
      const simdiki = await read($, sablonAtom)
      const liste = SABLON_SIRASI.map(s => `- ${SABLON[s].ad}${s === simdiki ? ' (geçerli)' : ''}: ${SABLON[s].ozet}`).join('\n')

      return {
        text:
          (sablonKomutu[1] === undefined ? '' : `"${sablonKomutu[1]}" diye bir şablon yok. `) +
          `Şablonlar:\n${liste}\nDeğiştirmek için: /feride şablon hafif|orta|güçlü`,
      }
    }

    if (secilen !== undefined) {
      await sablonAyarla($, secilen)

      return { text: `Şablon: ${SABLON[secilen].ad}. Bu şablon ${SABLON[secilen].ozet}. Sonraki ekipte geçerli.` }
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

    const sablon = plan.sablon ?? (await read($, sablonAtom))
    const atama = modelSec(plan.taslaklar, limitler, simdi, await katsayiOku($), sablon)
    const yeni: Is = {
      id: `is-${simdi.toString(36)}`,
      ...(e.tool_use_id === '' ? {} : { cagri: e.tool_use_id }),
      ozet: plan.ozet,
      sablon,
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
          isTuru: t.isTuru,
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

  // İşçilerin araç çağrıları kartlarına yansır: ne yaptığı yazıyla, nasıl yaptığı canlandırmayla.
  on('tool.call', ($, e, next) => {
    if (e.agentId !== undefined) {
      if (sonIsler.size > 64) sonIsler.clear()
      sonIsler.set(e.agentId, { metin: isOzeti(e), etkinlik: etkinlikBul(e.tool) })
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

  on('ui.render', { component: 'Pane', requestId: PANE }, ($, e) => ofisCiz($, e, e.props.bodyColumns, e.props.scroll?.bodyRows ?? e.viewport?.rows))

  // Sahne yalnızca yan panoda çizilir; sohbetteki ekip_kur satırı aracın kendi satırı olarak kalır.
}

/**
 * Ofis panosu. Masaüstünde üstte sahne (Feride ve ortada dolaşan ekip), altında her üyenin
 * kendi kartı: ayrı SVG'ler, her biri panonun enini doldurur. Terminalde Clawd karakterleriyle.
 */
async function ofisCiz($: EngineInterface, e: ResolveInput, genislik: number, satirlar: number | undefined): Promise<RenderElement> {
    const tablo = $.ui.resolve(e)
    const { Box, Text, Button } = tablo
    const is = await read($, isAtom)
    const limitler = await read($, limitAtom)
    const acik = await read($, acikAtom)
    const sablon = await read($, sablonAtom)
    const patron = acik ? await patronDurumu($) : { model: 'oturumun modeli', neden: 'mod kapalı' }
    const sonrakiSablon = SABLON_SIRASI[(SABLON_SIRASI.indexOf(sablon) + 1) % SABLON_SIRASI.length] ?? 'orta'
    const dugmeler = (
      <Box flexDirection="row" gap={1}>
        <Button key="mod" label={acik ? 'Modu kapat' : 'Modu aç'} onPress={() => modAyarla($, !acik)} />
        <Button key="sablon" label={`Şablon: ${SABLON[sablon].ad}`} onPress={() => sablonAyarla($, sonrakiSablon)} />
        {is !== null && is.durum === 'tamam' && (
          <Button key="temizle" label="Panoyu temizle" onPress={() => isiSil($)} />
        )}
      </Box>
    )

    if (e.surface !== 'terminal' && 'Svg' in tablo) {
      const { Svg } = tablo
      // Masaüstü boyu verilmemiş SVG'yi kısa bir kutuya sığdırıyor: en ve boy açıkça,
      // CSS pikseli olarak verilir (bir hücre ≈ PIKSEL_HUCRE piksel).
      const en = Math.max(240, Math.round(genislik * PIKSEL_HUCRE))
      // Bina kendi içinde dönen tek bir canlandırmadır: kaynağı yalnızca işin durumu değişince değişir.
      const ofis = sahneSvg(is, limitler, acik, sablon, patron.model)
      const uyeler = is?.uyeler ?? []
      const calisanlar = uyeler.filter(uye => uye.durum === 'calisiyor' && uye.sonIs !== undefined)

      return (
        <Box flexDirection="column" gap={1} width="100%">
          <Box key="bina">
            <Svg source={ofis.kaynak} alt={ofis.alt} width={en} height={Math.round(en * ofis.oran)} isInteractive />
          </Box>
          {/* Kartın kaynağı yalnızca o üyenin durumu ya da yaptığı işin türü değişince değişir. */}
          {uyeler.map(uye => {
            const kart = kartSvg(uye)

            return (
              <Box key={`kart:${uye.id}`}>
                <Svg source={kart.kaynak} alt={kart.alt} width={en} height={Math.round(en * kart.oran)} isInteractive />
              </Box>
            )
          })}
          {/* Anlık ayrıntı yazıyla akar: çizimler baştan yüklenmez. */}
          {calisanlar.length > 0 && (
            <Box key="akis" flexDirection="column">
              {calisanlar.map(uye => (
                <Text dimColor>
                  {uye.ad} › {uye.sonIs}
                </Text>
              ))}
            </Box>
          )}
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
            <Text key="sablon" dimColor>
              Şablon: {SABLON[sablon].ad} · Feride: {patron.model}
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
