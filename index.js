const express = require("express");
const cors = require("cors");
const AddProducts = require("./routes/products");
const CartRoutes = require("./routes/carts");



const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use("/products", AddProducts);
app.use("/carts", CartRoutes);


// Test Route
app.get("/", (req, res) => {
  res.send("Backend is running...");
});

// Start Server
const PORT = 5000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
