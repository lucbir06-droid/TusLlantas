const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const { v2: cloudinary } = require('cloudinary');

dotenv.config({ path: './.env' });
dotenv.config({ path: '../tire-image-pipeline/.env' });

const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
const apiKey = process.env.CLOUDINARY_API_KEY;
const apiSecret = process.env.CLOUDINARY_API_SECRET;
if (!cloudName || !apiKey || !apiSecret) {
  console.error('Missing Cloudinary env vars');
  process.exit(2);
}

cloudinary.config({
  cloud_name: cloudName,
  api_key: apiKey,
  api_secret: apiSecret
});

const filePath = path.join(process.cwd(), 'data', 'products.json');
const products = JSON.parse(fs.readFileSync(filePath, 'utf8'));

const normalize = (s) => String(s || '')
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]+/g, '');

const slug = (s) => String(s || '')
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]+/g, '_')
  .replace(/^_+|_+$/g, '')
  .slice(0, 120) || 'tire';

const updatesList = [
  ['P195/45ZR17 JOYROAD SPORT RX6 85W XL','https://www.pirkitpadangas.lt/files/thumbs/196310-3c5ea286d44059892d73f3536416d4e5.jpg'],
  ['P205/70R16 COOPER EVOLUTION SPORT 97H','https://th.bing.com/th/id/R.b53ea199de2a855c915807529a90b278?rik=9MN7zLIZRa32Sw&riu=http%3a%2f%2fwww.tusllantas.com.mx%2fcdn%2fshop%2fproducts%2fEVOLUTIONSPORT_1024x1024_c20dddea-f832-42f2-aed3-553c79fb7ce6.png%3fv%3d1667256813&ehk=rauMLyZhFYH4kywt%2bbMOtsrpmdjYKNx2%2bmtCPHlJ9Ow%3d&risl=&pid=ImgRaw&r=0'],
  ['P145/70R17 MAXXIS 106M TEMPORARY USE ONLY','https://static.tirerack.com/content/dam/tires/maxxis/mx_spare_tire_full.jpg?imwidth=440&impolicy=tow-pdp-main'],
  ['P195/45ZR17 JOYROAD SPORT RX6 85W XL','https://http2.mlstatic.com/D_Q_NP_2X_690390-MLA99421588840_112025-P.webp'],
  ['P205/40R17 ROADCLAW RP570+ 84W XL','https://tse4.mm.bing.net/th/id/OIP.2WiEnTYBtIEuwLxsp6wuDAHaJN?r=0&rs=1&pid=ImgDetMain&o=7&rm=3'],
  ['P215/45ZR17 MILEKING EX-COMFORT 91W XL','https://tse4.mm.bing.net/th/id/OIP.hRcrsF9x_MoOHXpJ1h6nxwHaHa?r=0&rs=1&pid=ImgDetMain&o=7&rm=3'],
  ['P215/55R17 DOUBLEKING DK769 94W','https://th.bing.com/th/id/OIP.Kxh53G-N__f0E65vMtQrcgHaHa?r=0&o=7rm=3&rs=1&pid=ImgDetMain&o=7&rm=3'],
  ['P215/65R17 JOYROAD GRAND TOURER H/T 99V M+S','https://i5.walmartimages.com/asr/df2b5d55-55f9-4e62-b603-d2b2a9c08ab6.60354302cc368f142a1c1af95050f5c8.jpeg?odnHeight=640&odnWidth=640&odnBg=FFFFFF'],
  ['P225/45R17 MICHELIN PRIMACY 4 94W','https://m.media-amazon.com/images/I/71KUC81HorL._AC_SY300_SX300_QL70_ML2_.jpg'],
  ['P225/50R17 ALTENZO COMFORTER 98Y XL','https://static.07zr.com/images/tires/ALTENZO/SPORTCOMFORTER.jpg'],
  ['P235/45R17 VOLCATO CONTROL V300 97W XL','https://th.bing.com/th/id/OIP.a3UqD6oftL25XSoadhkK_AHaHa?r=0&o=7rm=3&rs=1&pid=ImgDetMain&o=7&rm=3'],
  ['P235/45ZR17 GT RADIAL CHAMPIRO UHP AS 97W','https://tse3.mm.bing.net/th/id/OIP.fhTx4pqlEmgXAMicFmS-FgHaHa?r=0&rs=1&pid=ImgDetMain&o=7&rm=3'],
  ['P235/50ZR17 VOLCATO SAFY S06 100W','https://http2.mlstatic.com/D_NQ_NP_2X_943802-MLM93741950423_092025-F.webp'],
  ['P235/55R17 TERCELO SPORT D1 103W','https://tse2.mm.bing.net/th/id/OIP.f5RbtfsZ4uvosuCWKRgVZgAAAA?r=0&rs=1&pid=ImgDetMain&o=7&rm=3'],
  ['P235/55R17 ALTENZO COMFORTER 103Y XL','https://static.tyres.net/s/content-synced/pq96/14/959614_a6387087_big.jpg'],
  ['P235/60R17 BLACKHAWK HH11VT 102T','https://http2.mlstatic.com/D_NQ_NP_2X_617646-MLA80972876666_122024-F.webp'],
  ['P245/40ZR17 SUMITOMO HTRZIII 95Y XL','https://http2.mlstatic.com/D_NQ_NP_2X_676635-MLA99876803001_112025-F.webp'],
  ['LT245/65R17 BLACKARROW RT1 R/T RUG TERRAIN 111/108Q','https://tse4.mm.bing.net/th/id/OIP.0d3yXM8d_SVTACW3K7_qmAHaHa?r=0&rs=1&pid=ImgDetMain&o=7&rm=3'],
  ['LT265/65R17 BLACKARROW RT1 R/T RUG TERRAIN 120/117Q','https://http2.mlstatic.com/D_NQ_NP_2X_979701-MLA99337028852_112025-F.webp'],
  ['P265/65R17 MIRAGE MR-AR172 A/T ALL TERRAIN 112T','https://http2.mlstatic.com/D_NQ_NP_2X_700857-MLM49031410428_022022-F.webp'],
  ['P265/70R17 BROADPEAK AKVENT R/T VT 115S','https://http2.mlstatic.com/D_NQ_NP_2X_634363-MLM99980693949_112025-F.webp'],
  ['LT265/70R17 MIRAGE MR-MT172 M/T MUD TERRAIN TIPO 4X4 121/118Q','https://tse4.mm.bing.net/th/id/OIP.XH2zlRbfbzzi2UlQmiRn9QHaHa?r=0&rs=1&pid=ImgDetMain&o=7&rm=3'],
  ['LT285/70R17 BROADPEAK AKVEN R/T RUG TERRAIN VT 123Q','https://tse1.mm.bing.net/th/id/OIP.Pu6BRA-Try2noJuW12nKeAHaKO?r=0&rs=1&pid=ImgDetMain&o=7&rm=3'],
  ['LT33X12.50R17 FRONWAY ROCKBLADE M/T MUD TERRAIN 120Q 10PR','https://http2.mlstatic.com/D_NQ_NP_2X_817732-MLM92874646183_092025-F.webp'],
  ['LT7.50R17 BROADPEAK BPB200 ST','https://http2.mlstatic.com/D_NQ_NP_2X_718858-MLA99822237581_112025-F.webp'],
  ['P215/35R18 BCT S800 DIRECCIONALES 84W XL','https://http2.mlstatic.com/D_NQ_NP_2X_627024-MLM92509371651_092025-F.webp'],
  ['P215/45R18 TOYO PROXESS A40A 89V','https://prodynamics.vtexassets.com/arquivos/ids/178384-1200-auto?v=638161350327200000&width=1200&height=auto&aspect=true'],
  ['P215/55R18 ALFAMOTORS DK365 95H','https://i5.walmartimages.com/asr/b53c7ca7-1f02-49f2-9586-63eb3d6e6ce0.ff58f7879db5edc0be5f1e5991d38f63.jpeg?odnHeight=640&odnWidth=640&odnBg=FFFFFF'],
  ['P215/55R18 VOLCATO V600 99W XL','https://http2.mlstatic.com/D_NQ_NP_2X_717809-MLM93735080479_092025-F.webp'],
  ['P225/40ZRF18 SONIX L-ZEAL56 92W XL','https://i5.walmartimages.com/asr/8d8a9201-9ec5-4c06-b51c-a1794b2c07e4.e795c8bf2cb89b509041124b2962910e.jpeg?odnHeight=640&odnWidth=640&odnBg=FFFFFF'],
  ['P225/40ZR18 FORCELAND VITALY F22 92Y XL','https://http2.mlstatic.com/D_NQ_NP_2X_911982-MLA99880661561_112025-F.webp'],
  ['P225/45R18 ALTENZO COMFORTER 95W XL','https://i5.walmartimages.com/asr/53736542-a44c-42ff-b367-5f016b177782.02bfbb2dd9ed24be5d7be8d039eba55e.png?odnHeight=640&odnWidth=640&odnBg=FFFFFF'],
  ['P225/60R18 HIFLY VIGOROUS HP801 100V','https://i5.walmartimages.com/asr/a03188ff-e8b1-4950-9599-f158ebdb2e15.03489dfab45021a23008e9f6de710d0f.jpeg?odnHeight=640&odnWidth=640&odnBg=FFFFFF'],
  ['P235/45ZR18 JOYROAD SPORT RX6 98W XL','https://i5.walmartimages.com/asr/059ffb75-1f0f-4f13-beab-e5f3c5b6b23c.100fdc790014d6bc7baa0c0bb265c567.png?odnHeight=640&odnWidth=640&odnBg=FFFFFF'],
  ['P235/55R18 VOLCATO ECO SA01 104W','https://dcdn-us.mitiendanube.com/stores/006/927/349/products/042ae7dc-e17fd73c8540e258c517749733505898-1024-1024.webp'],
  ['P235/60R18 VOLCATO ESECO V600 107V XL','https://th.bing.com/th/id/OIP.9yZJmkw4uNOB0Jb_SrSfKwHaLt?r=0&o=7rm=3&rs=1&pid=ImgDetMain&o=7&rm=3'],
  ['P245/45R18 TRANSMATE TRANSENERUS ECO 100W','https://i5.walmartimages.com/asr/e8785d72-ed9c-47cf-9ad2-cc90c8ec3ac3.a831cc75bcb0d554f2633828650445e8.jpeg?odnHeight=640&odnWidth=640&odnBg=FFFFFF'],
  ['P255/55R18 ROYAL BLACK RACING TRAC 109W XL','https://cdn11.bigcommerce.com/s-e8i94i2k1a/images/stencil/500x659/products/206657/1663218/royal-black-racing-trac-b-aaa1-1__80173.1756917296.jpg?c=2'],
  ['P265/60R18 BLACKHAWK RIGGER R/T LB 114Q XL','https://tse3.mm.bing.net/th/id/OIP.jngdI7e-PYzr4UcX9S9r0QHaHa?r=0&rs=1&pid=ImgDetMain&o=7&rm=3'],
  ['P235/45ZR19 VOLCATO CONTROL V300 95V','https://http2.mlstatic.com/D_NQ_NP_2X_910377-MLM93077662212_092025-F.webp'],
  ['P235/50ZR19 VOLCATO SAFY S06 103W','https://http2.mlstatic.com/D_NQ_NP_2X_720778-MLM93742227171_092025-F.webp'],
  ['P255/50R19 ROADKING ARGOS UHP 107Y','https://i5.walmartimages.com/asr/9664159f-6479-4d3d-91cc-5785e6cc307d.b436e0ac6de1daa71049ea88b420f8e0.png?odnHeight=640&odnWidth=640&odnBg=FFFFFF'],
  ['P245/45R20 MAXTREK SIERRA S6 99V','https://www.misterllantas.com/media/catalog/product/cache/860b7a2c70b7e271930e7a9c3934662d/m/a/maxtrek-sierra-s6_47.jpg'],
  ['P255/45ZR20 VOLCATO SAFY 06 105W','https://http2.mlstatic.com/D_NQ_NP_2X_943802-MLM93741950423_092025-F.webp'],
  ['P265/50R20 THREEA SHARK Z02 111W','https://i5.walmartimages.com/asr/2d86aec0-1650-4732-b9f2-12f650ff5ca1.bfaa2b6f7b3f028ca1a15570860dd14a.jpeg?odnHeight=640&odnWidth=640&odnBg=FFFFFF'],
  ['LT275/55R20 LCH TYRES EXTREME PRO 120/117 Q 8PR','https://http2.mlstatic.com/D_NQ_NP_2X_836623-MLA83204346593_032025-F.webp'],
  ['LT275/65R20 GOODYEAR WRANGLER DURATRAC ATR 126/123Q M+S 10PR','https://prodynamics.vtexassets.com/arquivos/ids/197416-1200-auto?v=638830193291070000&width=1200&height=auto&aspect=true'],
  ['P295/35R21 POWERTRAC CITYRACING 107W XL','https://cdn11.bigcommerce.com/s-e8i94i2k1a/images/stencil/500x659/products/191290/1564086/powertrac-cityracing-b-aaa-1__00200.1775527388.jpg?c=2'],
  ['P285/45R22 SONIX PRIME MASTER R/T TIPO 4X4 114W','https://i5.walmartimages.com/asr/fff67fbd-1e94-4973-98b6-71d58c2afb79.046da1310acab79a07c42ed91f5743f5.png?odnHeight=640&odnWidth=640&odnBg=FFFFFF'],
  ['P305/35R24 FULLRUN F700 ML 112W XL','https://http2.mlstatic.com/D_NQ_NP_2X_731671-MLM89664814011_082025-F.webp'],
  ['LT285/75R24.5 MIRAGE MG111 DIRECCION','https://tse3.mm.bing.net/th/id/OIP.qGNJ3oTPspAdEOJVSCm4fQHaKx?r=0&rs=1&pid=ImgDetMain&o=7&rm=3'],
  ['LT11R24.5 GOLDEN CROWN AD185 TRACCION','https://i5.walmartimages.com/asr/7b3360ab-5cc3-4ae5-8ecf-203cd55a8636.1fe5c69b63df5efe87a99ff2d606e053.jpeg?odnHeight=640&odnWidth=640&odnBg=FFFFFF'],
  ['LT11R24.5 ROYAL BLACK RD808 152/149L TRACCION','http://es.royalblacktyre.com/upload/big/1_24_1563452982.jpg'],
  ['LT285/75R24.5 MIRAGE MG312 TRACCION','https://http2.mlstatic.com/D_NQ_NP_2X_877189-MLM84206935977_042025-F.webp']
];

