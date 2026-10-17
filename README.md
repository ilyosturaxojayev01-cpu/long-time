# Ombor tizimi (React + Express)

## Ishga tushirish
Terminal 1:  cd server && npm install && npm start      # http://localhost:4000
Terminal 2:  cd client && npm install && npm run dev    # http://localhost:5173

## Kirish
administrator: admin / admin123
xodim:         xodim / xodim123

## Qoidalar
- 18 kategoriya, har birida 5 tadan mahsulot (jami 90).
- Har 6 soatda 12 tuman do'konlaridan tasodifiy kategoriya bo'yicha so'rov keladi ("Ombor xabarlari").
- Administrator: Tasdiqlash / Rad etish. Tasdiqlansa "Buyurtma yo'lda" + Sergeli ombordan tumangacha taxminiy vaqt (Yashnobod = 60 daq.).
- Ta'minot: administrator istalgan vaqtda zavodga buyurtma beradi (kategoriya -> mahsulot yoki yangi mahsulot -> soni), 2 soatda keladi. Yangi mahsulot katalogga avtomatik qo'shiladi.
- Xodim: Mahsulotlar, Kirim, Chiqim, Ombor xabarlari, Hodisalar. Boshqaruv paneli, Ta'minot, Xodimlar faqat administratorga.
- Test uchun so'rovlar tezligini o'zgartirish: GEN_HOURS=0.05 npm start (har ~3 daqiqada). Eski ma'lumotlarni tozalash uchun server/data.json ni o'chiring.
- Barcha kirim/chiqim narx bilan hisoblanadi (zavod narxi = kirim, sotuv narxi = chiqim). Barcha vaqtlar Asia/Tashkent (UTC+5).
- Ma'lumotlar server/data.json da saqlanadi (o'chirsangiz qayta yaratiladi).

- Administrator: mahsulot va xodimlarni o'zgartirish/o'chirish, zavodga berilgan (hali kelmagan) buyurtmani bekor qilish. Xodim buni ko'rmaydi (server ham rad etadi).
