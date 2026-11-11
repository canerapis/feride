import type { Durum, Etkinlik, Is, IsTuru, LimitOkuma, Sablon, Seviye, Uye } from '../types'
import {
  DURUM_ADI,
  SABLON,
  SEVIYE_ADI,
  TUR_ETKINLIGI,
  kacis,
  karma,
  kisalt,
  limitAdi,
  sar,
  sayi,
  sec,
  sinirla,
  temiz,
} from './ortak'

// ---------------------------------------------------------------------------
// Atışmalar ve olaylar: bu karede kim ne diyor, kim kime yürüyor
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

const TESLIM: readonly Ikili[] = [
  ['Rapor sende {b}. Uykum bende.', 'Bıraktın gidiyorsun. Revize kime kalıyor {a}?'],
  ['{b}, al şu dosyayı, ben görmedim say.', 'Gördüm {a}. Üçüncü sayfa boş.'],
  ['Teslim ettim {b}. Artık senin derdin.', 'Dert değil {a}, "fırsat". Feride Hanım öyle diyor.'],
  ['{b}, benim kısım bitti. Bol şans.', 'Şans mı? Brifte şans yazmıyordu {a}.'],
]

const TESLIM_PATRON = [
  'Feride Hanım, rapor masanızda. Nefes alabilir miyim?',
  'Buyurun rapor. İmzalı, kaşeli, gözyaşlı.',
  'Teslim. Mesaiye yazılır mı diye sormuyorum bile.',
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

const FERIDE_DENETIM = [
  '{a}, ekranına bakıyorum. Sen de bak, arada bir.',
  'Devam et {a}. Ben burada durup nefes alacağım, sen almayacaksın.',
  '{a}, bu hızla gidersek deadline bizi bekler mi sanıyorsun?',
  'Omzunun üstünden bakıyorum {a}. Buna "mentorluk" diyoruz.',
]

export const FERIDE_BOS = 'Buyurun müşterimiz, brief bekliyoruz. Ekibim hazır; ben zaten 3 gündür buradayım. Bir iş verin lütfen.'
export const FERIDE_KAPALI = 'Mod kapalı. Ofisten çıkmadım, çünkü çıkacak bir evim yok. Geri çağırmak için /feride aç yazın.'
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

const FERIDE_BRIF = 'Brifler dağıtıldı. Soru sormayın, brifte yazıyor. Yazmıyorsa da sormayın.'

/**
 * Sahnedeki bir olay: dokuz saniye sürer (gidiş, karşılaşma, dönüş).
 * - atisma: `a` kalkıp `b`nin yanına gider, laf atar; Feride kâğıt topu fırlatır.
 * - denetim: Feride masasından kalkıp `a`nın başına dikilir.
 * - teslim: işini bitiren `a` raporunu `b`ye (yoksa Feride'nin masasına) götürür.
 */
export type Olay = {
  tur: 'atisma' | 'denetim' | 'teslim'
  a: string
  b?: string
  aSoz?: string
  bSoz?: string
  /** Feride'nin bu olaydaki sözü: atışmada masasından azar, denetimde üyenin başında, teslimde masasında. */
  ferideSoz?: string
}

/** Bir olayın süresi (saniye) ve bir döngüdeki en çok olay sayısı. */
export const OLAY_SURESI = 9
const EN_COK_OLAY = 4

/**
 * İşin o anki durumuna göre sırayla oynayacak olaylar. Yalnızca işin kimliğinden ve
 * üyelerin durumundan türer: durum değişmedikçe aynı kalır, sahne de yeniden çizilmez.
 */
export function senaryo(is: Is): Olay[] {
  if (is.durum !== 'suruyor') return []

  const uyeler = is.uyeler
  const calisan = uyeler.filter(u => u.durum === 'calisiyor')
  const bitenler = uyeler.filter(u => u.durum === 'bitti')

  if (calisan.length === 0) return []

  const h = karma(`${is.id}:${is.asama}:${uyeler.map(u => u.durum).join(',')}`)
  const olaylar: Olay[] = []
  const doldur = (soz: string, kim: string, kime: string | undefined): string =>
    soz.replace(/\{a\}/g, kim).replace(/\{b\}/g, kime ?? 'Feride Hanım')
  const digeri = (u: Uye, tohum: number): Uye | undefined => {
    const calisanDiger = calisan.filter(o => o.id !== u.id)

    return sec(calisanDiger.length > 0 ? calisanDiger : bitenler.filter(o => o.id !== u.id), tohum)
  }
  const azar = (tohum: number, a: Uye, b: Uye | undefined): string => doldur(sec(FERIDE_AZAR, tohum) ?? '', a.ad, b?.ad)

  // 1. Feride'nin bu işe özel yazdığı atışmalardan ikisi.
  for (let i = 0; i < Math.min(2, is.atismalar.length); i += 1) {
    const ham = is.atismalar[(h + i) % is.atismalar.length] ?? ''
    const parca = /^\s*([^:]{1,24}):\s*(.+)$/.exec(ham)
    const kim = parca?.[1]?.trim().toLowerCase() ?? ''
    const soz = parca?.[2] ?? ham
    const adli = uyeler.find(u => u.ad.toLowerCase() === kim && (u.durum === 'calisiyor' || u.durum === 'bitti'))
    const a = adli ?? sec(calisan, h >>> (3 + i))

    if (a === undefined) continue

    const b = digeri(a, h >>> (5 + i))
    const cevap = doldur(sec(CEVAP, h >>> (7 + i)) ?? '', a.ad, b?.ad)

    if (kim.startsWith('feride')) olaylar.push({ tur: 'denetim', a: a.id, ferideSoz: soz, aSoz: cevap })
    else if (b === undefined) olaylar.push({ tur: 'denetim', a: a.id, aSoz: soz, ferideSoz: azar(h >>> 9, a, b) })
    else olaylar.push({ tur: 'atisma', a: a.id, b: b.id, aSoz: soz, bSoz: cevap, ferideSoz: azar(h >>> (9 + i), a, b) })
  }

  // 2. Rapor teslimi: işini bitiren biri raporunu hâlâ çalışan birine ya da patrona götürür.
  const teslimEden = sec(bitenler, h >>> 13)

  if (teslimEden !== undefined) {
    const alan = sec(
      calisan.filter(u => u.id !== teslimEden.id),
      h >>> 7,
    )
    const ikili = sec(TESLIM, h >>> 6) ?? ['', '']

    olaylar.push(
      alan === undefined || (h >>> 4) % 3 === 0
        ? { tur: 'teslim', a: teslimEden.id, aSoz: sec(TESLIM_PATRON, h >>> 6) ?? '', ferideSoz: 'Masama bırak. Teşekkür beklemiyorsun, değil mi?' }
        : {
            tur: 'teslim',
            a: teslimEden.id,
            b: alan.id,
            aSoz: doldur(ikili[0], teslimEden.ad, alan.ad),
            bSoz: doldur(ikili[1], teslimEden.ad, alan.ad),
            ferideSoz: 'Rapor el değiştirdi. Alkış yok, devam.',
          },
    )
  }

  // 3. Denetim: Feride birinin başına dikilir.
  const denetlenen = sec(calisan, h >>> 11)

  if (denetlenen !== undefined && !olaylar.some(o => o.tur === 'denetim')) {
    olaylar.push({ tur: 'denetim', a: denetlenen.id, ferideSoz: doldur(sec(FERIDE_DENETIM, h >>> 6) ?? '', denetlenen.ad, undefined) })
  }

  // 4. Hazır atışmalardan biri.
  const a = sec(calisan, h >>> 2)
  const b = a === undefined ? undefined : digeri(a, h >>> 4)

  if (a !== undefined && b !== undefined && !olaylar.some(o => o.tur === 'atisma')) {
    const havuz = a.seviye === 'usta' && b.seviye === 'cirak' ? USTA_CIRAK : a.seviye === 'cirak' && b.seviye === 'usta' ? CIRAK_USTA : GENEL
    const ikili = sec(havuz, h >>> 6) ?? ['', '']

    olaylar.push({ tur: 'atisma', a: a.id, b: b.id, aSoz: doldur(ikili[0], a.ad, b.ad), bSoz: doldur(ikili[1], a.ad, b.ad), ferideSoz: azar(h >>> 9, a, b) })
  }

  return olaylar.slice(0, EN_COK_OLAY)
}

export type Sahne = { sozler: Map<string, string>; feride: string }

/** Terminal için: bu karede kim ne diyor. Kare sayacı olaylar arasında sırayla dolaşır. */
export function sahne(is: Is): Sahne {
  const sozler = new Map<string, string>()
  const uyeler = is.uyeler

  if (is.durum === 'tamam') {
    const h = karma(is.id)
    const lafli = uyeler.filter(u => u.laf !== undefined)
    const konusan = sec(lafli.length > 0 ? lafli : uyeler, h)

    if (konusan !== undefined) sozler.set(konusan.id, konusan.laf ?? sec(KUTLAMA, h >>> 4) ?? '')

    return { sozler, feride: sec(FERIDE_BITTI, h) ?? '' }
  }

  const calisan = uyeler.filter(u => u.durum === 'calisiyor').length
  const biten = uyeler.filter(u => u.durum === 'bitti').length
  const durumSozu = `Aşama ${is.asama}/${is.asamaSayisi}: ${calisan} kişi çalışıyor, ${biten} rapor masamda.`

  if (is.tik === 0) return { sozler, feride: FERIDE_BRIF }

  const olaylar = senaryo(is)
  const olay = olaylar[(is.tik - 1) % Math.max(1, olaylar.length)]

  if (olay === undefined) return { sozler, feride: durumSozu }
  if (olay.aSoz !== undefined && olay.aSoz !== '') sozler.set(olay.a, olay.aSoz)
  if (olay.b !== undefined && olay.bSoz !== undefined && olay.bSoz !== '') sozler.set(olay.b, olay.bSoz)

  return { sozler, feride: olay.ferideSoz ?? durumSozu }
}

// ---------------------------------------------------------------------------
// Çizim parçaları
// ---------------------------------------------------------------------------

const TURUNCU = '#D97757'
const KOYU = '#2B2B2B'
const DONGU = 'repeatCount="indefinite"'
const YAZI_TIPI = `font-family="'Segoe UI', system-ui, -apple-system, sans-serif"`
const ROZET: Record<Seviye, { zemin: string; yazi: string }> = {
  ustat: { zemin: '#7B4FD6', yazi: '#FFFFFF' },
  usta: { zemin: '#F2B705', yazi: '#3B2F2F' },
  kalfa: { zemin: '#5B8DEF', yazi: '#FFFFFF' },
  cirak: { zemin: '#58B368', yazi: '#FFFFFF' },
}
const DURUM_RENGI: Record<Durum, string> = { calisiyor: TURUNCU, bekliyor: '#8A7A6C', bitti: '#3FA34D', hata: '#D64545' }

export const yuvarla = (n: number): string => String(Math.round(n * 10) / 10)

type Poz = {
  goz?: 'acik' | 'kirp' | 'kapali' | 'mutlu' | 'carpi' | 'tarama' | 'iri'
  kol?: 'yan' | 'tus' | 'hizli' | 'hava' | 'salla' | 'on'
  salin?: 'calis' | 'nefes' | 'zipla' | 'patron' | 'titre' | 'yok'
  /** Yürürken bacaklar sırayla kalkar. */
  yuru?: boolean
  soluk?: boolean
  egik?: number
  opak?: number
}

/**
 * Clawd: 16 x 10,5 birimlik bloklu maskot; `s` bir birimin piksel karşılığı.
 * `ek` gövdeyle birlikte sallanan parçaları taşır (şapka, gözlük, elindeki eşya).
 */
function clawd(x: number, y: number, s: number, poz: Poz, ek = ''): string {
  const u = (v: number): string => yuvarla(v * s)
  const govde = poz.soluk === true ? '#BFA89E' : TURUNCU
  const p: string[] = [
    `<g transform="translate(${yuvarla(x)} ${yuvarla(y)})"><g${poz.opak === undefined ? '' : ` opacity="${poz.opak}"`}>`,
  ]
  const salin = poz.salin ?? 'yok'
  const zipla = (degerler: string, sure: string, anahtar = ''): string =>
    `<animateTransform attributeName="transform" type="translate" values="${degerler}"${anahtar} dur="${sure}" ${DONGU}/>`

  if (salin === 'calis') p.push(zipla(`0 0;0 ${u(-0.35)};0 0`, '0.5s'))
  else if (salin === 'zipla') p.push(zipla(`0 0;0 ${u(-1.5)};0 0;0 0`, '1s', ' keyTimes="0;0.25;0.5;1"'))
  else if (salin === 'patron') p.push(zipla(`0 0;0 ${u(-0.2)};0 0`, '1.5s'))
  else if (salin === 'nefes') p.push(zipla(`0 0;0 ${u(0.35)};0 0`, '3s'))
  else if (salin === 'titre') p.push(zipla(`0 0;${u(0.25)} 0;${u(-0.25)} 0;0 0`, '0.25s'))

  if (poz.egik !== undefined) p.push(`<g transform="rotate(${poz.egik} ${u(8)} ${u(8)})">`)

  for (const [i, bx] of [3, 5.5, 9, 11.5].entries()) {
    const adim =
      poz.yuru !== true
        ? ''
        : `<animate attributeName="height" values="${u(3)};${u(1.6)};${u(3)}" dur="0.4s" begin="-${yuvarla((i % 2) * 0.2)}s" ${DONGU}/>`

    p.push(`<rect x="${u(bx)}" y="${u(7.5)}" width="${u(1.5)}" height="${u(3)}" fill="${govde}">${adim}</rect>`)
  }

  p.push(`<rect x="${u(2)}" y="0" width="${u(12)}" height="${u(8)}" rx="${u(0.5)}" fill="${govde}"/>`)

  const kol = poz.kol ?? 'yan'
  const kolY = kol === 'hava' ? 0.6 : kol === 'on' ? 4.4 : 3

  for (const [i, kx] of [0, 14].entries()) {
    let oyna = ''

    if (kol === 'tus' || kol === 'hizli') {
      oyna = `<animate attributeName="y" values="${i === 0 ? `${u(3)};${u(2)};${u(3)}` : `${u(2)};${u(3)};${u(2)}`}" dur="${kol === 'hizli' ? '0.25s' : '0.5s'}" ${DONGU}/>`
    } else if (kol === 'salla' && i === 1) {
      oyna = `<animate attributeName="y" values="${u(3)};${u(1.2)};${u(3)}" dur="1s" ${DONGU}/>`
    } else if (kol === 'hava') {
      oyna = `<animate attributeName="y" values="${u(0.6)};${u(-0.2)};${u(0.6)}" dur="0.5s" begin="-${yuvarla(i * 0.25)}s" ${DONGU}/>`
    }

    p.push(`<rect x="${u(kx)}" y="${u(kolY)}" width="${u(2)}" height="${u(2)}" fill="${govde}">${oyna}</rect>`)
  }

  const goz = poz.goz ?? 'acik'
  const kirp =
    `<animate attributeName="height" values="${u(2)};${u(2)};${u(0.3)};${u(2)};${u(2)}" keyTimes="0;0.86;0.9;0.94;1" dur="3s" ${DONGU}/>` +
    `<animate attributeName="y" values="${u(2)};${u(2)};${u(2.85)};${u(2)};${u(2)}" keyTimes="0;0.86;0.9;0.94;1" dur="3s" ${DONGU}/>`

  for (const gx of [4.5, 10.5]) {
    if (goz === 'acik' || goz === 'kirp') {
      p.push(`<rect x="${u(gx)}" y="${u(2)}" width="${u(1)}" height="${u(2)}" fill="${KOYU}">${goz === 'kirp' ? kirp : ''}</rect>`)
    } else if (goz === 'tarama') {
      p.push(
        `<rect x="${u(gx)}" y="${u(2.4)}" width="${u(1)}" height="${u(1.6)}" fill="${KOYU}">` +
          `<animate attributeName="x" values="${u(gx - 0.7)};${u(gx + 0.7)};${u(gx - 0.7)}" dur="1.5s" ${DONGU}/></rect>`,
      )
    } else if (goz === 'iri') {
      p.push(
        `<rect x="${u(gx - 0.35)}" y="${u(1.4)}" width="${u(1.7)}" height="${u(2.8)}" rx="${u(0.4)}" fill="#FFFFFF" stroke="${KOYU}" stroke-width="${u(0.2)}"/>` +
          `<rect x="${u(gx + 0.15)}" y="${u(2.3)}" width="${u(0.8)}" height="${u(1.2)}" fill="${KOYU}"/>`,
      )
    } else if (goz === 'mutlu') {
      p.push(
        `<path d="M${u(gx - 0.5)} ${u(3.6)} L${u(gx + 0.5)} ${u(2.3)} L${u(gx + 1.5)} ${u(3.6)}" fill="none" stroke="${KOYU}" stroke-width="${u(0.5)}" stroke-linecap="round" stroke-linejoin="round"/>`,
      )
    } else if (goz === 'carpi') {
      p.push(
        `<path d="M${u(gx - 0.3)} ${u(2.2)} L${u(gx + 1.3)} ${u(3.8)} M${u(gx + 1.3)} ${u(2.2)} L${u(gx - 0.3)} ${u(3.8)}" stroke="${KOYU}" stroke-width="${u(0.45)}" stroke-linecap="round"/>`,
      )
    } else {
      p.push(`<rect x="${u(gx - 0.3)}" y="${u(2.9)}" width="${u(1.6)}" height="${u(0.4)}" fill="${KOYU}"/>`)
    }
  }

  p.push(ek)
  if (poz.egik !== undefined) p.push('</g>')
  p.push('</g></g>')

  return p.join('')
}

function sapka(seviye: Seviye, s: number): string {
  const u = (v: number): string => yuvarla(v * s)

  if (seviye === 'ustat') {
    // Taç: en üst modelin alameti.
    return (
      `<path d="M${u(4)} ${u(0.3)} L${u(4)} ${u(-3)} L${u(6)} ${u(-1.2)} L${u(8)} ${u(-3.8)} L${u(10)} ${u(-1.2)} L${u(12)} ${u(-3)} L${u(12)} ${u(0.3)} Z" fill="#F2B705" stroke="#B8860B" stroke-width="${u(0.2)}"/>` +
      `<circle cx="${u(8)}" cy="${u(-1)}" r="${u(0.55)}" fill="#7B4FD6"><animate attributeName="opacity" values="1;0.4;1" dur="1.5s" ${DONGU}/></circle>`
    )
  }

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
    `<animate attributeName="rx" values="${u(2.4)};${u(0.3)};${u(2.4)}" dur="0.5s" ${DONGU}/></ellipse>`
  )
}

