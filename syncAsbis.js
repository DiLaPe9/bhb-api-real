const axios = require("axios");
const xmlFlow = require("xml-flow");
const Product = require("./productModel");
const xml2js = require("xml2js");
const { Readable } = require("stream");

const ASBIS_PRODUCTS_URL = "https://services.it4profit.com/product/bg/714/ProductList.xml?USERNAME=dipetrov&PASSWORD=Asbisb@nk";
const ASBIS_PRICE_URL = "https://services.it4profit.com/product/bg/714/PriceAvail.xml?USERNAME=dipetrov&PASSWORD=Asbisb@nk";

async function fetchRawXml(url) {
  console.log(`⏳ Fetching raw XML from ${url}...`);
  const { data } = await axios.get(url);
  return data;
}

async function fetchPriceMap() {
  console.log("⏳ Fetching PriceAvail.xml...");
  const raw = await fetchRawXml(ASBIS_PRICE_URL);
  const parsed = await xml2js.parseStringPromise(raw, { explicitArray: false });
  const products = parsed?.PriceAvailability?.Product || [];
  const prices = {};

  for (const item of products) {
    const code = item.ProductCode;
    const price = parseFloat(item.EndUserPrice || 0);
    const stock = parseInt(item.StockQty || 0);
    if (price > 0 && stock > 0) {
      prices[code] = { price, stock };
    }
  }

  console.log(`✅ Loaded ${Object.keys(prices).length} price entries`);
  return prices;
}

async function syncAsbisProducts() {
  try {
    const rawXml = await fetchRawXml(ASBIS_PRODUCTS_URL);
    const priceMap = await fetchPriceMap();
    const stream = new Readable();
    stream.push(rawXml);
    stream.push(null);

    const xmlStream = xmlFlow(stream);
    let counter = 0;

    await Product.deleteMany({ source: "asbis" });
    console.log("🧹 Cleared old ASBIS entries from MongoDB");

    xmlStream.on("tag:Product", async (p) => {
      const code = p.ProductCode;
      if (!priceMap[code]) return;

      const product = {
        sku: code,
        name: p.ProdDescr,
        ean: p.EANCode || "",
        stock: priceMap[code].stock,
        price: priceMap[code].price,
        source: "asbis",
        updatedAt: new Date(),
      };

      try {
        await Product.insertOne(product);
        counter++;
        if (counter % 100 === 0) console.log(`📦 Inserted ${counter} products...`);
      } catch (e) {
        console.error("❌ Error inserting product:", e.message);
      }
    });

    return new Promise((resolve) => {
      xmlStream.on("end", () => {
        console.log(`✅ Sync complete (${counter} products saved)`);
        resolve(counter);
      });
    });
  } catch (err) {
    console.error("❌ Sync failed:", err.message);
    return 0;
  }
}

module.exports = { syncAsbisProducts };