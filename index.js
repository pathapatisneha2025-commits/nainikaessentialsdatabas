const express = require("express");
const cors = require("cors");
const AddProducts = require("./routes/products");
const CartRoutes = require("./routes/carts");
const UserRoutes = require("./routes/users");
const OrdersRoutes = require("./routes/orders");
const couponsRoutes = require("./routes/coupons");
const codRoutes = require("./routes/cod");



const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use("/products", AddProducts);
app.use("/carts", CartRoutes);
app.use("/users", UserRoutes);
app.use("/orders",OrdersRoutes);
app.use("/coupons",couponsRoutes);
app.use("/cod",codRoutes);


// Test Route
app.get("/", (req, res) => {
  res.send("Backend is running...");
});

// Start Server
const PORT = 5000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