/** Feride'nin ekleri: topuz, gözlük, ruj, inci kolye; elinde `esya`. */
function ferideSusu(s: number, esya: 'pano' | 'kase' | 'megafon' | 'yok'): string {
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

  if (esya === 'pano' || esya === 'megafon') {
    p.push(
      `<rect x="${u(-3.4)}" y="${u(1.2)}" width="${u(4)}" height="${u(5.2)}" rx="${u(0.3)}" fill="#F5E6C8" stroke="#8B5A3C" stroke-width="${u(0.3)}"/>`,
      `<rect x="${u(-2.4)}" y="${u(0.7)}" width="${u(2)}" height="${u(0.9)}" rx="${u(0.3)}" fill="#8B5A3C"/>`,
    )

    for (let i = 0; i < 3; i += 1) {
      p.push(`<path d="M${u(-2.8)} ${u(2.7 + i * 1.1)} L${u(-0.2)} ${u(2.7 + i * 1.1)}" stroke="#8B5A3C" stroke-width="${u(0.22)}"/>`)
    }
  }

  if (esya === 'megafon') {
    // Brief dağıtırken megafon: ses dalgaları sağa yayılır.
    p.push(`<path d="M${u(15.6)} ${u(2.6)} L${u(19)} ${u(0.8)} L${u(19)} ${u(5.4)} L${u(15.6)} ${u(4)} Z" fill="#E4572E" stroke="${KOYU}" stroke-width="${u(0.2)}"/>`)

    for (let i = 0; i < 3; i += 1) {
      p.push(
        `<path d="M${u(20 + i * 1.3)} ${u(1.4 - i * 0.5)} Q${u(21.2 + i * 1.3)} ${u(3.1)} ${u(20 + i * 1.3)} ${u(4.8 + i * 0.5)}" fill="none" stroke="#E4572E" stroke-width="${u(0.3)}" stroke-linecap="round">` +
          `<animate attributeName="opacity" values="0;1;0" dur="0.75s" begin="-${yuvarla(i * 0.25)}s" ${DONGU}/></path>`,
      )
    }
  }

  if (esya === 'kase') {
    // Kaşe: sağ kolla birlikte iner kalkar.
    p.push(
      `<g><animateTransform attributeName="transform" type="translate" values="0 0;0 ${u(-1.8)};0 0" dur="1s" ${DONGU}/>` +
        `<rect x="${u(14.4)}" y="${u(5)}" width="${u(1.2)}" height="${u(1.6)}" fill="#8B5A3C"/>` +
        `<rect x="${u(13.6)}" y="${u(6.6)}" width="${u(2.8)}" height="${u(1.1)}" rx="${u(0.2)}" fill="#C2185B"/></g>`,
    )
  }

  return p.join('')
}

/**
 * Konuşma balonu: alt ucu (cx, alt) noktasına iner.
 * `en` çizimin genişliği: balon kenardan taşmaz.
 */
