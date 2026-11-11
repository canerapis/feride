import type { On } from 'claude-code'
import { describe, expect, mock, test } from 'claude-code/testing'

const ARAC = 'mcp__feride__ekip_kur'
const PANE = 'feride-ofis'
const SIMDI = Date.parse('2026-11-10T10:00:00Z')
const SIFIRLANMA = '2026-11-10T14:00:00Z'

type Limit = { kind: string; percentUsed: number; resetsAt?: string }

/**
 * Motorun yerine geçen alt kancalar: modun `$` üzerinden çağırdığı her şeyi
 * bellekten yanıtlar ve ne çağrıldığını kaydeder.
 */
function ofis(on: On, limitler: Limit[] = [], depo: Record<string, unknown> = {}) {
  mock.store(on, depo)

  const kayit = {
    limitler,
    ajanlar: [] as { id: string; model: string | undefined; prompt: string; tur: string | undefined }[],
    durumlar: new Map<string, 'running' | 'failed' | 'completed'>(),
    gonderilen: [] as string[],
    bildirimler: [] as string[],
    acilan: [] as string[],
    saat: mock.clock(on, { now: SIMDI }),
    /** Doluysa her ajan başlatma bu nedenle reddedilir (örn. izin sınıflandırıcısı). */
    reddet: undefined as string | undefined,
    /** Ana döngünün ve ajanların model adımlarında motora ulaşan model adları. */
    adimlar: [] as string[],
    /** true iken model adımları yanıtsız kalır (model bu hesapta yokmuş gibi). */
    yanitsiz: false,
  }

  on('turn.step', async function* (_, e) {
    kayit.adimlar.push(e.model)

    return { turnId: e.turnId, index: e.index, answer: 'tamam', toolUses: [], stopReason: kayit.yanitsiz ? null : 'end_turn', usage: null } as never
  })
  // İşçilerin kendi araç çağrıları (Grep, Edit...): motor yerine boş sonuç.
  on('tool.call', () => ({ result: {} }) as never)

  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('session.usage', () => ({ value: { startedAt: SIMDI, context: { window: 200_000 }, rateLimits: kayit.limitler } }))
  on('command.register', (_, e) => ({ value: { command: e.name } }))
  on('tool.register', (_, e) => ({ value: { tool: `mcp__feride__${e.name}` } }))
  on('agent.register', (_, e) => ({ value: { agent: `feride:${e.name}` } }))
  on('agent.list', () => ({
    value: kayit.ajanlar.map(a => ({
      id: a.id,
      description: 'üye',
      type: a.tur ?? 'general-purpose',
      status: kayit.durumlar.get(a.id) ?? 'running',
    })),
  }))
  // Modun $.agent.spawn çağrısı Agent aracının yolundan geçer: girdi aracın
  // biçimindedir, kimlik de aracın sonucundan (result.agentId) okunur.
  on('agent.spawn', (_, e) => {
    if (kayit.reddet !== undefined) return { deny: kayit.reddet }

    const id = `a${kayit.ajanlar.length + 1}`
    const arac = e as unknown as { subagent_type?: string; subagentType?: string }

    kayit.ajanlar.push({ id, model: e.model, prompt: e.prompt, tur: arac.subagent_type ?? arac.subagentType })

    return {
      model: e.model ?? 'inherit',
      agentId: id,
      result: { status: 'async_launched', agentId: id, description: e.description, prompt: e.prompt, outputFile: `/tmp/${id}` },
    } as never
  })
  on('prompt.submit', (_, e) => {
    kayit.gonderilen.push(e.text)

    return { text: e.text }
  })
  on('prompt.compose', () => ({ sections: [{ id: 'intro', text: 'Sen Claude Code’sun.', scope: 'shared' }] }))
  on('turn.complete', (_, e) => ({ text: e.answer }))
  on('ui.open', (_, e) => {
    kayit.acilan.push(e.id)

    return { value: { isPlaced: true } }
  })
  on('ui.close', () => ({ value: undefined }))
  on('ui.log', () => ({ value: undefined }))
  on('ui.toast', (_, e) => {
    kayit.bildirimler.push(e.text)

    return { value: undefined }
  })

  return kayit
}

