const express = require("express");
const router = express.Router();
const pool = require("../db"); // your PostgreSQL pool
const multer = require("multer");
const { Readable } = require("stream");
const cloudinary = require("../cloudinary");

/* ================================
   MULTER MEMORY STORAGE
================================ */
const storage = multer.memoryStorage();
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } }); // 5MB

/* ================================
   CLOUDINARY UPLOAD HELPER
================================ */
const uploadToCloudinary = (buffer, folder = "elanproducts") => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream({ folder }, (err, result) => {
      if (err) reject(err);
      else resolve(result);
    });

    const readable = new Readable();
    readable._read = () => {};
    readable.push(buffer);
    readable.push(null);
    readable.pipe(stream);
  });
};

/* ======================================================
   ADD PRODUCT
   - main_image
   - thumbnails
   - variants
====================================================== */
/* ======================================================
   ADD PRODUCT
====================================================== */
router.post(
  "/add",
  upload.fields([
    { name: "mainImage", maxCount: 1 },
    { name: "thumbnails", maxCount: 5 },
  ]),
  async (req, res) => {
    try {
      // ✅ Read new fields description & product_details
      const { name, category, variants, discount, description, product_details } = req.body;

      // Upload main image
      let mainImageUrl = null;
      if (req.files?.mainImage?.length) {
        const result = await uploadToCloudinary(req.files.mainImage[0].buffer);
        mainImageUrl = result.secure_url;
      }

      // Upload thumbnails
      let thumbnailUrls = [];
      if (req.files?.thumbnails?.length) {
        for (const file of req.files.thumbnails) {
          const result = await uploadToCloudinary(file.buffer);
          thumbnailUrls.push(result.secure_url);
        }
      }

      // Parse variants
      let parsedVariants = [];
      if (variants) {
        try {
          parsedVariants = typeof variants === "string" ? JSON.parse(variants) : variants;
          parsedVariants = parsedVariants.map(v => ({
            size: v.size || "",
            color: v.color || "",
            price: Number(v.price) || 0,
            stock: Number(v.stock) || 0,
          }));
        } catch {
          parsedVariants = [];
        }
      }

      // Parse product_details
      let parsedProductDetails = {};
      if (product_details) {
        try {
          parsedProductDetails =
            typeof product_details === "string"
              ? JSON.parse(product_details)
              : product_details;
        } catch {
          parsedProductDetails = {};
        }
      }

      // Insert into DB
      const result = await pool.query(
        `INSERT INTO elanproducts
         (name, category, main_image, thumbnails, variants, discount, description, product_details)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         RETURNING *`,
        [
          name,
          category,
          mainImageUrl,
          JSON.stringify(thumbnailUrls),
          JSON.stringify(parsedVariants),
          Number(discount) || 0,
          description || "",
          JSON.stringify(parsedProductDetails)
        ]
      );

      res.json({ product: result.rows[0] });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Server error" });
    }
  }
);


/* ======================================================
   UPDATE PRODUCT
====================================================== */
router.put(
  "/update/:id",
  upload.fields([
    { name: "mainImage", maxCount: 1 },
    { name: "thumbnails", maxCount: 5 },
  ]),
  async (req, res) => {
    try {
      // ✅ Read new fields description & product_details
      const { name, category, variants, existingMainImage, existingThumbnails, discount, description, product_details } = req.body;

      // Main image
      let mainImageUrl = existingMainImage || null;
      if (req.files?.mainImage?.length) {
        const result = await uploadToCloudinary(req.files.mainImage[0].buffer);
        mainImageUrl = result.secure_url;
      }

      // Thumbnails
      let thumbnailUrls = [];
      if (existingThumbnails) {
        try {
          thumbnailUrls = typeof existingThumbnails === "string"
            ? JSON.parse(existingThumbnails)
            : existingThumbnails;
        } catch {
          thumbnailUrls = [];
        }
      }

      if (req.files?.thumbnails?.length) {
        for (const file of req.files.thumbnails) {
          const result = await uploadToCloudinary(file.buffer);
          thumbnailUrls.push(result.secure_url);
        }
      }

      // Variants
      let parsedVariants = [];
      if (variants) {
        try {
          parsedVariants = typeof variants === "string" ? JSON.parse(variants) : variants;
          parsedVariants = parsedVariants.map(v => ({
            size: v.size || "",
            color: v.color || "",
            price: Number(v.price) || 0,
            stock: Number(v.stock) || 0,
          }));
        } catch {
          parsedVariants = [];
        }
      }

      // Parse product_details
      let parsedProductDetails = {};
      if (product_details) {
        try {
          parsedProductDetails =
            typeof product_details === "string"
              ? JSON.parse(product_details)
              : product_details;
        } catch {
          parsedProductDetails = {};
        }
      }

      // Update DB
      const result = await pool.query(
        `UPDATE elanproducts
         SET name=$1, category=$2, main_image=$3, thumbnails=$4, variants=$5,
             discount=$6, description=$7, product_details=$8, updated_at=CURRENT_TIMESTAMP
         WHERE id=$9
         RETURNING *`,
        [
          name,
          category,
          mainImageUrl,
          JSON.stringify(thumbnailUrls),
          JSON.stringify(parsedVariants),
          Number(discount) || 0,
          description || "",
          JSON.stringify(parsedProductDetails),
          req.params.id
        ]
      );

      res.json({ product: result.rows[0] });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Server error" });
    }
  }
);