function balon(cx: number, alt: number, satirlar: readonly string[], en: number, yon: -1 | 0 | 1 = 0): string {
  const boy = 10.5
  const genis = Math.max(46, Math.max(...satirlar.map(s => s.length)) * boy * 0.56 + 18)
  const yukseklik = satirlar.length * 13 + 9
  // `yon` balonu ucundan sola ya da sağa yaslar: yan yana iki konuşanın balonları üst üste binmez.
  const ham = yon === 0 ? cx - genis / 2 : yon < 0 ? cx - genis + 16 : cx - 16
  const sol = sinirla(ham, 6, en - 6 - genis) - cx
  const yazilar = satirlar
    .map(
      (satir, i) =>
        `<text x="${yuvarla(sol + genis / 2)}" y="${yuvarla(-yukseklik + 15 + i * 13)}" font-size="${boy}" text-anchor="middle" fill="${KOYU}">${kacis(satir)}</text>`,
    )
    .join('')

  return (
    `<g transform="translate(${yuvarla(cx)} ${yuvarla(alt)})"><g>` +
    `<rect x="${yuvarla(sol)}" y="${-yukseklik}" width="${yuvarla(genis)}" height="${yukseklik}" rx="9" fill="#FFFFFF" stroke="${KOYU}" stroke-width="1.3"/>` +
    '<path d="M-5 -0.6 L0 7 L5 -0.6" fill="#FFFFFF" stroke="#FFFFFF" stroke-width="1.6"/>' +
    `<path d="M-5 0 L0 7 L5 0" fill="none" stroke="${KOYU}" stroke-width="1.3" stroke-linejoin="round"/>` +
    `${yazilar}</g></g>`
  )
}

const zzz = (x: number, y: number): string =>
  `<g transform="translate(${yuvarla(x)} ${yuvarla(y)})">` +
  [0, 1, 2]
    .map(
      i =>
        `<text x="${i * 6}" y="${-i * 7}" font-size="${9 + i * 2}" font-weight="700" fill="#8A7A6C">z` +
        `<animate attributeName="opacity" values="0;1;0" dur="3s" begin="-${i}s" ${DONGU}/></text>`,
    )
    .join('') +
  '</g>'

const duman = (x: number, y: number): string =>
  [0, 1, 2]
    .map(
      i =>
        `<circle cx="${yuvarla(x + i * 5)}" cy="${yuvarla(y)}" r="${4 + i}" fill="#9A9A9A">` +
        `<animate attributeName="cy" values="${yuvarla(y)};${yuvarla(y - 26)}" dur="1.5s" begin="-${yuvarla(i * 0.5)}s" ${DONGU}/>` +
        `<animate attributeName="opacity" values="0.75;0" dur="1.5s" begin="-${yuvarla(i * 0.5)}s" ${DONGU}/></circle>`,
    )
    .join('')

const konfeti = (x: number, y: number, genislik: number, adet: number): string =>
  Array.from({ length: adet }, (_, i) => {
    const renk = ['#F2B705', '#5B8DEF', '#58B368', '#E4572E', '#B56BD6'][i % 5] ?? '#F2B705'

    return (
      `<rect x="${yuvarla(x + (genislik * i) / Math.max(1, adet - 1))}" y="${yuvarla(y)}" width="3.5" height="6" fill="${renk}">` +
      `<animateTransform attributeName="transform" type="translate" values="0 -8;0 44" dur="1.5s" begin="-${yuvarla((i * 0.37) % 1.5)}s" ${DONGU}/>` +
      `<animate attributeName="opacity" values="1;1;0" dur="1.5s" begin="-${yuvarla((i * 0.37) % 1.5)}s" ${DONGU}/></rect>`
    )
  }).join('')

const ter = (x: number, y: number): string =>
  [0, 1]
    .map(
      i =>
        `<path d="M${yuvarla(x + i * 9)} ${yuvarla(y)} q-3 5 0 7 q3 -2 0 -7 Z" fill="#6EC5FF">` +
        `<animateTransform attributeName="transform" type="translate" values="0 0;${i === 0 ? -6 : 6} 12" dur="0.75s" begin="-${yuvarla(i * 0.37)}s" ${DONGU}/>` +
        `<animate attributeName="opacity" values="1;0" dur="0.75s" begin="-${yuvarla(i * 0.37)}s" ${DONGU}/></path>`,
    )
    .join('')

const dosya = (x: number, y: number): string =>
  `<rect x="${yuvarla(x)}" y="${yuvarla(y)}" width="20" height="15" rx="2" fill="#F2D398" stroke="#8B5A3C" stroke-width="1.1"/>` +
  `<rect x="${yuvarla(x)}" y="${yuvarla(y - 3)}" width="9" height="4" rx="1.2" fill="#F2D398" stroke="#8B5A3C" stroke-width="1.1"/>`

// ---------------------------------------------------------------------------
// Sahne: bir ajans binası. Çatıda limit panosu, en üst katta yönetim (Feride),
// altında departman katları; başka kattaki birinin yanına asansörle gidilir.
//
// Sahne kendi içinde dönen tek bir canlandırmadır: olaylar SVG'nin içinde sırayla
// oynar. Kaynağı yalnızca işin durumu değişince değişir; saat ilerledi diye
// yeniden çizilmez, böylece panoda yanıp sönme olmaz.
// ---------------------------------------------------------------------------

const G = 720
/** Asansör boşluğunun sol kenarı: katlardaki masalar bunun soluna dizilir. */
const BOSLUK_X = 616
/** Kabinin ortası: asansöre binen buraya yürür. */
const KABIN_X = 661
/** Çatının boyu: üstünde limit panosu durur, bina bunun altında başlar. */
const CATI = 92
const YONETIM_ZEMINI = CATI + 168
const SERIT_Y = YONETIM_ZEMINI + 10
/** İlk departman katının tavanı ve bir katın boyu. */
const KAT_USTU = SERIT_Y + 36
const KAT_BOYU = 150
const PATRON_X = 60
const PATRON_Y = CATI + 54
/** Feride'nin masası 62 birimlik bir Feride'ye göre çizilmiştir: bu kadar aşağı kayar. */
const MASA_KAYMASI = PATRON_Y - 62

/** Üyenin işinin türü hangi departmanda (hangi katta) oturduğunu belirler. */
const DEPARTMAN: Record<IsTuru, string> = {
  kod: 'YAZILIM',
  metin: 'METİN YAZARLIĞI',
  arastirma: 'ARAŞTIRMA',
  inceleme: 'KALİTE KONTROL',
  genel: 'GENEL İŞLER',
}

export type Cizim = { kaynak: string; alt: string; oran: number }

/** Çatıdaki tabela: limitler, şablon ve Feride'nin modeli. */
function catiPanosu(limitler: readonly LimitOkuma[], is: Is | null, sablon: Sablon, patron: string): string {
  const p: string[] = [
    `<rect x="84" y="70" width="8" height="${CATI - 72}" fill="#6B5B4D"/>`,
    `<rect x="528" y="70" width="8" height="${CATI - 72}" fill="#6B5B4D"/>`,
    '<rect x="24" y="8" width="576" height="68" rx="8" fill="#2F3E46" stroke="#8B5A3C" stroke-width="4"/>',
    '<text x="44" y="38" font-size="17" font-weight="800" letter-spacing="2.5" fill="#F4F1DE">LİMİT</text>',
    '<text x="44" y="60" font-size="17" font-weight="800" letter-spacing="2.5" fill="#F2D398">PANOSU</text>',
  ]

  // Tabelanın üst kenarında sırayla yanan ampuller.
  for (let i = 0; i < 14; i += 1) {
    p.push(
      `<circle cx="${40 + i * 42}" cy="8" r="3" fill="#FFE27A"><animate attributeName="opacity" values="1;0.25;1" dur="1.5s" begin="-${yuvarla((i % 3) * 0.5)}s" ${DONGU}/></circle>`,
    )
  }

  const gosterilen = limitler.slice(0, 3)
  const ilk = gosterilen.length === 1 ? 37 : gosterilen.length === 2 ? 27 : 18

  if (gosterilen.length === 0) p.push('<text x="270" y="47" font-size="13" text-anchor="middle" fill="#CFE8D5">Limit bilgisi yok</text>')

  for (const [i, limit] of gosterilen.entries()) {
    const y = ilk + i * 19
    const renk = limit.yuzde < 60 ? '#58B368' : limit.yuzde < 85 ? '#F2B705' : '#E4572E'

    p.push(
      `<text x="150" y="${y + 10}" font-size="12" fill="#F4F1DE">${kacis(kisalt(limitAdi(limit.tur), 9))}</text>`,
      `<rect x="208" y="${y}" width="150" height="11" rx="5.5" fill="#1B262B"/>`,
      `<rect x="208" y="${y}" width="${yuvarla((150 * limit.yuzde) / 100)}" height="11" rx="5.5" fill="${renk}"/>`,
      `<text x="402" y="${y + 10}" font-size="12" font-weight="700" text-anchor="end" fill="#F4F1DE">%${limit.yuzde}</text>`,
    )
  }

  p.push(
    '<rect x="416" y="16" width="1.5" height="52" fill="#4D6068"/>',
    `<text x="430" y="30" font-size="11.5" fill="#CFE8D5">Şablon: <tspan font-weight="700" fill="#F2D398">${SABLON[sablon].ad}</tspan></text>`,
    `<text x="430" y="47" font-size="11.5" fill="#CFE8D5">Feride: <tspan font-weight="700" fill="#F2D398">${kacis(kisalt(patron, 16))}</tspan></text>`,
    `<text x="430" y="64" font-size="11.5" fill="#CFE8D5">${is === null ? 'Ekip iş bekliyor' : `İşin payı ≈ %${sayi(is.tahmin)}`}</text>`,
  )

  return p.join('')
}

/** Bir üyenin sahnedeki küçük masası: gövdenin önünde durur, bacakları örter. */
function sahneMasasi(cx: number, zemin: number, s: number, isik: boolean): string {
  const en = 16 * s + 10

  return (
    `<rect x="${yuvarla(cx - 2.6 * s)}" y="${yuvarla(zemin - 22 - 2.9 * s)}" width="${yuvarla(5.2 * s)}" height="${yuvarla(2.9 * s)}" rx="2" fill="#4A4A4A"/>` +
    `<circle cx="${cx}" cy="${yuvarla(zemin - 22 - 1.45 * s)}" r="${yuvarla(0.5 * s)}" fill="${TURUNCU}">` +
    (isik ? `<animate attributeName="opacity" values="0.3;1;0.3" dur="1s" ${DONGU}/>` : '') +
    '</circle>' +
    `<rect x="${yuvarla(cx - en / 2)}" y="${zemin - 22}" width="${yuvarla(en)}" height="7" rx="2" fill="#B07B4F"/>` +
    `<rect x="${yuvarla(cx - en / 2 + 4)}" y="${zemin - 15}" width="${yuvarla(en - 8)}" height="15" fill="#C9925F"/>`
  )
}

function uyeEtiketi(uye: Uye, cx: number, zemin: number): string {
  const rozet = ROZET[uye.seviye]
  const inmis = uye.seviye !== uye.istenen
  const yazi = `${inmis ? '↓ ' : ''}${SEVIYE_ADI[uye.seviye]} · ${kisalt(uye.model, 8)}`
  const en = yazi.length * 5.2 + 14

  return (
    `<text x="${cx}" y="${zemin + 14}" font-size="11" font-weight="700" text-anchor="middle" fill="#3B2F2F">${kacis(uye.ad)}</text>` +
    `<rect x="${yuvarla(cx - en / 2)}" y="${zemin + 18}" width="${yuvarla(en)}" height="13" rx="6.5" fill="${rozet.zemin}"/>` +
    `<text x="${cx}" y="${zemin + 28}" font-size="9" font-weight="700" text-anchor="middle" fill="${rozet.yazi}">${kacis(yazi)}</text>`
  )
}

type Yer = { cx: number; zemin: number; s: number; hucre: number }