const deduped = new Map();
for (const [name, url] of updatesList) {
  deduped.set(name, String(url).trim().replace(/\|+$/, ''));
}

const normIndexMap = new Map();
products.forEach((p, i) => {
  normIndexMap.set(normalize(p.name), i);
});

(async () => {
  const migrated = [];
  const failed = [];
  const notFound = [];

  for (const [requestedName, url] of deduped.entries()) {
    let idx = products.findIndex((p) => p.name === requestedName);
    if (idx < 0) {
      idx = normIndexMap.has(normalize(requestedName)) ? normIndexMap.get(normalize(requestedName)) : -1;
    }

    if (idx < 0) {
      notFound.push(requestedName);
      continue;
    }

    const actualName = products[idx].name;
    try {
      const result = await cloudinary.uploader.upload(url, {
        folder: 'tires',
        public_id: `tires/${slug(actualName)}`,
        overwrite: true,
        fetch_format: 'webp',
        quality: 'auto'
      });
      products[idx].image = result.secure_url;
      migrated.push(actualName);
    } catch (err) {
      failed.push({
        requestedName,
        matchedName: actualName,
        url,
        error: err.message
      });
    }
  }

  fs.writeFileSync(filePath, `${JSON.stringify(products, null, 2)}\n`);
  console.log(`requested=${deduped.size}`);
  console.log(`migrated=${migrated.length}`);
  console.log(`not_found=${notFound.length}`);
  console.log(`failed=${failed.length}`);
  if (notFound.length) {
    console.log(`not_found_items=${JSON.stringify(notFound)}`);
  }
  if (failed.length) {
    console.log(`failed_items=${JSON.stringify(failed.slice(0, 20))}`);
  }
})();