const OTURUM = { cwd: '/is', surface: null, isInteractive: true } as const
const KOMUT = { command: 'feride', origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 100 } } as const
const ISTEM = { model: 'claude-opus', promptModel: 'claude-opus', surfaces: [], outputStyle: null, traits: [] } as const
const PANO = {
  title: "Feride'nin Ofisi",
  isFocused: false,
  bodyColumns: 80,
  placement: 'dock',
  scroll: { offset: 0, bodyRows: 40 },
  view: {},
} as const

const uye = (ad: string, seviye: string, asama = 1, kritik = false, tur?: string) => ({
  ad,
  rol: `${ad} rolü`,
  yetkinlikler: ['okuma', 'yazma'],
  seviye,
  asama,
  gorev: `${ad} kendi parçasını yapsın.`,
  kritik,
  ...(tur === undefined ? {} : { tur }),
})

const ADIM = { turnId: 't1', index: 0, model: 'claude-sonnet-5-5', messageCount: 3 } as const

/** Bir model adımını baştan sona yürütür. */
async function adim($: { turn: { step: (e: never) => AsyncIterable<unknown> } }, e: object): Promise<void> {
  for await (const _ of $.turn.step(e as never)) void _
}

/** Modun reddettiği araç çağrısının nedeni. */
const red = (sonuc: unknown): string | undefined => (sonuc as { deny?: string }).deny

const bitir = (agentId: string, answer: string) =>
  ({ answer, durationMs: 1_000, isAborted: false, turnId: `t-${agentId}`, agentId, reason: 'answer' }) as const

describe('modeller kalan limite göre seçilir', () => {
  test('limit bolken Feride’nin istediği seviyeler verilir', async ($, on) => {
    const o = ofis(on, [
      { kind: 'five_hour', percentUsed: 10, resetsAt: SIFIRLANMA },
      { kind: 'seven_day', percentUsed: 10 },
    ])

    await $.session.start(OTURUM)

    const sonuc = await $.tool.call({
      tool: ARAC,
      tool_use_id: 'k1',
      ozet: 'Giriş akışını yeniden yaz',
      ekip: [uye('Aras', 'usta'), uye('Bora', 'kalfa'), uye('Cem', 'çırak')],
    })

    expect(o.ajanlar.map(a => a.model)).toEqual(['opus', 'sonnet', 'haiku'])
    expect(o.ajanlar.map(a => a.tur)).toEqual(['feride:clawd', 'feride:clawd', 'feride:clawd'])
    expect(o.ajanlar[0]?.prompt).toEqual(expect.stringContaining('Aras kendi parçasını yapsın.'))
    expect(o.acilan).toEqual([PANE])
    expect(JSON.stringify(sonuc)).toEqual(expect.stringContaining('Ekip kuruldu: 3 üye, 1 aşama'))
  })

  test('limit bitmek üzereyken herkes çırak olur', async ($, on) => {
    const o = ofis(on, [{ kind: 'five_hour', percentUsed: 90, resetsAt: SIFIRLANMA }])

    await $.session.start(OTURUM)
    await $.tool.call({
      tool: ARAC,
      tool_use_id: 'k1',
      ozet: 'Büyük iş',
      ekip: [uye('Aras', 'usta', 1, true), uye('Bora', 'kalfa'), uye('Cem', 'çırak')],
    })

    expect(o.ajanlar.map(a => a.model)).toEqual(['haiku', 'haiku', 'haiku'])

    const durum = await $.command.run({ ...KOMUT, args: 'durum' })

    expect(durum.text).toEqual(expect.stringContaining('herkes çırak'))
  })

  test('limit yarıdayken tek usta kalır, o da kritik olan', async ($, on) => {
    const o = ofis(on, [{ kind: 'five_hour', percentUsed: 55, resetsAt: SIFIRLANMA }])

    await $.session.start(OTURUM)
    await $.tool.call({
      tool: ARAC,
      tool_use_id: 'k1',
      ozet: 'Mimari karar',
      ekip: [uye('Aras', 'usta'), uye('Bora', 'usta', 1, true), uye('Cem', 'kalfa')],
    })

    expect(o.ajanlar.map(a => a.model)).toEqual(['sonnet', 'opus', 'sonnet'])
  })

  test('bütçe yetmeyince kritik olmayanlardan kademe indirilir', async ($, on) => {
    // Öğrenilmiş katsayı: bu oturumlarda ekip tahminin beş katını harcıyor.
    const o = ofis(on, [{ kind: 'five_hour', percentUsed: 35, resetsAt: SIFIRLANMA }], { katsayi: 5 })

    await $.session.start(OTURUM)
    await $.tool.call({
      tool: ARAC,
      tool_use_id: 'k1',
      ozet: 'Pahalı iş',
      ekip: [uye('Aras', 'usta', 1, true), uye('Bora', 'usta'), uye('Cem', 'usta'), uye('Derin', 'kalfa')],
    })

    expect(o.ajanlar[0]?.model).toBe('opus')
    expect(o.ajanlar.slice(1).map(a => a.model)).not.toEqual(['opus', 'opus', 'sonnet'])
  })

  test('limit okunamıyorsa istenen seviyeler aynen verilir', async ($, on) => {
    const o = ofis(on)

    await $.session.start(OTURUM)
    await $.tool.call({ tool: ARAC, tool_use_id: 'k1', ozet: 'İş', ekip: [uye('Aras', 'usta'), uye('Bora', 'usta')] })

    expect(o.ajanlar.map(a => a.model)).toEqual(['opus', 'opus'])
  })
})

