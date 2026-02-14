const express = require("express");
const router = express.Router();
const pool = require("../db");
const Razorpay = require("razorpay");
const crypto = require("crypto");


const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

router.post("/create-razorpay-order", async (req, res) => {
  try {
    const { amount } = req.body;

    const order = await razorpay.orders.create({
      amount,
      currency: "INR",
      receipt: "receipt_" + Date.now(),
    });

    res.json(order);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create order" });
  }
});


router.post("/verify-razorpay-payment", async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature
    } = req.body;

    const body = razorpay_order_id + "|" + razorpay_payment_id;

    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest("hex");

    if (expectedSignature === razorpay_signature) {
      res.json({ success: true });
    } else {
      res.json({ success: false });
    }

  } catch (err) {
    res.status(500).json({ error: "Verification failed" });
  }
});



/* =====================================
   1️⃣ CREATE ORDER (Place Order)
===================================== */
router.post("/add", async (req, res) => {
  try {
    const {
      user_id,
      items,
      total_amount,
      shipping_address,
      payment_method,
      payment_status
    } = req.body;

    // Auto set payment status
    const finalPaymentStatus =
      payment_method === "cod" ? "pending" : payment_status || "pending";

    // 1️⃣ Create order
    const result = await pool.query(
      `INSERT INTO elan_orders
       (user_id, items, total_amount, order_status,
        shipping_address, payment_method,
        payment_status, created_at)
       VALUES ($1, $2, $3, 'Pending',
               $4, $5, $6, NOW())
       RETURNING *`,
      [
        user_id,
        items,
        total_amount,
        shipping_address,
        payment_method,
        finalPaymentStatus
      ]
    );

    // 2️⃣ Clear cart
    if (finalPaymentStatus === "paid" || payment_method === "cod") {
      await pool.query(
        `DELETE FROM elan_cart WHERE user_id = $1`,
        [user_id]
      );
    }

    res.status(201).json(result.rows[0]);

  } catch (err) {
    console.error("Create order error:", err);
    res.status(500).json({ error: "Failed to create order" });
  }
});



/* =====================================
   2️⃣ GET ALL ORDERS (Admin)
===================================== */
router.get("/", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM elan_orders ORDER BY created_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error("Fetch orders error:", err);
    res.status(500).json({ error: "Failed to fetch orders" });
  }
});

