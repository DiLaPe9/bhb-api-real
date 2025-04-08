require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const { syncAsbisProducts } = require("./syncAsbis");
const Product = require("./productModel");

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
});
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => console.log("✅ Connected to MongoDB"))
  .catch((err) => console.error("❌ MongoDB error:", err));

// Products endpoint
app.get("/api/products", async (req, res) => {
  const products = await Product.find({ source: "asbis" }).limit(1000);
  res.json(products);
});

// Trigger sync
app.get("/api/sync", async (req, res) => {
  const result = await syncAsbisProducts();
  res.json({ status: "Synced", total: result.length });
});

app.listen(PORT, () => {
  console.log("🚀 Server running on port", PORT);
});