describe('şablonlar', () => {
  const BOL = [
    { kind: 'five_hour', percentUsed: 10, resetsAt: SIFIRLANMA },
    { kind: 'seven_day', percentUsed: 10 },
  ]

  test('güçlü şablonda zor işe en üst model verilir; düz metne ve türü belirsiz işe verilmez', async ($, on) => {
    const o = ofis(on, BOL, { sablon: 'guclu' })

    await $.session.start(OTURUM)

    const sonuc = await $.tool.call({
      tool: ARAC,
      tool_use_id: 'k1',
      ozet: 'Zor iş',
      ekip: [
        uye('Aras', 'üstat', 1, false, 'kod'),
        uye('Bora', 'üstat', 1, false, 'metin'),
        uye('Cem', 'üstat'),
        uye('Derin', 'kalfa', 1, false, 'metin'),
      ],
    })

    expect(o.ajanlar.map(a => a.model)).toEqual(['fable', 'opus', 'opus', 'sonnet'])
    expect(JSON.stringify(sonuc)).toEqual(expect.stringContaining('düz metin işine en üst model verilmez'))
    expect(JSON.stringify(sonuc)).toEqual(expect.stringContaining('Şablon: güçlü'))
  })

  test('orta şablonun tavanı usta, hafif şablonun tavanı kalfadır', async ($, on) => {
    const o = ofis(on, BOL)

    await $.session.start(OTURUM)
    await $.tool.call({ tool: ARAC, tool_use_id: 'k1', ozet: 'Orta iş', ekip: [uye('Aras', 'üstat', 1, false, 'kod'), uye('Bora', 'çırak')] })
    expect(o.ajanlar.map(a => a.model)).toEqual(['opus', 'haiku'])

    await $.turn.complete(bitir('a1', 'ÖZET: tamam.'))
    await $.turn.complete(bitir('a2', 'ÖZET: tamam.'))

    const yanit = await $.command.run({ ...KOMUT, args: 'şablon hafif' })

    expect(yanit.text).toEqual(expect.stringContaining('Şablon: hafif'))
    expect((await $.command.run({ ...KOMUT, args: 'durum' })).text).toEqual(expect.stringContaining('Şablon: hafif'))

    await $.tool.call({ tool: ARAC, tool_use_id: 'k2', ozet: 'Hafif iş', ekip: [uye('Cem', 'usta', 1, true, 'kod'), uye('Derin', 'kalfa'), uye('Ece', 'çırak')] })
    expect(o.ajanlar.slice(2).map(a => a.model)).toEqual(['sonnet', 'sonnet', 'haiku'])
  })

  test('güçlü şablon limiti riske atar: ortanın kalfaya indirdiği yerde ustayı korur', async ($, on) => {
    const dar = [{ kind: 'five_hour', percentUsed: 80, resetsAt: SIFIRLANMA }]
    const ekip = [uye('Aras', 'usta', 1, false, 'kod'), uye('Bora', 'usta', 1, true, 'kod'), uye('Cem', 'kalfa')]
    const o = ofis(on, dar)

    await $.session.start(OTURUM)
    await $.tool.call({ tool: ARAC, tool_use_id: 'k1', ozet: 'Orta', ekip })
    expect(o.ajanlar.map(a => a.model)).toEqual(['sonnet', 'sonnet', 'sonnet'])

    for (const id of ['a1', 'a2', 'a3']) await $.turn.complete(bitir(id, 'ÖZET: tamam.'))

    // Bu işe özel şablon: kullanıcı açıkça istediyse Feride araca yazar.
    await $.tool.call({ tool: ARAC, tool_use_id: 'k2', ozet: 'Güçlü', ekip, sablon: 'güçlü' })
    expect(o.ajanlar.slice(3).map(a => a.model)).toEqual(['sonnet', 'opus', 'sonnet'])
    // Kalıcı şablon değişmedi.
    expect((await $.command.run({ ...KOMUT, args: 'durum' })).text).toEqual(expect.stringContaining('Şablon: orta'))
  })

  test('/feride şablon geçerli şablonu ve seçenekleri gösterir', async ($, on) => {
    ofis(on)
    await $.session.start(OTURUM)

    const liste = await $.command.run({ ...KOMUT, args: 'şablon' })

    expect(liste.text).toEqual(expect.stringContaining('orta (geçerli)'))
    expect(liste.text).toEqual(expect.stringContaining('güçlü'))
    expect((await $.command.run({ ...KOMUT, args: 'şablon turbo' })).text).toEqual(expect.stringContaining('"turbo" diye bir şablon yok'))

    await $.command.run({ ...KOMUT, args: 'güçlü' })
    expect((await $.command.run({ ...KOMUT, args: 'şablon' })).text).toEqual(expect.stringContaining('güçlü (geçerli)'))
    // Patron bölümü geçerli şablonu Feride'ye söyler.
    expect((await $.prompt.compose({ ...ISTEM, tools: [ARAC] })).sections.at(-1)?.text).toEqual(expect.stringContaining('Geçerli şablon: güçlü'))
  })
})