/* =====================================
   3️⃣ GET ORDERS BY USER ID
===================================== */
router.get("/user/:user_id", async (req, res) => {
  try {
    const { user_id } = req.params;

    const result = await pool.query(
      `SELECT * FROM elan_orders
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [user_id]
    );

    res.json(result.rows);
  } catch (err) {
    console.error("User orders error:", err);
    res.status(500).json({ error: "Failed to fetch user orders" });
  }
});

/* =====================================
   4️⃣ GET SINGLE ORDER
===================================== */
router.get("/:order_id", async (req, res) => {
  try {
    const { order_id } = req.params;

    const result = await pool.query(
      `SELECT * FROM elan_orders WHERE order_id = $1`,
      [order_id]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: "Order not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("Order fetch error:", err);
    res.status(500).json({ error: "Failed to fetch order" });
  }
});

/* =====================================
   5️⃣ UPDATE ORDER STATUS (Admin)
===================================== */
router.put("/:order_id/status", async (req, res) => {
  try {
    const { order_id } = req.params;
    const { order_status } = req.body;

    const result = await pool.query(
      `UPDATE elan_orders
       SET order_status = $1
       WHERE order_id = $2
       RETURNING *`,
      [order_status, order_id]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error("Update status error:", err);
    res.status(500).json({ error: "Failed to update status" });
  }
});

/* =====================================
   6️⃣ UPDATE FULL ORDER (Optional)
===================================== */
router.put("/:order_id", async (req, res) => {
  try {
    const { order_id } = req.params;
    const {
      items,
      total_amount,
      shipping_address,
      payment_method,
    } = req.body;

    const result = await pool.query(
      `UPDATE elan_orders
       SET items = $1,
           total_amount = $2,
           shipping_address = $3,
           payment_method = $4
       WHERE order_id = $5
       RETURNING *`,
      [items, total_amount, shipping_address, payment_method, order_id]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error("Update order error:", err);
    res.status(500).json({ error: "Failed to update order" });
  }
});
router.post("/:id/ship", async (req, res) => {
  const orderId = Number(req.params.id); // ensure it's a number

  try {
    // Simulate courier API integration
    const trackingNumber = "TRK" + Math.floor(Math.random() * 1000000);
    const courierService = "Shiprocket";

    const updatedOrder = await pool.query(
      `UPDATE elan_orders
       SET shipping_status = 'Shipped',
           tracking_number = $1,
           courier_service = $2
       WHERE order_id = $3
       RETURNING *`,
      [trackingNumber, courierService, orderId]
    );

    if (!updatedOrder.rows[0]) {
      return res.status(404).json({ error: "Order not found" });
    }

    res.json(updatedOrder.rows[0]);
  } catch (err) {
    console.error("Ship order error:", err);
    res.status(500).json({ error: "Failed to create shipment" });
  }
});


/* =====================================
   7️⃣ DELETE ORDER (Admin)
===================================== */
router.delete("/:order_id", async (req, res) => {
  try {
    const { order_id } = req.params;

    await pool.query(
      `DELETE FROM elan_orders WHERE order_id = $1`,
      [order_id]
    );

    res.json({ message: "Order deleted successfully" });
  } catch (err) {
    console.error("Delete order error:", err);
    res.status(500).json({ error: "Failed to delete order" });
  }
});


router.get("/sales", async (req, res) => {
  try {
    // Fetch all products including variants
    const productsRes = await pool.query(
      `SELECT id, name, category, variants FROM elanproducts`
    );
    const products = productsRes.rows;

    // Fetch all orders
    const ordersRes = await pool.query(`SELECT items FROM elan_orders`);
    const orders = ordersRes.rows;

    // Aggregate total sold and revenue per product
    const salesMap = {};
    const revenueMap = {};

    orders.forEach((order) => {
      let items = [];
      if (Array.isArray(order.items)) items = order.items;
      else if (typeof order.items === "string") {
        try {
          items = JSON.parse(order.items);
          if (!Array.isArray(items)) items = [];
        } catch {
          items = [];
        }
      }

      items.forEach((item) => {
        const pid = Number(item.product_id);
        const qty = Number(item.quantity) || 0;
        const price = Number(item.price) || 0;

        if (!salesMap[pid]) salesMap[pid] = 0;
        salesMap[pid] += qty;

        if (!revenueMap[pid]) revenueMap[pid] = 0;
        revenueMap[pid] += qty * price;
      });
    });

    const productsWithSales = products.map((p) => ({
      ...p,
      totalSold: salesMap[p.id] || 0,
      totalRevenue: revenueMap[p.id] || 0,
    }));

    // Sort by totalSold descending
    productsWithSales.sort((a, b) => b.totalSold - a.totalSold);

    res.json({
      highestSelling: productsWithSales[0] || null,
      lowestSelling: productsWithSales[productsWithSales.length - 1] || null,
      allProducts: productsWithSales || [],
    });
  } catch (err) {
    console.error("Sales report error:", err);
    res.status(500).json({ error: "Failed to generate sales report" });
  }
});
// REQUEST RETURN (User)
router.post("/:orderId/return", async (req, res) => {
  const { orderId } = req.params;
  const { reason } = req.body; // no product_ids needed

  try {
    // Fetch the order
    const orderResult = await pool.query(
      "SELECT items FROM elan_orders WHERE order_id = $1",
      [orderId]
    );

    if (!orderResult.rows.length)
      return res.status(404).json({ success: false, message: "Order not found" });

    let items = orderResult.rows[0].items;

    if (typeof items === "string") items = JSON.parse(items);

    // Update all items
    items = items.map(item => ({
      ...item,
      return_status: "Requested",
      return_reason: reason
    }));

    // Update DB
    await pool.query(
      "UPDATE elan_orders SET items = $1 WHERE order_id = $2",
      [JSON.stringify(items), orderId]
    );

    res.json({ success: true, message: "Return requested for entire order", items });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});



// GET ALL RETURN REQUESTS (Admin)
router.get("/admin/returns", async (req, res) => {
  try {
    // Fetch orders where any item has return_status = 'Requested'
    const result = await pool.query(
      "SELECT * FROM elan_orders WHERE items::jsonb @> '[{\"return_status\":\"Requested\"}]'"
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});


// APPROVE / REJECT RETURN (Admin)
router.post("/admin/returns/:order_id", async (req, res) => {
  const { order_id } = req.params;
  const { action } = req.body; // action = "approve" | "reject"

  if (!["approve", "reject"].includes(action)) {
    return res.status(400).json({ success: false, message: "Invalid action" });
  }

  try {
    // Fetch the order
    const orderResult = await pool.query(
      "SELECT items FROM elan_orders WHERE order_id = $1",
      [order_id]
    );

    if (!orderResult.rows.length) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    let items = orderResult.rows[0].items;
    if (typeof items === "string") items = JSON.parse(items);

    // Update return_status for all items
    items = items.map(item => ({
      ...item,
      return_status: action === "approve" ? "Approved" : "Rejected"
    }));

    // Update DB
    await pool.query(
      "UPDATE elan_orders SET items = $1 WHERE order_id = $2",
      [JSON.stringify(items), order_id]
    );

    res.json({
      success: true,
      message: `All returns in Order #${order_id} have been ${action}d successfully`
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

/* ======================================
   GET GUEST ORDERS BY MOBILE
====================================== */
router.get("/guest/:mobile", async (req, res) => {
  try {
    const { mobile } = req.params;

    // Cast shipping_address (text) to JSON, then extract 'phone'
    const result = await pool.query(
      `SELECT * FROM elan_orders
       WHERE (shipping_address::json ->> 'phone') = $1
       ORDER BY created_at DESC`,
      [mobile]
    );

    if (!result.rows.length) {
      return res
        .status(404)
        .json({ success: false, message: "No orders found for this mobile number" });
    }

    res.json(result.rows);
  } catch (err) {
    console.error("Fetch guest orders error:", err);
    res
      .status(500)
      .json({ success: false, message: "Server error. Make sure shipping_address is valid JSON." });
  }
});




module.exports = router;
