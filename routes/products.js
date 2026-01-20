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
      const { name, category, variants } = req.body;

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

      // Parse variants safely
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
        } catch (err) {
          parsedVariants = [];
        }
      }

      // Insert into DB (stringify JSON columns!)
      const result = await pool.query(
        `INSERT INTO elanproducts
         (name, category, main_image, thumbnails, variants)
         VALUES ($1,$2,$3,$4,$5)
         RETURNING *`,
        [
          name,
          category,
          mainImageUrl,
          JSON.stringify(thumbnailUrls),    // ✅ stringify thumbnails
          JSON.stringify(parsedVariants)    // ✅ stringify variants
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
      const { name, category, variants, existingMainImage, existingThumbnails } = req.body;

      // Handle main image
      let mainImageUrl = existingMainImage || null;
      if (req.files?.mainImage?.length) {
        const result = await uploadToCloudinary(req.files.mainImage[0].buffer);
        mainImageUrl = result.secure_url;
      }

      // Handle thumbnails
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

      // Parse variants safely
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

      // Update DB (stringify JSON columns!)
      const result = await pool.query(
        `UPDATE elanproducts
         SET name=$1, category=$2, main_image=$3, thumbnails=$4, variants=$5,
             updated_at=CURRENT_TIMESTAMP
         WHERE id=$6
         RETURNING *`,
        [
          name,
          category,
          mainImageUrl,
          JSON.stringify(thumbnailUrls),    // ✅ stringify
          JSON.stringify(parsedVariants),   // ✅ stringify
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

module.exports = router;