describe('Feride’nin modeli', () => {
  test('ana döngü en üst modelde çalışır; ajanların adımlarına dokunulmaz', async ($, on) => {
    const o = ofis(on, [{ kind: 'five_hour', percentUsed: 50, resetsAt: SIFIRLANMA }])

    await $.session.start(OTURUM)
    await adim($, ADIM)
    await adim($, { ...ADIM, agentId: 'a1' })
    // Oturum zaten o modelin bir türündeyse adı korunur.
    await adim($, { ...ADIM, model: 'claude-fable-5-2[1m]' })

    expect(o.adimlar).toEqual(['fable', 'claude-sonnet-5-5', 'claude-fable-5-2[1m]'])
    expect((await $.command.run({ ...KOMUT, args: 'durum' })).text).toEqual(expect.stringContaining("Feride'nin modeli: fable"))
  })

  test('bir limit %99’a varınca bir alttaki modele iner', async ($, on) => {
    const o = ofis(on, [
      { kind: 'five_hour', percentUsed: 40, resetsAt: SIFIRLANMA },
      { kind: 'seven_day', percentUsed: 99 },
    ])

    await $.session.start(OTURUM)
    await adim($, ADIM)

    expect(o.adimlar).toEqual(['opus'])
    expect((await $.command.run({ ...KOMUT, args: 'durum' })).text).toEqual(expect.stringContaining("Feride'nin modeli: opus (7 gün limiti %99 dolu"))
  })

  test('mod kapalıyken oturumun modeli olduğu gibi kalır', async ($, on) => {
    const o = ofis(on)

    await $.session.start(OTURUM)
    await $.command.run({ ...KOMUT, args: 'kapat' })
    await adim($, ADIM)

    expect(o.adimlar).toEqual(['claude-sonnet-5-5'])
  })

  test('en üst model yanıt vermiyorsa iki denemeden sonra oturumun modeline dönülür', async ($, on) => {
    const o = ofis(on)

    await $.session.start(OTURUM)
    o.yanitsiz = true
    await adim($, ADIM)
    await adim($, ADIM)
    o.yanitsiz = false
    await adim($, ADIM)

    expect(o.adimlar).toEqual(['fable', 'fable', 'claude-sonnet-5-5'])
    expect(o.bildirimler.at(-1)).toEqual(expect.stringContaining('oturumun kendi modeliyle'))
  })
})