/** Üyeleri departmanlarına göre katlara dizer: her iş türü bir kat, katlar ilk görülme sırasıyla yukarıdan aşağı. */
function yerlestir(uyeler: readonly Uye[]): { yerler: Yer[]; katlar: { tur: IsTuru; zemin: number }[] } {
  const turu = (u: Uye): IsTuru => u.isTuru ?? 'genel'
  const turler: IsTuru[] = []

  for (const u of uyeler) if (!turler.includes(turu(u))) turler.push(turu(u))
  if (turler.length === 0) turler.push('genel')

  const katlar = turler.map((tur, k) => ({ tur, zemin: KAT_USTU + k * KAT_BOYU + 116 }))
  const yerler = uyeler.map((u): Yer => {
    const kat = turler.indexOf(turu(u))
    const ayniKat = uyeler.filter(o => turu(o) === turu(u))
    const hucre = (BOSLUK_X - 28) / ayniKat.length

    return {
      cx: Math.round(14 + hucre * (ayniKat.indexOf(u) + 0.5)),
      zemin: katlar[kat]?.zemin ?? KAT_USTU + 116,
      s: sinirla(Math.floor(((hucre - 18) / 16) * 2) / 2, 3.5, 5),
      hucre,
    }
  })

  return { yerler, katlar }
}

// --- Döngü: olaylar tek bir SMIL zaman çizgisinde sırayla oynar ---------------

type Nokta = { t: number; x: number; y: number }
type Pencere = readonly [number, number]

const oran = (n: number): string => String(Math.round(sinirla(n, 0, 1) * 10000) / 10000)

/** Döngünün `pencereler` aralıklarında görünür (ya da `tersi` ise gizli) kılan canlandırma. */
function gorunurluk(pencereler: readonly Pencere[], T: number, tersi = false): string {
  const acik = tersi ? '0' : '1'
  const kapali = tersi ? '1' : '0'
  const zamanlar: number[] = [0]
  const degerler: string[] = [kapali]
  const ekle = (zaman: number, deger: string): void => {
    if (Math.abs((zamanlar.at(-1) ?? -1) - zaman) < 1e-6) degerler[degerler.length - 1] = deger
    else {
      zamanlar.push(zaman)
      degerler.push(deger)
    }
  }

  for (const [bas, son] of [...pencereler].sort((a, b) => a[0] - b[0])) {
    ekle(sinirla(bas, 0, T), acik)
    if (son < T - 1e-6) ekle(son, kapali)
  }

  return `<animate attributeName="opacity" calcMode="discrete" values="${degerler.join(';')}" keyTimes="${zamanlar.map(z => oran(z / T)).join(';')}" dur="${T}s" ${DONGU}/>`
}

/** Döngü boyunca noktadan noktaya taşıyan dönüşüm; ilk nokta 0, son nokta T anındadır. */
function iz(noktalar: readonly Nokta[], T: number, ek = ''): string {
  const sade: Nokta[] = []

  for (const n of noktalar) {
    if (Math.abs((sade.at(-1)?.t ?? -1) - n.t) < 1e-6) sade[sade.length - 1] = n
    else sade.push(n)
  }

  return (
    `<animateTransform${ek} attributeName="transform" type="translate" values="${sade.map(n => `${yuvarla(n.x)} ${yuvarla(n.y)}`).join(';')}" ` +
    `keyTimes="${sade.map(n => oran(n.t / T)).join(';')}" dur="${T}s" ${DONGU}/>`
  )
}

type Rota = {
  /** Yürüyenin evine göre yolu, döngünün tamamı için. */
  yol: Nokta[]
  /** Kabinin bu olaydaki durakları (asansöre binilmiyorsa boş). */
  kabin: { t: number; y: number }[]
  /** Hedefte durduğu yer, evine göre. */
  son: readonly [number, number]
  /** Evine döndüğü an. */
  bitis: number
}

/**
 * `t0` anında başlayan olayda yerinden kalkanın yolu. Aynı kattaysa yürür; başka kattaysa
 * asansöre yürür, kabinle iner ya da çıkar, hedefe yürür; 6,2. saniyede aynı yoldan döner.
 * `binis`, evinin zemini asansörün durduğu zeminden farklıysa (Feride masasının arkasında
 * durur) bindiği zemindir. Kabin boştayken yönetim katında bekler.
 */
function rota(ev: { x: number; zemin: number; binis?: number }, hedef: { x: number; zemin: number; ek: number }, t0: number, T: number): Rota {
  const binis = ev.binis ?? ev.zemin
  const dy = hedef.zemin - ev.zemin
  const son = [hedef.x - ev.x, dy + hedef.ek] as const
  const nokta = (t: number, p: readonly [number, number]): Nokta => ({ t, x: p[0], y: p[1] })
  const evde = [0, 0] as const

  if (Math.abs(hedef.zemin - binis) <= 1) {
    return {
      yol: [nokta(0, evde), nokta(t0, evde), nokta(t0 + 1.3, son), nokta(t0 + 6.2, son), nokta(t0 + 7.5, evde), nokta(T, evde)],
      kabin: [],
      son,
      bitis: t0 + 7.5,
    }
  }

  const kapida = [KABIN_X - ev.x, binis - ev.zemin] as const
  const inince = [KABIN_X - ev.x, dy] as const

  return {
    yol: [
      nokta(0, evde),
      nokta(t0, evde),
      nokta(t0 + 0.9, kapida),
      nokta(t0 + 1.7, inince),
      nokta(t0 + 2.6, son),
      nokta(t0 + 6.2, son),
      nokta(t0 + 7.1, inince),
      nokta(t0 + 7.9, kapida),
      nokta(t0 + 8.8, evde),
      nokta(T, evde),
    ],
    kabin: [
      { t: t0, y: YONETIM_ZEMINI },
      { t: t0 + 0.9, y: binis },
      { t: t0 + 1.7, y: hedef.zemin },
      { t: t0 + 7.1, y: hedef.zemin },
      { t: t0 + 7.9, y: binis },
      { t: t0 + 8.8, y: YONETIM_ZEMINI },
    ],
    son,
    bitis: t0 + 8.8,
  }
}

/** Döngünün bir aralığında görünen parça. */
const aralikta = (pencere: Pencere, T: number, icerik: string): string => `<g opacity="0">${gorunurluk([pencere], T)}${icerik}</g>`

/** Feride'nin masasının yanındaki konuşma balonu. */
function masaBalonu(metin: string): string {
  const satirlar = sar(metin, 50, 4)
  const boy = Math.max(44, satirlar.length * 16 + 18)

  return (
    `<rect x="240" y="${CATI + 14}" width="360" height="${boy}" rx="12" fill="#FFFFFF" stroke="${KOYU}" stroke-width="1.5"/>` +
    `<path d="M241 ${CATI + 30} L208 ${CATI + 54} L241 ${CATI + 46}" fill="#FFFFFF" stroke="#FFFFFF" stroke-width="2"/>` +
    `<path d="M240 ${CATI + 30} L208 ${CATI + 54} L240 ${CATI + 46}" fill="none" stroke="${KOYU}" stroke-width="1.5" stroke-linejoin="round"/>` +
    satirlar.map((satir, i) => `<text x="254" y="${CATI + 35 + i * 16}" font-size="12.5" fill="${KOYU}">${kacis(satir)}</text>`).join('')
  )
}

/**
 * Bina sahnesi. Olaylar (atışma, denetim, rapor teslimi) SVG'nin içinde sırayla ve
 * dönerek oynar: yerinden kalkan üyenin masasındaki hali gizlenir, yürüyen hali görünür;
 * başka kata asansörle gider.
 */
