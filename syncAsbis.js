const axios = require("axios");
const sax = require("sax");
const Product = require("./productModel");
const xml2js = require("xml2js");

const ASBIS_PRODUCTS_URL = "https://services.it4profit.com/product/bg/714/ProductList.xml?USERNAME=dipetrov&PASSWORD=Asbisb@nk";
const ASBIS_PRICE_URL = "https://services.it4profit.com/product/bg/714/PriceAvail.xml?USERNAME=dipetrov&PASSWORD=Asbisb@nk";

async function fetchXml(url, name) {
  console.log(`⏳ Fetching ${name}...`);
  const { data } = await axios.get(url);
  console.log(`✅ ${name} fetched (${data.length} bytes)`);
  return await xml2js.parseStringPromise(data, { explicitArray: false });
}

function mapAsbisData(productList, priceList) {
  const prices = {};
  const priceItems = priceList?.PriceAvailability?.Product || [];
  console.log(`✅ Prices loaded (${priceItems.length} entries)`);

  for (const row of priceItems) {
    const price = parseFloat(row.EndUserPrice || 0);
    const stock = parseInt(row.StockQty || 0);
    if (price > 0 && stock > 0) {
      prices[row.ProductCode] = { stock, price };
    }
  }

  const items = [];
  const productItems = productList?.ProductList?.Product || [];
  console.log(`✅ ProductList loaded (${productItems.length} products)`);

  for (const p of productItems) {
    const priceData = prices[p.ProductCode];
    if (!priceData) continue;

    items.push({
      sku: p.ProductCode,
      name: p.ProdDescr,
      ean: p.EANCode || "",
      stock: priceData.stock,
      price: priceData.price,
      source: "asbis",
      updatedAt: new Date(),
    });
  }

  return items;
}

async function syncAsbisProducts() {
  try {
    const productList = await fetchXml(ASBIS_PRODUCTS_URL, "ProductList.xml");
    const priceList = await fetchXml(ASBIS_PRICE_URL, "PriceAvail.xml");

    console.log("⏳ Merging and filtering products...");
    const merged = mapAsbisData(productList, priceList);

    console.log("⏳ Saving to MongoDB...");
    await Product.deleteMany({ source: "asbis" });
    await Product.insertMany(merged);

    console.log(`✅ Sync complete (${merged.length} products saved)`);
    return merged;
  } catch (err) {
    console.error("❌ Sync failed:", err.message);
    return [];
  }
}

module.exports = { syncAsbisProducts };