/* ======================================================
   GET ALL PRODUCTS
====================================================== */
router.get("/all", async (req, res) => {
  try {
    const result = await pool.query(`SELECT * FROM elanproducts ORDER BY id DESC`);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

/* ======================================================
   GET PRODUCT BY ID
====================================================== */
router.get("/:id", async (req, res) => {
  try {
    const result = await pool.query(`SELECT * FROM elanproducts WHERE id=$1`, [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: "Product not found" });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});
// routes/products.js
router.post("/reduce-stock", async (req, res) => {
  try {
    const { product_id, size, color, quantity } = req.body;

    // Fetch product
    const productRes = await pool.query("SELECT variants FROM elanproducts WHERE id=$1", [product_id]);
    if (!productRes.rows.length) return res.status(404).json({ error: "Product not found" });

    let variants = productRes.rows[0].variants; // this is already a JS array

    // Find the variant
    const variantIndex = variants.findIndex(v => v.size === size && v.color === color);
    if (variantIndex === -1) return res.status(404).json({ error: "Variant not found" });

    if (variants[variantIndex].stock < quantity)
      return res.status(400).json({ error: "Not enough stock" });

    // Reduce stock
    variants[variantIndex].stock -= quantity;

    // Update DB → stringify variants before sending to Postgres
    await pool.query(
      "UPDATE elanproducts SET variants=$1 WHERE id=$2",
      [JSON.stringify(variants), product_id]
    );

    res.json({ success: true, variant: variants[variantIndex] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});



/* ======================================================
   DELETE PRODUCT
====================================================== */
router.delete("/delete/:id", async (req, res) => {
  try {
    const result = await pool.query(`DELETE FROM elanproducts WHERE id=$1`, [req.params.id]);
    if (result.rowCount === 0) return res.status(404).json({ error: "Product not found" });
    res.json({ message: "Product deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});
router.post("/:id/review", async (req, res) => {
  try {
    const { name, rating, comment } = req.body;

    if (!name || !rating || !comment) {
      return res.status(400).json({ error: "All fields are required" });
    }

    const result = await pool.query(
      "SELECT reviews FROM elanproducts WHERE id=$1",
      [req.params.id]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: "Product not found" });
    }

    let reviews = result.rows[0].reviews || [];

    const newReview = {
      name,
      rating: Number(rating),
      comment,
      date: new Date()
    };

    reviews.push(newReview);

    await pool.query(
      "UPDATE elanproducts SET reviews=$1 WHERE id=$2",
      [JSON.stringify(reviews), req.params.id]
    );

    res.json({ success: true, review: newReview });
  } catch (err) {
    console.error("Add review error:", err);
    res.status(500).json({ error: "Server error" });
  }
});
router.get("/:id/reviews", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT reviews FROM elanproducts WHERE id=$1",
      [req.params.id]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: "Product not found" });
    }

    res.json(result.rows[0].reviews || []);
  } catch (err) {
    console.error("Get reviews error:", err);
    res.status(500).json({ error: "Server error" });
  }
});


module.exports = router;