export function sahneSvg(is: Is | null, limitler: readonly LimitOkuma[], acik: boolean, sablon: Sablon, patron: string): Cizim {
  const uyeler = is?.uyeler ?? []
  const n = uyeler.length
  const suruyor = is?.durum === 'suruyor'
  const bitti = is?.durum === 'tamam'
  // İş yeni başladı: henüz kimse bir şey yapmadı, brifler dağıtılıyor.
  const yeniBasladi = suruyor && uyeler.every(u => u.durum !== 'bitti' && u.durum !== 'hata' && u.sonIs === undefined)
  const olaylar = is === null || yeniBasladi ? [] : senaryo(is)
  const T = Math.max(1, olaylar.length) * OLAY_SURESI
  const { yerler, katlar } = yerlestir(uyeler)
  const boy = KAT_USTU + katlar.length * KAT_BOYU + 34
  const sira = (id: string | undefined): number => uyeler.findIndex(u => u.id === id)
  const bitisSahnesi = is !== null && bitti ? sahne(is) : undefined
  const anaSoz =
    is === null
      ? acik
        ? FERIDE_BOS
        : FERIDE_KAPALI
      : bitisSahnesi !== undefined
        ? bitisSahnesi.feride
        : yeniBasladi
          ? FERIDE_BRIF
          : `Aşama ${is.asama}/${is.asamaSayisi}: ${uyeler.filter(u => u.durum === 'calisiyor').length} kişi çalışıyor, ${uyeler.filter(u => u.durum === 'bitti').length} rapor masamda.`

  const p: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${G} ${boy}" width="${G}" height="${boy}" ${YAZI_TIPI}>`,
    `<rect width="${G}" height="${boy}" rx="16" fill="#FFF4E6"/>`,
    // Gökyüzü ve çatı.
    `<rect width="${G}" height="${CATI + 16}" rx="16" fill="#DCEEFB"/>`,
    `<rect y="${CATI}" width="${G}" height="20" fill="#FFF4E6"/>`,
    '<g opacity="0.9"><ellipse cx="0" cy="26" rx="26" ry="9" fill="#FFFFFF"/><ellipse cx="18" cy="20" rx="18" ry="9" fill="#FFFFFF"/>' +
      `<animateTransform attributeName="transform" type="translate" values="620 0;700 0;620 0" dur="36s" ${DONGU}/></g>`,
    catiPanosu(limitler, is, sablon, patron),
    `<rect x="0" y="${CATI - 4}" width="${G}" height="7" fill="#8B5A3C"/>`,
    // Yönetim katı.
    `<rect x="0" y="${YONETIM_ZEMINI}" width="${BOSLUK_X}" height="4" fill="#E3CDB4"/>`,
    `<text x="16" y="${CATI + 18}" font-size="8.5" font-weight="800" letter-spacing="1" fill="#8A7A6C">${katlar.length + 1}. KAT · YÖNETİM</text>`,
  ]

  // Departman katları: döşeme, etiket şeridi ve kat tabelası.
  for (const [k, kat] of katlar.entries()) {
    const tabela = `${katlar.length - k}. KAT · ${DEPARTMAN[kat.tur]}`

    p.push(
      `<rect x="0" y="${kat.zemin - 2}" width="${BOSLUK_X}" height="36" fill="#F3E3CF"/>`,
      `<rect x="0" y="${kat.zemin - 2}" width="${BOSLUK_X}" height="3" fill="#E3CDB4"/>`,
      `<rect x="14" y="${kat.zemin - 108}" width="${yuvarla(tabela.length * 5.6 + 16)}" height="16" rx="3" fill="#3B2F2F"/>`,
      `<text x="22" y="${kat.zemin - 97}" font-size="8.5" font-weight="800" letter-spacing="0.8" fill="#F2D398">${kacis(tabela)}</text>`,
    )
  }

  // Asansör: çatıda makine dairesi, altında boşluk, raylar ve her katta eşik.
  const boslukEni = G - BOSLUK_X - 14

  p.push(
    `<rect x="${BOSLUK_X}" y="${CATI - 30}" width="${boslukEni}" height="30" rx="4" fill="#C9B8A6" stroke="#8B5A3C" stroke-width="2"/>`,
    `<text x="${KABIN_X}" y="${CATI - 11}" font-size="8" font-weight="800" letter-spacing="1.2" text-anchor="middle" fill="#3B2F2F">ASANSÖR</text>`,
    `<rect x="${BOSLUK_X}" y="${CATI + 3}" width="${boslukEni}" height="${boy - CATI - 21}" fill="#E9DCC9" stroke="#C9B8A6" stroke-width="2"/>`,
    `<path d="M${BOSLUK_X + 8} ${CATI + 6} L${BOSLUK_X + 8} ${boy - 22} M${G - 22} ${CATI + 6} L${G - 22} ${boy - 22}" stroke="#C9B8A6" stroke-width="2" stroke-dasharray="3 5"/>`,
    ...[YONETIM_ZEMINI, ...katlar.map(k => k.zemin)].map(z => `<rect x="${BOSLUK_X}" y="${z}" width="${boslukEni}" height="3" fill="#C9B8A6"/>`),
  )

  // --- Olayların zaman çizgisi ---
  const evdeGizli: Pencere[][] = uyeler.map(() => [])
  const patronGizli: Pencere[] = []
  const anaBalonGizli: Pencere[] = []
  const kabinDuraklari: { t: number; y: number }[] = []
  const onPlan: string[] = []
  const balonlar: string[] = []
  const masaUstu: string[] = []
  const ozelBalonlar: string[] = []

  for (const [j, olay] of olaylar.entries()) {
    const t0 = j * OLAY_SURESI
    const aSirasi = sira(olay.a)
    const aYeri = yerler[aSirasi]
    const aUye = uyeler[aSirasi]
    const bSirasi = sira(olay.b)
    const bYeri = yerler[bSirasi]

    if (aYeri === undefined || aUye === undefined) continue

    const aTepe = aYeri.zemin - 10.5 * aYeri.s
    const aBalonUcu = aTepe - 4.8 * aYeri.s - 2

    if (olay.tur === 'denetim') {
      // Feride masasından kalkar, asansörle iner, üyenin yanına (iki masanın arasına) gelir.
      const aralik = Math.min(aYeri.hucre / 2, 8 * aYeri.s + 62)
      const yan = aYeri.cx + aralik <= BOSLUK_X - 60 ? 1 : -1
      const yol = rota(
        { x: PATRON_X + 56, zemin: PATRON_Y + 73.5, binis: YONETIM_ZEMINI },
        { x: aYeri.cx + yan * aralik, zemin: aYeri.zemin, ek: 8 },
        t0,
        T,
      )

      kabinDuraklari.push(...yol.kabin)
      patronGizli.push([t0, yol.bitis])
      anaBalonGizli.push([t0, yol.bitis])
      onPlan.push(
        aralikta(
          [t0, yol.bitis],
          T,
          `<g>${iz(yol.yol, T)}${clawd(PATRON_X, PATRON_Y, 7, { goz: 'kirp', kol: 'salla', yuru: true }, ferideSusu(7, 'pano'))}</g>`,
        ),
      )
      masaUstu.push(aralikta([t0 + 2.6, t0 + 6.2], T, ter(aYeri.cx - 6, aTepe - 6)))

      if (olay.ferideSoz !== undefined && olay.ferideSoz !== '') {
        balonlar.push(
          aralikta(
            [t0 + 2.8, t0 + 6.2],
            T,
            balon(PATRON_X + 56 + yol.son[0], PATRON_Y + yol.son[1] - 32, sar(olay.ferideSoz, 26, 3), BOSLUK_X, yan === 1 ? 1 : -1),
          ),
        )
      }

      if (olay.aSoz !== undefined && olay.aSoz !== '') {
        balonlar.push(aralikta([t0 + 3.8, t0 + 6.2], T, balon(aYeri.cx, aBalonUcu, sar(olay.aSoz, 23, 3), BOSLUK_X, yan === 1 ? -1 : 1)))
      }

      continue
    }

    // Atışma ya da teslim: üye yerinden kalkar.
    const teslim = olay.tur === 'teslim'
    let yan: -1 | 1 = 1
    let hedef: { x: number; zemin: number; ek: number }

    if (bYeri === undefined) {
      // Rapor patrona: yönetim katına çıkar, Feride'nin masasının önüne gelir.
      hedef = { x: 290, zemin: YONETIM_ZEMINI, ek: 0 }
    } else {
      const aralik = Math.min(bYeri.hucre / 2, 8 * bYeri.s + 8 * aYeri.s + 14)
      // Aynı kattaysa geldiği taraftan, başka kattan geliyorsa asansör tarafından (sağdan) yaklaşır.
      const istenen = aYeri.zemin === bYeri.zemin && aYeri.cx < bYeri.cx ? -1 : 1

      yan = istenen === 1 && bYeri.cx + aralik > BOSLUK_X - 44 ? -1 : istenen
      hedef = { x: bYeri.cx + yan * aralik, zemin: bYeri.zemin, ek: 6 }
    }

    const yol = rota({ x: aYeri.cx, zemin: aYeri.zemin }, hedef, t0, T)
    const ax = aYeri.cx - 8 * aYeri.s

    kabinDuraklari.push(...yol.kabin)
    evdeGizli[aSirasi]?.push([t0, yol.bitis])
    onPlan.push(
      aralikta(
        [t0, yol.bitis],
        T,
        `<g>${iz(yol.yol, T)}` +
          clawd(ax, aTepe, aYeri.s, { goz: 'kirp', kol: teslim ? 'on' : 'yan', yuru: true }, sapka(aUye.seviye, aYeri.s)) +
          (teslim ? aralikta([t0, t0 + 2.6], T, dosya(ax + 16 * aYeri.s - 4, aTepe + 3.6 * aYeri.s)) : '') +
          '</g>',
      ),
    )

    if (olay.aSoz !== undefined && olay.aSoz !== '') {
      balonlar.push(
        aralikta(
          [t0 + 2.6, t0 + 6.2],
          T,
          balon(aYeri.cx + yol.son[0], aBalonUcu + yol.son[1], sar(olay.aSoz, 23, 3), BOSLUK_X, bYeri === undefined ? 0 : yan),
        ),
      )
    }

    if (bYeri !== undefined) {
      const bBalonUcu = bYeri.zemin - 15.3 * bYeri.s - 2

      if (olay.bSoz !== undefined && olay.bSoz !== '') {
        balonlar.push(aralikta([t0 + 3.6, t0 + 6.2], T, balon(bYeri.cx, bBalonUcu, sar(olay.bSoz, 23, 3), BOSLUK_X, yan === 1 ? -1 : 1)))
      }

      if (teslim) masaUstu.push(aralikta([t0 + 2.6, t0 + OLAY_SURESI], T, dosya(bYeri.cx + 3 * bYeri.s, bYeri.zemin - 37)))
    } else {
      masaUstu.push(aralikta([t0 + 2.6, t0 + OLAY_SURESI], T, dosya(240, 106 + MASA_KAYMASI)))
    }

    if (olay.ferideSoz !== undefined && olay.ferideSoz !== '') {
      const pencere: Pencere = [t0 + (teslim ? 3.4 : 5.2), t0 + 8.8]

      anaBalonGizli.push(pencere)
      ozelBalonlar.push(aralikta(pencere, T, masaBalonu(olay.ferideSoz)))
    }

    if (!teslim) {
      // Feride'den kâğıt topu: laf atanın kafasına iner, "PAT!".
      const bx = 176
      const by = 92 + MASA_KAYMASI
      const hx = aYeri.cx + yol.son[0]
      const hy = aYeri.zemin - 7.5 * aYeri.s + yol.son[1]

      onPlan.push(
        aralikta(
          [t0 + 5.4, t0 + 6.3],
          T,
          `<g>${iz(
            [
              { t: 0, x: bx, y: by },
              { t: t0 + 5.4, x: bx, y: by },
              { t: t0 + 5.85, x: (bx + hx) / 2, y: Math.min(by, hy) - 46 },
              { t: t0 + 6.3, x: hx, y: hy },
              { t: T, x: hx, y: hy },
            ],
            T,
          )}<circle r="7" fill="#FFFFFF" stroke="#8A7A6C" stroke-width="1.4"/><path d="M-3 -2 L2 1 M-1 3 L3 -3" stroke="#8A7A6C" stroke-width="1"/></g>`,
        ),
        aralikta(
          [t0 + 6.3, t0 + 7.1],
          T,
          `<text x="${yuvarla(hx)}" y="${yuvarla(hy - 14)}" font-size="15" font-weight="800" text-anchor="middle" fill="#D64545">PAT!</text>`,
        ),
      )
    }
  }

  // Kabin: boştayken yönetim katında bekler, yolcu varsa onunla iner çıkar. Halat boşluğa kırpılır.
  const kabinYolu =
    kabinDuraklari.length === 0
      ? ''
      : iz([{ t: 0, x: 0, y: YONETIM_ZEMINI }, ...kabinDuraklari.map(d => ({ t: d.t, x: 0, y: d.y })), { t: T, x: 0, y: YONETIM_ZEMINI }], T, ' id="kabin-yolu"')

  p.push(
    `<clipPath id="bosluk"><rect x="${BOSLUK_X}" y="${CATI + 4}" width="${boslukEni}" height="${boy - CATI - 24}"/></clipPath><g clip-path="url(#bosluk)">` +
      `<g transform="translate(0 ${YONETIM_ZEMINI})">${kabinYolu}` +
      `<path d="M${KABIN_X} -78 L${KABIN_X} -2000" stroke="#6B5B4D" stroke-width="2"/>` +
      `<rect x="${BOSLUK_X + 5}" y="-78" width="${boslukEni - 10}" height="78" rx="4" fill="#FFE9A8" stroke="#6B5B4D" stroke-width="2.5"/>` +
      `<rect x="${BOSLUK_X + 5}" y="-78" width="${boslukEni - 10}" height="9" rx="3" fill="#6B5B4D"/>` +
      `<circle cx="${KABIN_X}" cy="-73.5" r="2.4" fill="#58B368"><animate attributeName="opacity" values="1;0.3;1" dur="1.5s" ${DONGU}/></circle></g></g>`,
  )

  // Feride masasında: denetime çıktığı aralıklarda gizlenir, yürüyen hali öne çizilir.
  const esya = bitti ? 'kase' : yeniBasladi ? 'megafon' : 'pano'
  const patronPozu: Poz = { goz: 'kirp', salin: 'patron', kol: bitti || suruyor ? 'salla' : 'yan' }

  p.push(
    `<g>${patronGizli.length > 0 ? gorunurluk(patronGizli, T, true) : ''}${clawd(PATRON_X, PATRON_Y, 7, patronPozu, ferideSusu(7, esya))}</g>`,
    `<g transform="translate(0 ${MASA_KAYMASI})">` +
      '<rect x="36" y="122" width="200" height="12" rx="3" fill="#8B5A3C"/>' +
      '<rect x="44" y="134" width="184" height="42" fill="#A9714B"/>' +
      '<rect x="86" y="144" width="100" height="20" rx="3" fill="#F2D398" stroke="#8B5A3C"/>' +
      '<text x="136" y="158" font-size="10" font-weight="700" letter-spacing="0.8" text-anchor="middle" fill="#4A2C2A">PATRON FERİDE</text>' +
      '<rect x="196" y="106" width="15" height="16" rx="2" fill="#FFFFFF" stroke="#4A2C2A" stroke-width="1.2"/>' +
      '<path d="M211 110 Q218 114 211 118" fill="none" stroke="#4A2C2A" stroke-width="1.2"/>' +
      [0, 1]
        .map(
          i =>
            `<path d="M${200 + i * 6} 102 q3 -5 0 -9 q-3 -4 0 -8" fill="none" stroke="#B9A999" stroke-width="1.4" stroke-linecap="round">` +
            `<animate attributeName="opacity" values="0;0.9;0" dur="3s" begin="-${yuvarla(i * 1.5)}s" ${DONGU}/></path>`,
        )
        .join('') +
      (bitti
        ? '<rect x="160" y="113" width="30" height="9" fill="#FFFFFF" stroke="#8B5A3C"/>' +
          '<text x="175" y="120.5" font-size="6.5" font-weight="700" text-anchor="middle" fill="#C2185B">TESLİM</text>'
        : '') +
      '</g>',
    `<g>${anaBalonGizli.length > 0 ? gorunurluk(anaBalonGizli, T, true) : ''}${masaBalonu(anaSoz)}</g>`,
    ...ozelBalonlar,
  )

  // Şerit: iş ve aşamalar.
  p.push(`<rect x="14" y="${SERIT_Y}" width="${BOSLUK_X - 28}" height="24" rx="12" fill="${KOYU}"/>`)

  if (is === null) {
    p.push(`<text x="30" y="${SERIT_Y + 16}" font-size="11" fill="#FFFFFF">Yedek kulübesi: ekip iş bekliyor</text>`)
  } else {
    const etiket = is.durum === 'tamam' ? 'Bitti' : `Aşama ${is.asama}/${is.asamaSayisi}`
    const noktaSol = BOSLUK_X - 30 - (is.asamaSayisi - 1) * 16

    p.push(
      `<text x="30" y="${SERIT_Y + 16}" font-size="11" fill="#FFFFFF"><tspan font-weight="700">İŞ:</tspan> ${kacis(kisalt(is.ozet, 50))}</text>`,
      `<text x="${noktaSol - 14}" y="${SERIT_Y + 16}" font-size="10.5" font-weight="700" text-anchor="end" fill="#F2D398">${etiket}</text>`,
    )

    for (let a = 1; a <= is.asamaSayisi; a += 1) {
      const bitmis = is.durum === 'tamam' || a < is.asama
      const simdiki = !bitmis && a === is.asama

      p.push(
        `<circle cx="${noktaSol + (a - 1) * 16}" cy="${SERIT_Y + 12}" r="5" fill="${bitmis ? '#58B368' : simdiki ? TURUNCU : '#6B6B6B'}">` +
          (simdiki ? `<animate attributeName="r" values="4;6;4" dur="1s" ${DONGU}/>` : '') +
          '</circle>',
      )
    }
  }

  // Boş bina: genel işler katında üç Clawd masasında uyukluyor.
  if (n === 0) {
    const zemin = katlar[0]?.zemin ?? KAT_USTU + 116
    const hucre = (BOSLUK_X - 28) / 3

    for (let i = 0; i < 3; i += 1) {
      const cx = Math.round(14 + hucre * (i + 0.5))

      p.push(
        clawd(cx - 40, zemin - 52.5, 5, { goz: 'kapali', salin: 'nefes', opak: 0.85 }),
        sahneMasasi(cx, zemin, 5, false),
        zzz(cx + 36, zemin - 56),
        `<text x="${cx}" y="${zemin + 14}" font-size="11" font-weight="700" text-anchor="middle" fill="#3B2F2F">Clawd ${i + 1}</text>`,
        `<text x="${cx}" y="${zemin + 27}" font-size="9.5" text-anchor="middle" fill="#7A6A5C">sırasını bekliyor</text>`,
      )
    }
  }

  // Ekip masalarında: yerinden kalktığı aralıklarda masadaki hali gizlenir.
  for (const [i, uye] of uyeler.entries()) {
    const yer = yerler[i]

    if (yer === undefined) continue

    const { cx, zemin, s } = yer
    const tepe = zemin - 10.5 * s
    const gizli = evdeGizli[i] ?? []
    let poz: Poz

    if (uye.durum === 'hata') poz = { goz: 'carpi', soluk: true, egik: 8 }
    else if (uye.durum === 'bekliyor') poz = { goz: 'kapali', salin: 'nefes', opak: 0.85 }
    else if (uye.durum === 'bitti') poz = bitti ? { goz: 'mutlu', kol: 'hava', salin: 'zipla' } : { goz: 'mutlu', salin: 'nefes' }
    else poz = { goz: 'kirp', kol: 'tus', salin: 'calis' }

    p.push(
      `<g><title>${kacis(`${uye.ad}: ${uye.rol} (${uye.asama}. aşama) · ${DURUM_ADI[uye.durum]}`)}</title>`,
      `<g>${gizli.length > 0 ? gorunurluk(gizli, T, true) : ''}${clawd(cx - 8 * s, tepe, s, poz, sapka(uye.seviye, s))}</g>`,
      sahneMasasi(cx, zemin, s, uye.durum === 'calisiyor'),
    )

    if (uye.durum === 'bekliyor') p.push(zzz(cx + 8 * s - 4, tepe - 4))
    if (uye.durum === 'hata') p.push(duman(cx - 6, zemin - 22 - 2.9 * s))

    const sonSoz = bitisSahnesi?.sozler.get(uye.id)

    if (sonSoz !== undefined && sonSoz !== '') balonlar.push(balon(cx, tepe - 4.8 * s - 2, sar(sonSoz, 23, 3), BOSLUK_X))

    p.push(uyeEtiketi(uye, cx, zemin), '</g>')
  }

  p.push(...masaUstu)

  // İş yeni başladıysa brifler Feride'nin masasından katlara, ekibin masalarına uçar.
  if (yeniBasladi) {
    for (const [i, uye] of uyeler.entries()) {
      const yer = yerler[i]

      if (uye.durum !== 'calisiyor' || yer === undefined) continue

      p.push(
        `<g opacity="0"><animate attributeName="opacity" values="0;1" begin="${yuvarla(0.3 + i * 0.2)}s" dur="0.1s" fill="freeze"/>` +
          `<animateMotion path="M160 ${104 + MASA_KAYMASI} Q${yuvarla((160 + yer.cx) / 2)} ${150 + MASA_KAYMASI} ${yer.cx} ${yer.zemin - 40}" begin="${yuvarla(0.3 + i * 0.2)}s" dur="1.2s" fill="freeze"/>` +
          `<rect x="-7" y="-9" width="14" height="18" fill="#FFFFFF" stroke="#8B5A3C" stroke-width="1"><animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="0.5s" repeatDur="1.5s"/></rect></g>`,
      )
    }
  }

  p.push(...onPlan)
  if (bitti) for (const kat of katlar) p.push(konfeti(20, kat.zemin - 104, BOSLUK_X - 60, 18))
  p.push(...balonlar)

  const dipnot = is === null ? `Şablon ${SABLON[sablon].ad}: ${SABLON[sablon].ozet}.` : is.limitNotu

  for (const [i, satir] of sar(dipnot, 122, 2).entries()) {
    p.push(`<text x="20" y="${boy - 20 + i * 11}" font-size="9" font-style="italic" fill="#6B5B4D">${kacis(satir)}</text>`)
  }

  if (!acik) {
    p.push(
      `<rect width="${G}" height="${boy}" rx="16" fill="#1B1B2B" opacity="0.45"/>`,
      `<text x="${G / 2}" y="${yuvarla(boy / 2 + 40)}" font-size="22" font-weight="800" letter-spacing="3" text-anchor="middle" fill="#FFFFFF" opacity="0.85">MOD KAPALI</text>`,
    )
  }

  p.push('</svg>')

  const durumlar = uyeler.map(u => `${u.ad} (${u.rol}, ${SEVIYE_ADI[u.seviye]}): ${DURUM_ADI[u.durum]}`).join('; ')

  return {
    kaynak: p.join(''),
    oran: boy / G,
    alt: is === null ? `Feride'nin binası. Feride: ${anaSoz}` : `Feride'nin binası. İş: ${is.ozet}. ${durumlar}. Feride: ${anaSoz}`,
  }
}

