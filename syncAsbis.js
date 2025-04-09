
const mongoose = require('mongoose');
const xmlFlow = require('xml-flow');
const fs = require('fs');
const path = require('path');
const Product = require('./productModel'); // mongoose модел

require('dotenv').config();
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const stream = fs.createReadStream(path.join(__dirname, 'ProductList.xml'));
const xml = xmlFlow(stream);

let savedCount = 0;
let skippedCount = 0;

xml.on('tag:PRICE', async function (item) {
  try {
    const price = parseFloat(item.MY_PRICE);
    const availability = item.AVAIL && item.AVAIL.trim().toLowerCase() === 'да';

    if (!availability || isNaN(price) || price <= 0) {
      skippedCount++;
      return;
    }

    const product = {
      sku: item.WIC,
      name: item.DESCRIPTION,
      price: price,
      currency: item.CURRENCY_CODE || 'USD',
      stock: availability ? 1 : 0,
      vendor: item.VENDOR_NAME,
      image: item.SMALL_IMAGE || '',
      productCard: item.PRODUCT_CARD || '',
      ean: item.EAN || '',
      group: item.GROUP_NAME || '',
    };

    await Product.updateOne({ sku: product.sku }, product, { upsert: true });
    savedCount++;
  } catch (error) {
    console.error('❌ Error saving product:', error.message);
  }
});

xml.on('end', () => {
  console.log(`✅ Sync complete. Saved: ${savedCount}, Skipped: ${skippedCount}`);
  mongoose.disconnect();
});