describe('iş akışı', () => {
  test('sonraki aşama öncekinin raporlarıyla başlar, sonunda toplu rapor Feride’ye gider', async ($, on) => {
    const o = ofis(on, [{ kind: 'five_hour', percentUsed: 5, resetsAt: SIFIRLANMA }])

    await $.session.start(OTURUM)
    await $.tool.call({
      tool: ARAC,
      tool_use_id: 'k1',
      ozet: 'Arama kutusunu hızlandır',
      ekip: [uye('Aras', 'çırak', 1), uye('Bora', 'çırak', 1), uye('Cem', 'usta', 5)],
      atismalar: ['Aras: Bora yine grep’i yanlış yazdı.'],
    })

    expect(o.ajanlar).toHaveLength(2)

    await $.turn.complete(bitir('a1', 'ÖZET: darboğaz dizinde.\nLAF: Bora, ben bitirdim bile.'))
    expect(o.ajanlar).toHaveLength(2)
    expect(o.gonderilen).toHaveLength(0)

    await $.turn.complete(bitir('a2', 'ÖZET: önbellek yok.'))
    expect(o.ajanlar).toHaveLength(3)
    expect(o.ajanlar[2]?.model).toBe('opus')
    expect(o.ajanlar[2]?.prompt).toEqual(expect.stringContaining('darboğaz dizinde'))
    expect(o.ajanlar[2]?.prompt).toEqual(expect.stringContaining('önbellek yok'))

    await $.turn.complete(bitir('a3', 'ÖZET: dizin eklendi, önbellek kuruldu.'))
    // Rapor tutulan turun dışından, saatin sonraki atımında gönderilir.
    await o.saat.advance(1)
    expect(o.gonderilen).toHaveLength(1)
    expect(o.gonderilen[0]).toEqual(expect.stringContaining('FERİDE EKİP RAPORU: Arama kutusunu hızlandır'))
    expect(o.gonderilen[0]).toEqual(expect.stringContaining('dizin eklendi'))

    const durum = await $.command.run({ ...KOMUT, args: 'durum' })

    expect(durum.text).toEqual(expect.stringContaining('Bitti'))
  })

  test('ölen ajan işi kilitlemez: saat onu düşürür, rapor yine gider', async ($, on) => {
    const o = ofis(on)

    await $.session.start(OTURUM)
    await $.tool.call({ tool: ARAC, tool_use_id: 'k1', ozet: 'Tek kişilik iş', ekip: [uye('Aras', 'kalfa')] })
    o.durumlar.set('a1', 'failed')

    await o.saat.advance(3_000)
    await o.saat.advance(3_000)
    await o.saat.advance(1)

    expect(o.gonderilen).toHaveLength(1)
    expect(o.gonderilen[0]).toEqual(expect.stringContaining('İşini tamamlayamayanlar: Aras'))
  })

  test('ilk aşamada kimse başlatılamazsa sonraki aşama denenmez, iş raporla kapanır', async ($, on) => {
    const o = ofis(on, [{ kind: 'five_hour', percentUsed: 31, resetsAt: SIFIRLANMA }])

    o.reddet = 'izin verilmedi'
    await $.session.start(OTURUM)

    const sonuc = await $.tool.call({
      tool: ARAC,
      tool_use_id: 'k1',
      ozet: 'Reddedilen iş',
      ekip: [uye('Aras', 'çırak', 1), uye('Bora', 'kalfa', 2)],
    })
    const metin = JSON.stringify(sonuc)

    expect(metin).toEqual(expect.stringContaining('BAŞLAMADI: Başlatılamadı: izin verilmedi'))
    expect(metin).toEqual(expect.stringContaining('1. aşamadan hiç rapor çıkmadığı için başlatılmadı'))
    expect(metin).toEqual(expect.stringContaining("%69'u boşta"))

    await o.saat.advance(1)
    expect(o.gonderilen).toHaveLength(1)
    expect(o.gonderilen[0]).toEqual(expect.stringContaining('İşini tamamlayamayanlar: Aras, Bora'))
  })

  test('ekip çalışırken ikinci ekip kurulmaz', async ($, on) => {
    const o = ofis(on)

    await $.session.start(OTURUM)
    await $.tool.call({ tool: ARAC, tool_use_id: 'k1', ozet: 'İlk iş', ekip: [uye('Aras', 'kalfa')] })

    const ikinci = await $.tool.call({ tool: ARAC, tool_use_id: 'k2', ozet: 'İkinci iş', ekip: [uye('Bora', 'kalfa')] })

    expect(red(ikinci)).toEqual(expect.stringContaining('Ekip hâlâ "İlk iş" işinde'))
    expect(o.ajanlar).toHaveLength(1)
  })

  test('ekibi yalnızca patron kurar: bir üyenin çağrısı reddedilir', async ($, on) => {
    const o = ofis(on)

    await $.session.start(OTURUM)

    const sonuc = await $.tool.call({ tool: ARAC, tool_use_id: 'k1', agentId: 'a9', ozet: 'İş', ekip: [uye('Aras', 'usta')] })

    expect(red(sonuc)).toEqual(expect.stringContaining('yalnızca patron Feride'))
    expect(o.ajanlar).toHaveLength(0)
  })

  test('eksik plan anlaşılır bir hatayla döner', async ($, on) => {
    ofis(on)
    await $.session.start(OTURUM)

    const sonuc = await $.tool.call({ tool: ARAC, tool_use_id: 'k1', ozet: 'İş', ekip: [{ ad: 'Aras', rol: 'Kâşif', seviye: 'usta' }] })

    expect(red(sonuc)).toEqual(expect.stringContaining('ekip[0].gorev boş'))
  })
})