// ---------------------------------------------------------------------------
// Üye kartı: her ajan kendi karesinde, o an yaptığı işi canlandırır
// ---------------------------------------------------------------------------

const KART_BOYU = 150
const KX = 62
const KY = 46
const KS = 7

type Sahnelik = { poz: Poz; arka: string; on: string; ek: string; masa: boolean }

const ESPRI: Record<Etkinlik | 'bekliyor' | 'bitti' | 'hata', readonly string[]> = {
  oku: ['Okuyor. Anladığını iddia ediyor.', 'Dosyayı okuyor; brifi okusaydı keşke.', 'Satır satır okuyor. Faturaya "analiz" yazılacak.'],
  ara: ['İğneyi arıyor; samanlık dört bin dosya.', 'Arıyor. Bulamazsa "yok" diyecek, bulursa "ben buldum".', 'Büyüteçle bakıyor. Müşteri de ona öyle bakıyor.'],
  yaz: ['Yazıyor. Revizesi şimdiden yolda.', 'Klavye dayanıyor, o dayanmıyor.', 'Kod akıyor. Yorum satırları sitem dolu.'],
  komut: ['Komutu çalıştırdı, dua ediyor.', 'Çarkları çeviriyor. Hangisi neyi çeviriyor, bilmiyor.', 'Terminale bakıyor; terminal de ona bakıyor.'],
  web: ['İnternette. "Araştırma" diyor.', 'Ağa olta attı. Ya kaynak gelir ya reklam.', 'Dünyayı dolaşıyor, masasından kalkmadan.'],
  dusun: ['Düşünüyor. Faturalanabilir sessizlik.', 'Ampul yanıp sönüyor; fikir henüz gelmedi.', 'Kahvesi bitmek üzere, fikri başlamak üzere.'],
  bekliyor: ['Sırasını bekliyor. Mesaiye sayılmıyor.', 'Uyuyor. Feride Hanım görmesin.', 'Sıra numarası elinde, umudu cebinde.'],
  bitti: ['Teslim etti. Uyumak istiyor, olmaz.', 'Bitirdi. Tebrik yok, yeni brief var.', 'Raporunu verdi; şimdi revizeyi bekliyor.'],
  hata: ['Takıldı. Suç ortamda, kendisinde değil.', 'Duman çıkıyor. "Bende çalışıyordu" diyor.', 'Çöktü. Ajans buna "öğrenme fırsatı" diyor.'],
}

