const express = require("express");
const cors = require("cors");
const AddProducts = require("./routes/products");
const Cart = require("./routes/cartroute");
const OrdersRoute = require("./routes/ordersroute");
const UsersRoute = require("./routes/userroute");


const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use("/products", AddProducts);
app.use("/cart", Cart);
app.use("/orders",OrdersRoute);
app.use("/user",UsersRoute);


// Test Route
app.get("/", (req, res) => {
  res.send("Backend is running...");
});

// Start Server
const PORT = 5000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
