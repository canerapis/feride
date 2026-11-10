# Feride modu

Feride modu, Claude Code'a bir patron ekler: Feride. Ona bir iş verirsiniz, o da işe göre Clawd adlı alt ajanlardan oluşan bir ekip kurar. Her üyenin modelini kalan kullanım limitinize bakarak seçer. Ekibin çalışması ofis panosunda çizgi film gibi izlenir: Feride masasında oturur, Clawd'lar işlerini yapar. Üyeler arasında esprili atışmalar da eksik olmaz.

## Kurulum

Claude Code terminalinde, istem satırına:

```
/plugin install feride --marketplace canerapis/feride
```

Pazar yerini eklemek için `y`, sonra kapsam olarak kullanıcı (user) kapsamını seçin. Mod o oturumda hemen, sonra her yeni oturumda kendiliğinden çalışır.

Kabuktan:

```bash
claude plugin install feride --marketplace canerapis/feride
```

Masaüstü uygulamasında (`/plugin` orada çalışmaz): istem kutusunun yanındaki **+** → **Plugins** → **Add marketplace** ile `canerapis/feride` ekleyin, sonra **Add plugin**.

Güncellemek için: `claude plugin update feride`.

## Kullanım

Tüm komutlar `/feride` ile başlar:

- `/feride <iş tanımı>`: Modu (kapalıysa) açar, panoyu gösterir ve işi Feride'ye verir. Feride ekibi kendisi kurar.
- `/feride aç`: Modu ve panoyu açar. (`ac` ve `on` da çalışır.)
- `/feride kapat`: Modu ve panoyu kapatır. (`kapa` ve `off` da çalışır.)
- `/feride durum`: Mod durumunu, işi, aşamayı, üyeleri, limit kararını ve limit yüzdelerini yazar.
- `/feride sıfırla`: İş kaydını siler. Mod açık ya da kapalı kalmaya devam eder. (`sifirla` da çalışır.)
- `/feride` (boş): Mod kapalıysa açar, panoyu gösterir ve kısa bir kullanım ipucu verir.

## Model seçimi

Üyeler üç seviyeden birinde çalışır ve her seviyenin modeli sabittir:

| Seviye | Model |
| --- | --- |
| usta | opus |
| kalfa | sonnet |
| çırak | haiku |

Feride önce işin istediği seviyeyi verir, sonra limite göre gerekirse düşürür. Karar, 5 saatlik ve 7 günlük pencerelerden kalan en düşük yüzdeye göre verilir:

- Kalan %15'in altındaysa herkes çırak olur.
- Kalan %30'un altındaysa en fazla kalfa seviyesi verilir.
- Kalan %60'ın altındaysa en fazla bir usta kalır (kritik üye varsa o).
- 5 saatlik pencere 20 dakikadan kısa sürede sıfırlanıyorsa kalan en az %70 sayılır.

Feride ayrıca harcamayı tahmin eder (usta 3, kalfa 1, çırak 0,3 birim, bir katsayıyla çarpılır). Tahmin bütçeyi aşarsa önce kritik olmayan, sonra en pahalı üye bir kademe düşürülür. Katsayı her iş bitiminde ölçülen kullanıma göre güncellenir; ekip dışındaki paralel kullanım ölçümü şişirebilir. Limit bilgisi okunamazsa seviyeler olduğu gibi verilir ve notta "Limit bilgisi okunamadı" yazar.

## Ofis panosu

Pano terminalde metin olarak çizilir: Feride'nin sözü, iş ve aşama, limit çubukları, üye satırları ve konuşmalar. Masaüstünde aynı bilgiler SVG bir ofis olarak görünür: Feride masasında, konuşma balonu, limit paneli, iş şeridi, aşama noktaları ve rozetli Clawd'larla.

Sahne yan bölmedeki "Feride'nin Ofisi" panosunda görünür ve panonun boyuna göre uzar: dar ve uzun panoda küçük ekipler tek sütunda, daha iri çizilir. Sohbet kalabalık olmasın diye sahne sohbetin içinde çizilmez.

Pano iki düğme taşır: "Modu aç" / "Modu kapat" ve iş bittiğinde görünen "Panoyu temizle". "Panoyu temizle", `/feride sıfırla` ile aynı şeyi yapar.

## Notlar

- Üyeler arka planda çalışır. Aynı aşamadakiler paralel ilerler, sonraki aşama öncekinin raporlarını alır. Bir aşamada kimse iş çıkaramazsa sonraki aşama başlatılmaz.
- Ekibin raporları tek bir "FERİDE EKİP RAPORU" mesajı olarak gelir.
- Otomatik izin modunda üyeler başlatılamayabilir: ajanı model değil mod başlattığı için izin sınıflandırıcısı karar veremez. Bu durumda oturumu "Düzenlemeleri kabul et" ya da "İzin iste" moduna alın.
- Mod kapalıyken Feride ekip kuramaz; ekip kurma isteği reddedilir. `/feride kapat` ile modu istediğiniz an kapatabilir, `/feride aç` ile geri çağırabilirsiniz.
- Boş `/feride` komutu mod kapalıysa modu da açar.