function etkinlikSahnesi(etkinlik: Etkinlik): Sahnelik {
  const u = (v: number): string => yuvarla(v * KS)
  const ax = (v: number): number => KX + v * KS
  const ay = (v: number): number => KY + v * KS

  if (etkinlik === 'oku') {
    // Kitabı yüzüne tutmuş, gözleri satırları tarıyor, sayfalar çevriliyor.
    const kitapY = u(4.4)
    const boy = u(4)

    return {
      poz: { goz: 'tarama', kol: 'on', salin: 'nefes' },
      arka: '',
      masa: true,
      ek:
        `<path d="M${u(2.4)} ${kitapY} L${u(8)} ${u(5)} L${u(13.6)} ${kitapY} L${u(13.6)} ${u(8.6)} L${u(8)} ${u(9.2)} L${u(2.4)} ${u(8.6)} Z" fill="#3A86FF" stroke="${KOYU}" stroke-width="1.4"/>` +
        `<path d="M${u(3)} ${u(4.1)} L${u(8)} ${u(4.7)} L${u(8)} ${u(8.7)} L${u(3)} ${u(8.1)} Z" fill="#FFFFFF" stroke="#8A7A6C" stroke-width="0.9"/>` +
        `<path d="M${u(13)} ${u(4.1)} L${u(8)} ${u(4.7)} L${u(8)} ${u(8.7)} L${u(13)} ${u(8.1)} Z" fill="#FFFFFF" stroke="#8A7A6C" stroke-width="0.9"/>` +
        // Çevrilen sayfa: sağdan sırta doğru daralır.
        `<rect x="${u(8)}" y="${u(4.6)}" width="${u(5)}" height="${boy}" fill="#F5E6C8" stroke="#8A7A6C" stroke-width="0.8">` +
        `<animate attributeName="width" values="${u(5)};0;0" keyTimes="0;0.5;1" dur="1.5s" ${DONGU}/></rect>` +
        [0, 1, 2].map(i => `<path d="M${u(3.8)} ${u(5.4 + i * 0.9)} L${u(7.2)} ${u(5.8 + i * 0.9)}" stroke="#B9A999" stroke-width="1"/>`).join(''),
      on: [0, 1, 2, 3]
        .map(i => `<rect x="${yuvarla(ax(17.6) - i * 1.5)}" y="${yuvarla(ay(7.9) - i * 5)}" width="34" height="5" rx="1" fill="${i % 2 === 0 ? '#FFFFFF' : '#F5E6C8'}" stroke="#8A7A6C" stroke-width="0.8"/>`)
        .join(''),
    }
  }

  if (etkinlik === 'ara') {
    // Dev bir büyüteç yüzünün önünde gidip geliyor; masada dosya yığını.
    return {
      poz: { goz: 'iri', kol: 'yan', salin: 'calis' },
      arka: '',
      masa: true,
      ek:
        `<g><animateTransform attributeName="transform" type="translate" values="${u(-3)} 0;${u(4.5)} 0;${u(-3)} 0" dur="3s" ${DONGU}/>` +
        `<path d="M${u(9.6)} ${u(5.2)} L${u(13.4)} ${u(8.8)}" stroke="#8B5A3C" stroke-width="${u(0.9)}" stroke-linecap="round"/>` +
        `<circle cx="${u(7.4)}" cy="${u(3.2)}" r="${u(3)}" fill="#BEE3F8" fill-opacity="0.45" stroke="${KOYU}" stroke-width="${u(0.5)}"/>` +
        `<path d="M${u(5.6)} ${u(2)} Q${u(6.4)} ${u(1.1)} ${u(7.6)} ${u(1.1)}" fill="none" stroke="#FFFFFF" stroke-width="${u(0.35)}" stroke-linecap="round"/></g>`,
      on:
        [0, 1, 2].map(i => dosya(ax(17.4) + i * 3, ay(7.4) - i * 7)).join('') +
        `<text x="${yuvarla(ax(20))}" y="${yuvarla(ay(3.4))}" font-size="20" font-weight="800" fill="#8A7A6C">?` +
        `<animate attributeName="opacity" values="0;1;0" dur="1.5s" ${DONGU}/>` +
        `<animateTransform attributeName="transform" type="translate" values="0 6;0 -8" dur="1.5s" ${DONGU}/></text>`,
    }
  }

  if (etkinlik === 'yaz') {
    // Klavyeyi dövüyor; dizüstünden kod parçaları fırlıyor.
    return {
      poz: { goz: 'kirp', kol: 'hizli', salin: 'calis' },
      arka: '',
      masa: true,
      ek: '',
      on:
        `<rect x="${yuvarla(ax(4.6))}" y="${yuvarla(ay(5.2))}" width="${u(6.8)}" height="${u(3.2)}" rx="3" fill="#4A4A4A"/>` +
        `<circle cx="${yuvarla(ax(8))}" cy="${yuvarla(ay(6.8))}" r="${u(0.55)}" fill="${TURUNCU}"><animate attributeName="opacity" values="0.3;1;0.3" dur="0.5s" ${DONGU}/></circle>` +
        ['{ }', '</>', ';', '=>', '( )']
          .map(
            (isaret, i) =>
              `<text x="${yuvarla(ax(13.5))}" y="${yuvarla(ay(5))}" font-size="15" font-weight="700" font-family="Consolas, Menlo, monospace" fill="${i % 2 === 0 ? '#5B8DEF' : '#3FA34D'}" opacity="0">${kacis(isaret)}` +
              `<animateTransform attributeName="transform" type="translate" values="0 0;${40 + i * 14} ${-52 + i * 9}" dur="1.5s" begin="-${yuvarla(i * 0.3)}s" ${DONGU}/>` +
              `<animate attributeName="opacity" values="0;1;0" dur="1.5s" begin="-${yuvarla(i * 0.3)}s" ${DONGU}/></text>`,
          )
          .join(''),
    }
  }

  if (etkinlik === 'komut') {
    // Kolu çekiyor: makinenin çarkları dönüyor, bacasından buhar çıkıyor.
    const mx = ax(19)
    const my = ay(2.4)
    const cark = (cx: number, cy: number, r: number, yon: 1 | -1): string =>
      `<g transform="translate(${yuvarla(cx)} ${yuvarla(cy)})"><g><animateTransform attributeName="transform" type="rotate" from="0" to="${360 * yon}" dur="1.5s" ${DONGU}/>` +
      `<circle r="${r}" fill="none" stroke="#6B5B4D" stroke-width="${yuvarla(r * 0.6)}" stroke-dasharray="${yuvarla(r * 0.52)} ${yuvarla(r * 0.52)}"/>` +
      `<circle r="${yuvarla(r * 0.62)}" fill="#6B5B4D"/><circle r="${yuvarla(r * 0.25)}" fill="#FFF4E6"/></g></g>`

    return {
      poz: { goz: 'kirp', kol: 'salla', salin: 'calis' },
      arka:
        duman(mx + 34, my - 6) +
        cark(mx + 12, my - 2, 11, 1) +
        cark(mx + 31, my + 4, 8, -1) +
        `<rect x="${yuvarla(mx)}" y="${yuvarla(my + 8)}" width="56" height="${yuvarla(ay(10.5) - my - 8)}" rx="5" fill="#2F3E46" stroke="${KOYU}" stroke-width="1.5"/>` +
        `<rect x="${yuvarla(mx + 6)}" y="${yuvarla(my + 15)}" width="44" height="26" rx="3" fill="#0F1A1F"/>` +
        `<text x="${yuvarla(mx + 11)}" y="${yuvarla(my + 33)}" font-size="14" font-weight="700" font-family="Consolas, Menlo, monospace" fill="#58B368">&gt;<tspan>_<animate attributeName="opacity" values="1;0;1" dur="0.75s" ${DONGU}/></tspan></text>`,
      masa: false,
      ek:
        // Çekme kolu sağ kolla birlikte kalkıp iner.
        `<g><animateTransform attributeName="transform" type="translate" values="0 0;0 ${u(-1.8)};0 0" dur="1s" ${DONGU}/>` +
        `<path d="M${u(15.6)} ${u(4)} L${u(19)} ${u(4.6)}" stroke="#8B5A3C" stroke-width="${u(0.6)}" stroke-linecap="round"/>` +
        `<circle cx="${u(15.6)}" cy="${u(4)}" r="${u(0.9)}" fill="#D64545"/></g>`,
      on: '',
    }
  }

  if (etkinlik === 'web') {
    // Dönen dünyaya olta atmış; "www" oltaya geliyor.
    const gx = ax(22.5)
    const gy = ay(6.2)

    return {
      poz: { goz: 'iri', kol: 'hava', salin: 'nefes' },
      arka:
        `<circle cx="${yuvarla(gx)}" cy="${yuvarla(gy)}" r="27" fill="#5B8DEF" stroke="${KOYU}" stroke-width="1.5"/>` +
        `<ellipse cx="${yuvarla(gx)}" cy="${yuvarla(gy)}" rx="27" ry="27" fill="none" stroke="#FFFFFF" stroke-width="1.3"><animate attributeName="rx" values="27;2;27" dur="3s" ${DONGU}/></ellipse>` +
        `<ellipse cx="${yuvarla(gx)}" cy="${yuvarla(gy)}" rx="13" ry="27" fill="none" stroke="#FFFFFF" stroke-width="1.1"><animate attributeName="rx" values="13;27;2;13" dur="3s" ${DONGU}/></ellipse>` +
        `<path d="M${yuvarla(gx - 27)} ${yuvarla(gy)} L${yuvarla(gx + 27)} ${yuvarla(gy)} M${yuvarla(gx - 23)} ${yuvarla(gy - 13)} L${yuvarla(gx + 23)} ${yuvarla(gy - 13)} M${yuvarla(gx - 23)} ${yuvarla(gy + 13)} L${yuvarla(gx + 23)} ${yuvarla(gy + 13)}" stroke="#FFFFFF" stroke-width="1.1"/>`,
      masa: false,
      ek: `<path d="M${u(15)} ${u(1)} L${u(22.4)} ${u(-4.2)}" stroke="#8B5A3C" stroke-width="${u(0.45)}" stroke-linecap="round"/>`,
      on:
        `<path d="M${yuvarla(ax(22.4))} ${yuvarla(ay(-4.2))} L${yuvarla(gx)} ${yuvarla(gy - 27)}" stroke="${KOYU}" stroke-width="1"/>` +
        `<g><animateTransform attributeName="transform" type="translate" values="0 0;0 ${yuvarla(ay(-4.2) - (gy - 27) + 10)}" dur="1.5s" ${DONGU}/>` +
        `<animate attributeName="opacity" values="1;1;0" keyTimes="0;0.8;1" dur="1.5s" ${DONGU}/>` +
        `<rect x="${yuvarla(gx - 17)}" y="${yuvarla(gy - 36)}" width="34" height="15" rx="7.5" fill="#FFFFFF" stroke="${KOYU}" stroke-width="1.1"/>` +
        `<text x="${yuvarla(gx)}" y="${yuvarla(gy - 25)}" font-size="10.5" font-weight="700" text-anchor="middle" fill="#5B8DEF">www</text></g>`,
    }
  }

  // Düşünüyor: tepesinde ampul yanıp sönüyor, masada kahvesi tütüyor.
  return {
    poz: { goz: 'kirp', kol: 'yan', salin: 'nefes' },
    arka:
      [0, 1, 2]
        .map(i => `<circle cx="${yuvarla(ax(14.6) + i * 9)}" cy="${yuvarla(ay(-0.6) - i * 9)}" r="${2.5 + i * 1.5}" fill="#FFFFFF" stroke="#C9B8A6" stroke-width="1.1"/>`)
        .join('') +
      `<g transform="translate(${yuvarla(ax(20.6))} ${yuvarla(ay(-3.8))})"><circle r="15" fill="#FFE27A" stroke="${KOYU}" stroke-width="1.4"><animate attributeName="fill" values="#FFE27A;#FFF9DC;#FFE27A;#E9E2D0;#FFE27A" dur="1.5s" ${DONGU}/></circle>` +
      `<rect x="-6" y="13" width="12" height="8" rx="2" fill="#8A7A6C"/>` +
      [-1, 0, 1]
        .map(
          i =>
            `<path d="M${i * 19} ${-22 + Math.abs(i) * 8} l${i * 5} ${-6 + Math.abs(i) * 3}" stroke="#F2B705" stroke-width="2.2" stroke-linecap="round"><animate attributeName="opacity" values="1;0.1;1;0;1" dur="1.5s" ${DONGU}/></path>`,
        )
        .join('') +
      '</g>',
    masa: true,
    ek: '',
    on:
      `<rect x="${yuvarla(ax(17.6))}" y="${yuvarla(ay(6.2))}" width="17" height="17" rx="2" fill="#FFFFFF" stroke="#4A2C2A" stroke-width="1.3"/>` +
      `<path d="M${yuvarla(ax(17.6) + 17)} ${yuvarla(ay(6.2) + 4)} q8 4 0 9" fill="none" stroke="#4A2C2A" stroke-width="1.3"/>` +
      [0, 1]
        .map(
          i =>
            `<path d="M${yuvarla(ax(17.6) + 5 + i * 6)} ${yuvarla(ay(6.2) - 3)} q3 -5 0 -9 q-3 -4 0 -8" fill="none" stroke="#B9A999" stroke-width="1.4" stroke-linecap="round">` +
            `<animate attributeName="opacity" values="0;0.9;0" dur="3s" begin="-${yuvarla(i * 1.5)}s" ${DONGU}/></path>`,
        )
        .join(''),
  }
}

