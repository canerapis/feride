export type Seviye = 'usta' | 'kalfa' | 'cirak'

export type Durum = 'bekliyor' | 'calisiyor' | 'bitti' | 'hata'

export type Uye = {
  id: string
  ad: string
  rol: string
  yetkinlikler: string[]
  /** Feride'nin istediği seviye. */
  istenen: Seviye
  /** Limitlere göre verilen seviye. */
  seviye: Seviye
  model: string
  gerekce: string
  asama: number
  gorev: string
  kritik: boolean
  durum: Durum
  agentId?: string
  /** Üyenin son araç çağrısı, panoda düşünce balonu olarak. */
  sonIs?: string
  rapor?: string
  /** Raporun LAF satırı: iş bitince panoda söylediği söz. */
  laf?: string
  basladi?: number
  bitti?: number
}

export type LimitOkuma = { tur: string; yuzde: number; sifirlanma?: string }

export type Is = {
  id: string
  /** Ekibi kuran ekip_kur çağrısının tool_use_id'si: sohbetteki satırı canlı sahne olur. */
  cagri?: string
  ozet: string
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
    }
  }
}
