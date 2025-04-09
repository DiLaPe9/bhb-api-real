
const mongoose = require("mongoose");
const axios = require("axios");
const xmlFlow = require("xml-flow");
const Product = require("./models/Product");
require("dotenv").config();

const MONGO_URI = process.env.MONGO_URI;

async function syncAsbis() {
  console.log("🚀 Starting ASBIS sync...");
  try {
    await mongoose.connect(MONGO_URI);
    console.log("✅ Connected to MongoDB");

    const productUrl = "https://services.it4profit.com/product/bg/714/ProductList.xml?USERNAME=dipetrov&PASSWORD=Asbisbank";
    const priceUrl = "https://services.it4profit.com/product/bg/714/PriceAvail.xml?USERNAME=dipetrov&PASSWORD=Asbisbank";

    console.log("⏳ Fetching ProductList.xml...");
    const productResponse = await axios.get(productUrl, { responseType: "stream" });
    const productStream = xmlFlow(productResponse.data);

    const products = {};

    productStream.on("tag:PRICE", (item) => {
      if (item && item.WIC && item.DESCRIPTION) {
        products[item.WIC] = {
          sku: item.WIC,
          name: item.DESCRIPTION,
          brand: item.VENDOR_NAME || "",
          image: item.SMALL_IMAGE || "",
          product_url: item.PRODUCT_CARD || "",
          ean: item.EAN || "",
        };
      }
    });

    await new Promise((resolve) => productStream.on("end", resolve));

    console.log("⏳ Fetching PriceAvail.xml...");
    const priceResponse = await axios.get(priceUrl, { responseType: "stream" });
    const priceStream = xmlFlow(priceResponse.data);

    const finalProducts = [];

    priceStream.on("tag:PRICE", (entry) => {
      const wic = entry.WIC;
      const product = products[wic];
      if (!product) return;

      const availability = (entry.AVAIL || "").trim().toLowerCase();
      const price = parseFloat(entry.MY_PRICE);
      if (availability === "да" && price > 0) {
        finalProducts.push({
          ...product,
          price: price,
          stock: 1,
          source: "asbis",
          currency: (entry.CURRENCY_CODE || "USD").trim()
        });
      }
    });

    await new Promise((resolve) => priceStream.on("end", resolve));
    console.log(`✅ Loaded ${finalProducts.length} entries`);

    await Product.deleteMany({ source: "asbis" });
    await Product.insertMany(finalProducts);
    console.log("📦 Synced ASBIS products successfully!");

    mongoose.disconnect();
  } catch (err) {
    console.error("❌ Sync error:", err);
  }
}

syncAsbis();