describe('komut ve patron bölümü', () => {
  test('/feride <iş> işi Feride’ye iletir ve panoyu açar', async ($, on) => {
    const o = ofis(on)

    await $.session.start(OTURUM)

    const yanit = await $.command.run({ ...KOMUT, args: 'README’yi baştan yaz' })

    expect(yanit.text).toEqual(expect.stringContaining('Feride işi aldı'))
    expect(o.acilan).toEqual([PANE])
    // Komutun turu tutuluyken gönderim reddedilir: iş sonraki atımda gider.
    expect(o.gonderilen).toHaveLength(0)
    await o.saat.advance(1)
    expect(o.gonderilen).toHaveLength(1)
    expect(o.gonderilen[0]).toEqual(expect.stringContaining('README’yi baştan yaz'))
    expect(o.gonderilen[0]).toEqual(expect.stringContaining(ARAC))
  })

  test('patron bölümü yalnızca aracı gören ana döngüye, mod açıkken eklenir', async ($, on) => {
    ofis(on)
    await $.session.start(OTURUM)

    const idler = async (tools: string[], traits: ('teammate')[] = []) =>
      (await $.prompt.compose({ ...ISTEM, tools, traits })).sections.map(s => s.id)

    expect(await idler(['Read', ARAC])).toEqual(['intro', 'feride:patron'])
    expect(await idler(['Read'])).toEqual(['intro'])
    expect(await idler(['Read', ARAC], ['teammate'])).toEqual(['intro'])

    await $.command.run({ ...KOMUT, args: 'kapat' })
    expect(await idler(['Read', ARAC])).toEqual(['intro'])

    const reddedilen = await $.tool.call({ tool: ARAC, tool_use_id: 'k1', ozet: 'İş', ekip: [uye('Aras', 'usta')] })

    expect(red(reddedilen)).toEqual(expect.stringContaining('Feride modu kapalı'))

    await $.command.run({ ...KOMUT, args: 'aç' })
    expect(await idler(['Read', ARAC])).toEqual(['intro', 'feride:patron'])
  })
})

