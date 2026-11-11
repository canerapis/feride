/** üstat yalnızca "güçlü" şablonda ve düz metin olmayan zor işlerde verilir. */
export type Seviye = 'ustat' | 'usta' | 'kalfa' | 'cirak'

export type Durum = 'bekliyor' | 'calisiyor' | 'bitti' | 'hata'

/** Ekibin model cömertliği: limit eşikleri, tavan seviye ve ayrılan pay buna göre değişir. */
export type Sablon = 'hafif' | 'orta' | 'guclu'

/** Üyenin işinin türü: düz metin işine en üst model verilmez. */
export type IsTuru = 'metin' | 'kod' | 'arastirma' | 'inceleme' | 'genel'

/** Üyenin o an ne yaptığı (son araç çağrısından): kartındaki animasyonu seçer. */
export type Etkinlik = 'oku' | 'ara' | 'yaz' | 'komut' | 'web' | 'dusun'

export type Uye = {
  id: string
  ad: string
  rol: string
  yetkinlikler: string[]
  /** Feride'nin istediği seviye. */
  istenen: Seviye
  /** Şablona ve limitlere göre verilen seviye. */
  seviye: Seviye
  model: string
  gerekce: string
  asama: number
  gorev: string
  kritik: boolean
  /** Eski sürümün kaydında yoktur: yokken 'genel' sayılır. */
  isTuru?: IsTuru
  durum: Durum
  agentId?: string
  /** Üyenin son araç çağrısı, kartında yazı olarak. */
  sonIs?: string
  etkinlik?: Etkinlik
  rapor?: string
  /** Raporun LAF satırı: iş bitince panoda söylediği söz. */
  laf?: string
  basladi?: number
  bitti?: number
}

export type LimitOkuma = { tur: string; yuzde: number; sifirlanma?: string }

export type Is = {
  id: string
  /** Ekibi kuran ekip_kur çağrısının tool_use_id'si. */
  cagri?: string
  ozet: string
  /** Eski sürümün kaydında yoktur: yokken 'orta' sayılır. */
  sablon?: Sablon
  asama: number
  asamaSayisi: number
  uyeler: Uye[]
  /** Feride'nin bu işe özel yazdığı atışmalar, "Ad: söz". */
  atismalar: string[]
  limitNotu: string
  /** Tahmini harcama, 5 saatlik pencerenin yüzdesi olarak. */
  tahmin: number
  /** Öğrenme katsayısı uygulanmamış tahmin. */
  tabanTahmin: number
  /** İş başlarken 5 saatlik pencerenin dolu yüzdesi; yoksa okunamadı. */
  baslangicYuzde?: number
  baslangicSifirlanma?: string
  basladi: number
  bitti?: number
  durum: 'suruyor' | 'tamam'
  /** Panonun kare sayacı: saat her vuruşta bir artırır. */
  tik: number
}

declare module 'claude-code' {
  interface PluginState {
    feride: {
      acik: boolean
      is: Is | null
      limitler: LimitOkuma[]
      sablon: Sablon
    }
  }
}