function durumSahnesi(uye: Uye): Sahnelik {
  const ax = (v: number): number => KX + v * KS
  const ay = (v: number): number => KY + v * KS

  if (uye.durum === 'bekliyor') {
    // Masasında uyukluyor; elinde sıra numarası.
    return {
      poz: { goz: 'kapali', salin: 'nefes', opak: 0.9 },
      arka: zzz(ax(15), ay(0)),
      masa: true,
      ek: '',
      on:
        `<g transform="rotate(-6 ${yuvarla(ax(19.4))} ${yuvarla(ay(7))})"><rect x="${yuvarla(ax(17.4))}" y="${yuvarla(ay(5.2))}" width="34" height="23" rx="2" fill="#FFFFFF" stroke="#8A7A6C" stroke-width="1.1"/>` +
        `<text x="${yuvarla(ax(17.4) + 17)}" y="${yuvarla(ay(5.2) + 9)}" font-size="6.5" font-weight="700" text-anchor="middle" fill="#8A7A6C">SIRA</text>` +
        `<text x="${yuvarla(ax(17.4) + 17)}" y="${yuvarla(ay(5.2) + 20)}" font-size="11" font-weight="800" text-anchor="middle" fill="${KOYU}">A${uye.asama}</text></g>`,
    }
  }

  if (uye.durum === 'bitti') {
    // Kolları havada; masasında "TESLİM" kaşeli rapor, tepesinden konfeti.
    return {
      poz: { goz: 'mutlu', kol: 'hava', salin: 'zipla' },
      arka: konfeti(ax(-2), ay(-4.5), 20 * KS, 9),
      masa: true,
      ek: '',
      on:
        `<g transform="rotate(-7 ${yuvarla(ax(20))} ${yuvarla(ay(6.6))})"><rect x="${yuvarla(ax(17))}" y="${yuvarla(ay(4.6))}" width="42" height="27" fill="#FFFFFF" stroke="#8A7A6C" stroke-width="1.1"/>` +
        `<rect x="${yuvarla(ax(17) + 4)}" y="${yuvarla(ay(4.6) + 7)}" width="34" height="13" rx="2" fill="none" stroke="#C2185B" stroke-width="1.6"/>` +
        `<text x="${yuvarla(ax(17) + 21)}" y="${yuvarla(ay(4.6) + 17)}" font-size="8.5" font-weight="800" text-anchor="middle" fill="#C2185B">TESLİM</text></g>`,
    }
  }

  // Takıldı: dizüstünden duman ve alev çıkıyor.
  return {
    poz: { goz: 'carpi', soluk: true, egik: 8 },
    arka: '',
    masa: true,
    ek: '',
    on:
      `<rect x="${yuvarla(ax(4.6))}" y="${yuvarla(ay(5.2))}" width="${yuvarla(6.8 * KS)}" height="${yuvarla(3.2 * KS)}" rx="3" fill="#4A4A4A"/>` +
      duman(ax(6.4), ay(4.6)) +
      `<path d="M${yuvarla(ax(9))} ${yuvarla(ay(5.2))} q-7 -12 2 -20 q1 7 6 9 q5 6 0 11 Z" fill="#F2B705" stroke="#E4572E" stroke-width="2">` +
      `<animateTransform attributeName="transform" type="translate" values="0 0;1.5 -2;-1 0;0 0" dur="0.5s" ${DONGU}/></path>`,
  }
}

/** Üyenin kartı: solda yaptığı işin canlandırması, sağda kim olduğu ve ne yaptığı. */
export function kartSvg(uye: Uye): Cizim {
  const etkinlik = uye.etkinlik ?? TUR_ETKINLIGI[uye.isTuru ?? 'genel']
  const tur = uye.durum === 'calisiyor' ? etkinlik : uye.durum
  const sahnelik = uye.durum === 'calisiyor' ? etkinlikSahnesi(etkinlik) : durumSahnesi(uye)
  const rozet = ROZET[uye.seviye]
  const inmis = uye.seviye !== uye.istenen
  const rozetYazisi = `${inmis ? '↓ ' : ''}${SEVIYE_ADI[uye.seviye]} · ${uye.model} · ${uye.asama}. aşama`
  const rozetEni = rozetYazisi.length * 6.1 + 18
  const durumEni = DURUM_ADI[uye.durum].length * 6.1 + 18
  const espri = sec(ESPRI[tur], karma(`${uye.id}:${tur}`)) ?? ''
  const zeminY = KY + 10.5 * KS
  const ipucu = [
    `${uye.ad}: ${uye.rol} (${uye.asama}. aşama)`,
    uye.yetkinlikler.length > 0 ? `Yetkinlikler: ${uye.yetkinlikler.join(', ')}` : '',
    `Model: ${SEVIYE_ADI[uye.seviye]}/${uye.model}, ${uye.gerekce}`,
    `Görev: ${kisalt(temiz(uye.gorev), 220)}`,
  ]
    .filter(satir => satir !== '')
    .join('\n')
  let ayrinti: string

  if (uye.durum === 'calisiyor') ayrinti = `Görev: ${kisalt(temiz(uye.gorev), 54)}`
  else if (uye.durum === 'bitti') ayrinti = uye.laf === undefined ? 'Raporu Feride Hanım’ın masasında.' : `“${uye.laf}”`
  else if (uye.durum === 'hata') ayrinti = kisalt(temiz(uye.rapor ?? 'Neden takıldığı bilinmiyor.'), 62)
  else ayrinti = `Görev: ${kisalt(temiz(uye.gorev), 54)}`

  const p: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${G} ${KART_BOYU}" width="${G}" height="${KART_BOYU}" ${YAZI_TIPI}>`,
    `<title>${kacis(ipucu)}</title>`,
    `<rect x="1" y="1" width="${G - 2}" height="${KART_BOYU - 2}" rx="14" fill="#FFF4E6" stroke="${DURUM_RENGI[uye.durum]}" stroke-width="2"/>`,
    `<rect x="1" y="1" width="252" height="${KART_BOYU - 2}" rx="14" fill="#FBE7D0"/>`,
    `<rect x="14" y="${yuvarla(zeminY)}" width="226" height="3" rx="1.5" fill="#E3CDB4"/>`,
    sahnelik.arka,
    clawd(KX, KY, KS, sahnelik.poz, sapka(uye.seviye, KS) + sahnelik.ek),
  ]

  if (sahnelik.masa) {
    p.push(
      `<rect x="26" y="${yuvarla(zeminY - 23)}" width="218" height="8" rx="2" fill="#B07B4F"/>`,
      `<rect x="32" y="${yuvarla(zeminY - 15)}" width="206" height="15" fill="#C9925F"/>`,
    )
  }

  p.push(sahnelik.on)

  // Çalışırken yanıp sönen kayıt ışığı.
  if (uye.durum === 'calisiyor') {
    p.push(`<circle cx="24" cy="22" r="5" fill="#D64545"><animate attributeName="opacity" values="1;0.2;1" dur="1s" ${DONGU}/></circle>`)
  }

  p.push(
    `<text x="272" y="36" font-size="21" font-weight="800" fill="#3B2F2F">${kacis(uye.ad)}<tspan dx="10" font-size="13" font-weight="400" fill="#7A6A5C">${kacis(kisalt(uye.rol, 36))}</tspan></text>`,
    `<rect x="272" y="47" width="${yuvarla(rozetEni)}" height="19" rx="9.5" fill="${rozet.zemin}"/>`,
    `<text x="${yuvarla(272 + rozetEni / 2)}" y="60.5" font-size="11" font-weight="700" text-anchor="middle" fill="${rozet.yazi}">${kacis(rozetYazisi)}</text>`,
    `<rect x="${yuvarla(280 + rozetEni)}" y="47" width="${yuvarla(durumEni)}" height="19" rx="9.5" fill="${DURUM_RENGI[uye.durum]}"/>`,
    `<text x="${yuvarla(280 + rozetEni + durumEni / 2)}" y="60.5" font-size="11" font-weight="700" text-anchor="middle" fill="#FFFFFF">${DURUM_ADI[uye.durum]}</text>`,
    `<text x="272" y="89" font-size="13.5" font-style="italic" fill="#6B5B4D">${kacis(kisalt(espri, 64))}</text>`,
    `<text x="272" y="111" font-size="12.5" font-family="Consolas, Menlo, monospace" fill="#3B2F2F">${kacis(kisalt(ayrinti, 56))}</text>`,
  )

  if (uye.yetkinlikler.length > 0) {
    p.push(`<text x="272" y="133" font-size="11" fill="#8A7A6C">${kacis(kisalt(uye.yetkinlikler.join(' · '), 70))}</text>`)
  }

  p.push('</svg>')

  return {
    kaynak: p.join(''),
    oran: KART_BOYU / G,
    alt: `${uye.ad} (${uye.rol}, ${SEVIYE_ADI[uye.seviye]}/${uye.model}): ${DURUM_ADI[uye.durum]}. ${ayrinti}`,
  }
}