describe('ofis panosu', () => {
  test('sohbetteki ekip_kur satırı sahneye dönüşmez, aracın kendi satırı kalır', async ($, on) => {
    ofis(on, [{ kind: 'five_hour', percentUsed: 20, resetsAt: SIFIRLANMA }])
    // Motorun kendi satır çizimi.
    on('ui.render', () => ({ type: 'Text', props: {}, children: ['motorun satırı'] }) as never)

    await $.session.start(OTURUM)
    await $.tool.call({ tool: ARAC, tool_use_id: 'k7', ozet: 'Sohbet sahnesi', ekip: [uye('Aras', 'usta'), uye('Bora', 'çırak')] })

    const satir = (requestId: string, tool = ARAC) =>
      $.ui.mount({
        plugin: 'feride',
        surface: 'desktop',
        component: 'ToolUse',
        requestId,
        props: { tool_use_id: requestId, tool, input: {}, isRunning: false, isErrored: false, isInterrupted: false },
        viewport: { columns: 120, rows: 40 },
      })

    // Süren işin satırı da, eski bir ekip_kur satırı da, başka araçlar da kendi çizimlerini korur.
    for (const [id, arac] of [['k7', ARAC], ['k1', ARAC], ['k7', 'Read']] as const) {
      const baska = await satir(id, arac)

      expect(await baska.find({ type: 'Svg' })).not.toBeDefined()
      expect(await baska.find({ text: 'motorun satırı' })).toBeDefined()
      await baska.unmount()
    }
  })

  test('terminalde ekip, limit ve atışmalarla çizilir; düğme modu kapatıp açar', async ($, on) => {
    const o = ofis(on, [{ kind: 'five_hour', percentUsed: 40, resetsAt: SIFIRLANMA }])

    await $.session.start(OTURUM)

    const ui = await $.ui.mount({ plugin: 'feride', surface: 'terminal', component: 'Pane', props: PANO, requestId: PANE })

    // Kit Text öğelerinin key'ini bildirmiyor: metinleri içeriğiyle bulunur.
    expect(await ui.find({ type: 'Text', text: /FERİDE · patron/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /5 saat .* %40/ })).toBeDefined()
    expect((await ui.find({ key: 'mod' }))?.props.label).toBe('Modu kapat')

    await $.tool.call({
      tool: ARAC,
      tool_use_id: 'k1',
      ozet: 'Pano işi',
      ekip: [uye('Aras', 'usta'), uye('Bora', 'çırak')],
      atismalar: ['Aras: Bora, o dosyayı ben okudum bile.', 'Bora: Usta maaşıyla okursan olur tabii.'],
    })

    expect(await ui.find({ type: 'Text', text: /İş: Pano işi · aşama 1\/1/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /Aras · Aras rolü/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /usta\/opus/ })).toBeDefined()

    // Atışmalar karelerle döner: birkaç vuruşta en az bir söz balonu çıkar.
    let soz = false

    for (let i = 0; i < 12 && !soz; i += 1) {
      await o.saat.advance(3_000)
      soz = (await ui.find({ type: 'Text', text: /» (Aras|Bora):/ })) !== undefined
    }

    expect(soz).toBe(true)

    await ui.press({ key: 'mod' })
    expect((await ui.find({ key: 'mod' }))?.props.label).toBe('Modu aç')
    expect((await $.prompt.compose({ ...ISTEM, tools: [ARAC] })).sections.map(s => s.id)).toEqual(['intro'])

    await ui.press({ key: 'mod' })
    expect((await ui.find({ key: 'mod' }))?.props.label).toBe('Modu kapat')
    await ui.unmount()
  })

  test('departmanlar kat kat dizilir; başka kattakinin yanına asansörle gidilir', async ($, on) => {
    const o = ofis(on)

    await $.session.start(OTURUM)
    await $.tool.call({
      tool: ARAC,
      tool_use_id: 'k1',
      ozet: 'Katlı iş',
      ekip: [uye('Aras', 'kalfa', 1, false, 'kod'), uye('Bora', 'kalfa', 1, false, 'metin'), uye('Cem', 'çırak', 1, false, 'kod')],
    })

    const ui = await $.ui.mount({ plugin: 'feride', surface: 'desktop', component: 'Pane', props: PANO, requestId: PANE })
    const bina = async (): Promise<string> => String((await ui.findAll({ type: 'Svg' }))[0]?.props.source)
    const ilk = await bina()

    // Yönetim en üstte, her iş türü kendi katında, yanda asansör.
    for (const tabela of ['3. KAT · YÖNETİM', '2. KAT · YAZILIM', '1. KAT · METİN YAZARLIĞI', 'ASANSÖR']) {
      expect(ilk).toEqual(expect.stringContaining(tabela))
    }

    // İş yeni başladı: brifler dağıtılıyor, henüz kimse yerinden kalkmadı.
    expect(ilk).not.toEqual(expect.stringContaining('id="kabin-yolu"'))

    // Ekip çalışmaya başlayınca olaylar sahnenin içinde döner: Feride denetime asansörle iner.
    await $.tool.call({ tool: 'Grep', tool_use_id: 'g1', agentId: 'a1', pattern: 'x' })
    await o.saat.advance(9_000)

    const calisirken = await bina()

    expect(calisirken).toEqual(expect.stringContaining('id="kabin-yolu"'))

    // Saat ilerledi diye sahne yeniden çizilmez: kaynak aynı kalır, panoda yanıp sönme olmaz.
    for (let i = 0; i < 6; i += 1) await o.saat.advance(3_000)
    expect(await bina()).toBe(calisirken)

    // İşin durumu değişince (biri bitirince) sahne yenilenir.
    await $.turn.complete(bitir('a2', 'ÖZET: tamam.'))
    expect(await bina()).not.toBe(calisirken)
    await ui.unmount()
  })

  test('masaüstünde çizgi film sahnesi (SVG) çizilir', async ($, on) => {
    const o = ofis(on, [{ kind: 'five_hour', percentUsed: 20, resetsAt: SIFIRLANMA }])

    await $.session.start(OTURUM)
    await $.tool.call({
      tool: ARAC,
      tool_use_id: 'k1',
      ozet: 'Çizgi film',
      ekip: [uye('Aras', 'usta'), uye('Bora', 'kalfa', 2), uye('Cem', 'çırak', 2)],
    })

    const ui = await $.ui.mount({ plugin: 'feride', surface: 'desktop', component: 'Pane', props: PANO, requestId: PANE })
    // Üstte sahne, altında her üyenin kendi kartı: ayrı ayrı SVG'ler.
    const ilkler = await ui.findAll({ type: 'Svg' })
    const kaynak = String(ilkler[0]?.props.source)
    const arasKarti = String(ilkler[1]?.props.source)

    expect(ilkler).toHaveLength(4)
    expect(kaynak).toEqual(expect.stringContaining('<svg'))
    expect(kaynak).toEqual(expect.stringContaining('PATRON FERİDE'))
    for (const ad of ['Aras', 'Bora', 'Cem']) expect(kaynak).toEqual(expect.stringContaining(ad))
    expect(String(ilkler[0]?.props.alt)).toEqual(expect.stringContaining('Çizgi film'))
    // Her çizim panonun enini doldurur: 80 sütun, sütun başına 7,5 piksel.
    for (const svg of ilkler) expect(svg.props.width).toBe(600)
    expect(String(ilkler[1]?.props.alt)).toEqual(expect.stringContaining('Aras (Aras rolü, usta/opus): çalışıyor'))
    expect(String(ilkler[2]?.props.alt)).toEqual(expect.stringContaining('Bora (Bora rolü, kalfa/sonnet): sırasını bekliyor'))

    // Saat ilerledi diye hiçbir çizim değişmez: yeniden yüklenmez, yanıp sönmez.
    for (let i = 0; i < 4; i += 1) await o.saat.advance(3_000)

    const sonrakiler = await ui.findAll({ type: 'Svg' })

    expect(String(sonrakiler[0]?.props.source)).toBe(kaynak)
    expect(String(sonrakiler[1]?.props.source)).toBe(arasKarti)

    // Üyenin araç çağrısı birkaç saniye geriden yansır: ne yaptığı kartın altında yazıyla,
    // canlandırması işin türüne göre.
    const kart = async (): Promise<string> => String((await ui.findAll({ type: 'Svg' }))[1]?.props.source)

    await $.tool.call({ tool: 'Grep', tool_use_id: 'g1', agentId: 'a1', pattern: 'aramaKutusu' })
    await o.saat.advance(9_000)

    const arayan = await kart()

    expect(arayan).not.toBe(arasKarti)
    expect(await ui.find({ type: 'Text', text: /Aras › Grep: aramaKutusu/ })).toBeDefined()

    // Yeni araç çağrısının yazısı hemen değişir; canlandırma her çağrıda baştan başlamaz,
    // en erken on beş saniye sonra değişir.
    await $.tool.call({ tool: 'Edit', tool_use_id: 'g2', agentId: 'a1', file_path: '/is/src/arama.ts', old_string: 'a', new_string: 'b' })
    await o.saat.advance(9_000)
    expect(await ui.find({ type: 'Text', text: /Aras › Edit: arama\.ts/ })).toBeDefined()
    expect(await kart()).toBe(arayan)

    await o.saat.advance(9_000)
    expect(await kart()).not.toBe(arayan)

    // Şablon düğmesi sıradaki şablona geçer.
    expect((await ui.find({ key: 'sablon' }))?.props.label).toBe('Şablon: orta')
    await ui.press({ key: 'sablon' })
    expect((await ui.find({ key: 'sablon' }))?.props.label).toBe('Şablon: güçlü')

    await $.turn.complete(bitir('a1', 'ÖZET: tamam.\nLAF: Yine ben kurtardım.'))
    expect(o.ajanlar).toHaveLength(3)
    await $.turn.complete(bitir('a2', 'ÖZET: tamam.'))
    await $.turn.complete(bitir('a3', 'ÖZET: tamam.'))

    expect((await ui.find({ key: 'temizle' }))?.props.label).toBe('Panoyu temizle')
    await ui.press({ key: 'temizle' })
    expect(await ui.find({ key: 'temizle' })).not.toBeDefined()
    await ui.unmount()
  })
})
