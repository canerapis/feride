# Feride modu

Feride modu, Claude Code'a bir patron ekler: **Feride**. Ruhsuz, işkolik bir ajans patronu ve müşteri temsilcisi. Ona bir iş verirsiniz, o da işi parçalara böler ve Clawd adlı alt ajanlardan bir ekip kurar. Her üyenin modelini kalan kullanım limitinize bakarak seçer. Ekip çalışırken yan paneldeki ofiste olup biteni çizgi film gibi izlersiniz: Feride masasında oturur, Clawd'lar çalışır ve birbirine laf sokar. İş bitince bütün raporlar Feride'ye gelir, o da size tek, derli toplu bir sonuç sunar.

> Feride ekibine karşı serttir; size, yani müşterisine karşı ironik ama saygılıdır. Sertlik yalnızca üsluptadır, sonuçlar her zaman ciddidir.

## İçindekiler

- [Gerekenler](#gerekenler)
- [Kurulum](#kurulum)
- [İlk kullanım: 3 adımda](#ilk-kullanım-3-adımda)
- [Komutlar](#komutlar)
- [İş verme örnekleri](#iş-verme-örnekleri)
- [Ofis paneli](#ofis-paneli)
- [Model seçimi ve limitler](#model-seçimi-ve-limitler)
- [Sorun giderme](#sorun-giderme)
- [Güncelleme ve kaldırma](#güncelleme-ve-kaldırma)

## Gerekenler

- [Claude Code](https://claude.com/claude-code): terminalde, masaüstü uygulamasında ya da VS Code'da.
- Bir Claude aboneliği (Pro veya Max). Feride limite göre karar verdiği için abonelikle en iyi çalışır. Limit bilgisi okunamazsa, örneğin API anahtarıyla, istenen seviyeleri olduğu gibi verir.

## Kurulum

### Terminalde (Claude Code içinde)

İstem satırına yazın:

```
/plugin install feride --marketplace canerapis/feride
```

Pazar yerini eklemek isteyip istemediğiniz sorulursa `y` deyin, kapsam olarak **user** (kullanıcı) seçin. Böylece Feride bütün projelerinizde çalışır.

### Kabuktan (Claude Code'u açmadan)

```bash
claude plugin install feride --marketplace canerapis/feride
```

### Masaüstü uygulamasında

`/plugin` komutu masaüstü uygulamasında çalışmaz. Onun yerine:

1. İstem kutusunun yanındaki **+** düğmesine tıklayın.
2. **Plugins** → **Add marketplace** seçin ve `canerapis/feride` yazın.
3. Listede çıkan **feride** için **Add plugin** seçin.

### Kurulduğunu kontrol edin

```bash
claude plugin list
```

Listede `feride` görünmeli. Açık bir oturumunuz varsa eklentiyi yüklemek için `/reload-plugins` çalıştırın ya da yeni bir oturum açın.

## İlk kullanım: 3 adımda

**1. Paneli açın.**

```
/feride aç
```

Yan bölmede "Feride'nin Ofisi" paneli açılır. Ekip yokken Feride masasında oturur, üç Clawd da sırasını beklerken uyuklar.

**2. Bir iş verin.** İki yolu var:

```
/feride Bu projedeki README'yi kodla karşılaştır, eskimiş yerleri listele
```

ya da mod açıkken Claude'a normal bir mesaj yazın:

```
Bu klasördeki Python dosyalarına birim testleri yaz ve çalıştır
```

Feride gerçek bir iş gördüğünde ekibi kendisi kurar. Selamlaşma, tek satırlık soru ya da küçük düzeltme için ekip kurmaz, kendisi yanıtlar.

**3. İzleyin ve raporu bekleyin.** Feride ekibi birkaç cümleyle tanıtır: kim ne yapacak, hangi modelle. Sonra ekip arka planda çalışır, siz panelden izlersiniz. Herkes bitirince "FERİDE EKİP RAPORU" gelir. Feride raporları değerlendirir, çelişkileri giderir, küçük eksikleri kendisi tamamlar ve size tek bir sonuç sunar.

## Komutlar

| Komut | Ne yapar |
| --- | --- |
| `/feride <iş tanımı>` | Modu açar (kapalıysa), paneli gösterir ve işi Feride'ye verir. |
| `/feride` | Modu açar (kapalıysa), paneli gösterir, kısa bir ipucu verir. |
| `/feride aç` | Modu ve paneli açar. `ac` ve `on` da çalışır. |
| `/feride kapat` | Modu ve paneli kapatır. Yeni ekip kurulmaz; çalışan bir ekip varsa işini bitirir. `kapa` ve `off` da çalışır. |
| `/feride durum` | Mod durumunu, işi, aşamayı, üyeleri, limit kararını ve limit yüzdelerini yazar. |
| `/feride sıfırla` | İş kaydını ve panoyu temizler. Mod açık ya da kapalı, olduğu gibi kalır. `sifirla` da çalışır. |

Mod açık mı kapalı mı, oturumlar arasında hatırlanır. `/feride kapat` dediyseniz yeni oturumlarda da kapalı kalır, ta ki `/feride aç` diyene kadar.

## İş verme örnekleri

Feride işi birbirinden bağımsız görevlere böler. Aynı aşamadaki üyeler paralel çalışır, sonraki aşama öncekilerin raporlarını kendiliğinden alır. Şöyle işler iyi gider:

- **Kod incelemesi:** `/feride src/ klasörünü güvenlik açısından incele, bulguları önem sırasına koy`
- **Test yazma:** `/feride utils.py için birim testleri yaz, çalıştır, başarısız olanları raporla`
- **Araştırma:** `/feride Python'da asenkron HTTP istemcilerini karşılaştır, bir tablo hazırla`
- **Belge:** `/feride Bu projenin README'sini baştan yaz: kurulum, kullanım, örnekler`
- **İçerik:** `/feride Kurgusal bir kahve markası için slogan, sosyal medya metni ve radyo spotu hazırla`

İpuçları:

- İşi ne kadar net tarif ederseniz ekip o kadar iyi çalışır: dosya yolları, kısıtlar, beklenen çıktı.
- Üyeler sizin konuşmanızı görmez, yalnızca Feride'nin yazdığı görevi görür. Önemli bir ayrıntı varsa iş tanımına yazın.
- Ekip en çok 8 kişidir. Çoğu iş için Feride 2-5 kişi seçer.
- Bir ekip çalışırken ikinci bir ekip kurulamaz. Önce mevcut işin bitmesini bekleyin.

## Ofis paneli

Masaüstü uygulamasında panel animasyonlu bir ofistir: Feride masasında, konuşma balonu, limit panosu, iş şeridi, aşama noktaları ve rozetli Clawd'lar. Terminalde aynı bilgiler metin ve karakterlerle çizilir.

- Panel boyuna göre uzar. Dar ve uzun panelde küçük ekipler tek sütunda, daha iri çizilir.
- Her Clawd'ın rozeti seviyesini ve modelini gösterir. Çalışırken son yaptığı iş düşünce balonunda görünür.
- Clawd'lar birbirine laf atar; Feride de araya girip azarlar. İş bitince her üye raporundaki "LAF" satırını söyler.
- Sahne yalnızca panelde çizilir, sohbetin içinde çizilmez; sohbet sade kalır.
- Panelde iki düğme var: **Modu aç / Modu kapat** ve iş bitince çıkan **Panoyu temizle** (`/feride sıfırla` ile aynı).

## Model seçimi ve limitler

Her üye üç seviyeden birinde çalışır:

| Seviye | Model | Ne için |
| --- | --- | --- |
| usta | opus | Mimari, zor akıl yürütme, son kalite kontrolü |
| kalfa | sonnet | Uygulama, yazım, inceleme |
| çırak | haiku | Tarama, arama, özet, mekanik iş |

Feride önce işin istediği seviyeyi seçer, sonra limite bakıp gerekirse düşürür. Karar, 5 saatlik ve 7 günlük pencerelerden kalan **en düşük** yüzdeye göre verilir:

- Kalan %15'in altındaysa herkes çırak olur.
- Kalan %30'un altındaysa en fazla kalfa verilir.
- Kalan %60'ın altındaysa en fazla bir usta kalır (kritik işaretli üye varsa o).
- 5 saatlik pencere 20 dakikadan kısa sürede sıfırlanacaksa kalan en az %70 sayılır.

Feride ayrıca ekibin harcamasını tahmin eder: usta 3, kalfa 1, çırak 0,3 birim, ölçülen bir katsayıyla çarpılır. Bütçe, 5 saatlik pencerede kalanın yarısı ile diğer pencerede kalanın 2,5 katından küçük olanıdır. Harcama limitiniz varsa o da hesaba katılır. Tahmin bütçeyi aşarsa önce kritik olmayan, sonra en pahalı üye bir kademe düşürülür. Katsayı, iş aynı 5 saatlik pencerede bittiyse ölçülen kullanıma göre güncellenir. Aynı anda başka işler de yapıyorsanız ölçüm şişebilir.

Ekibi kurarken Feride size limit kararını da söyler. Örneğin: "dar boğaz %18: tavan kalfa · tahmini harcama ≈ %2".

## Sorun giderme

**Panel görünmüyor.** `/feride aç` yazın. Hâlâ yoksa `/reload-plugins` çalıştırın ya da yeni bir oturum açın.

**Feride ekip kurmuyor, işi kendisi yapıyor.** Mod kapalı olabilir: `/feride durum` ile bakın, gerekirse `/feride aç` deyin. İş çok küçükse Feride bilerek ekip kurmaz. Ekip istiyorsanız işi `/feride <iş>` diye verin.

**Üyeler "BAŞLAMADI" diyor.** Otomatik izin modunda ajanları model değil eklenti başlattığı için izin sınıflandırıcısı karar veremeyebilir. Oturumu **Düzenlemeleri kabul et** ya da **İzin iste** moduna alıp tekrar deneyin.

**"Ekip çalışırken ikinci ekip kurulmaz" hatası.** Önceki iş sürüyor. `/feride durum` ile bakın; takılı kaldıysa `/feride sıfırla` ile kaydı temizleyin.

**Limit bilgisi okunamadı.** Abonelik dışı bir oturumdasınız, örneğin API anahtarıyla. Feride çalışmaya devam eder, yalnızca seviyeleri limite göre düşüremez.

## Güncelleme ve kaldırma

Güncellemek için:

```bash
claude plugin update feride
```

Bir süre kullanmayacaksanız kaldırmak yerine kapatabilirsiniz:

```bash
claude plugin disable feride
```

Tamamen kaldırmak için:

```bash
claude plugin uninstall feride
```

## Lisans

[MIT](LICENSE)
