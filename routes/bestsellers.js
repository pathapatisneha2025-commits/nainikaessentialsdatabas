const express = require("express"); 
const router = express.Router();
const pool = require("../db"); // PostgreSQL pool
const multer = require("multer");
const { Readable } = require("stream");
const cloudinary = require("../cloudinary");

/* ================================
   MULTER MEMORY STORAGE
================================ */
const storage = multer.memoryStorage();
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

/* ================================
   CLOUDINARY UPLOAD HELPER
================================ */
const uploadToCloudinary = (buffer, folder = "elanbestsellers") => {
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

/* ----------------- ADD BEST SELLER ----------------- */
router.post(
  "/add",
  upload.fields([
    { name: "mainImage", maxCount: 1 },
    { name: "thumbnails", maxCount: 5 }
  ]),
  async (req, res) => {
    try {
      const { name, category, description, variants } = req.body;

      // main image
      let mainImageUrl = null;
      if (req.files?.mainImage?.length) {
        const result = await uploadToCloudinary(req.files.mainImage[0].buffer);
        mainImageUrl = result.secure_url;
      }

      // thumbnails
      let thumbnailUrls = [];
      if (req.files?.thumbnails?.length) {
        for (const file of req.files.thumbnails) {
          const result = await uploadToCloudinary(file.buffer);
          thumbnailUrls.push(result.secure_url);
        }
      }

      // variants
      let parsedVariants = [];
      if (variants) {
        parsedVariants = typeof variants === "string" ? JSON.parse(variants) : variants;
        parsedVariants = parsedVariants.map(v => ({
          size: v.size || "",
          color: v.color || "",
          price: Number(v.price) || 0,
          stock: Number(v.stock) || 0
        }));
      }

      const result = await pool.query(
        `INSERT INTO elan_bestsellers
         (name, category, description, main_image, thumbnails, variants)
         VALUES ($1,$2,$3,$4,$5,$6)
         RETURNING *`,
        [name, category, description, mainImageUrl, JSON.stringify(thumbnailUrls), JSON.stringify(parsedVariants)]
      );

      res.json({ bestseller: result.rows[0] });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Server error" });
    }
  }
);

/* ----------------- UPDATE BEST SELLER ----------------- */
router.put(
  "/update/:id",
  upload.fields([
    { name: "mainImage", maxCount: 1 },
    { name: "thumbnails", maxCount: 5 }
  ]),
  async (req, res) => {
    try {
      const { name, category, description, variants, existingMainImage, existingThumbnails } = req.body;

      let mainImageUrl = existingMainImage || null;
      if (req.files?.mainImage?.length) {
        const result = await uploadToCloudinary(req.files.mainImage[0].buffer);
        mainImageUrl = result.secure_url;
      }

      let thumbnailUrls = [];
      if (existingThumbnails) {
        thumbnailUrls = typeof existingThumbnails === "string" ? JSON.parse(existingThumbnails) : existingThumbnails;
      }

      if (req.files?.thumbnails?.length) {
        for (const file of req.files.thumbnails) {
          const result = await uploadToCloudinary(file.buffer);
          thumbnailUrls.push(result.secure_url);
        }
      }

      let parsedVariants = [];
      if (variants) {
        parsedVariants = typeof variants === "string" ? JSON.parse(variants) : variants;
        parsedVariants = parsedVariants.map(v => ({
          size: v.size || "",
          color: v.color || "",
          price: Number(v.price) || 0,
          stock: Number(v.stock) || 0
        }));
      }

      const result = await pool.query(
        `UPDATE elan_bestsellers
         SET name=$1, category=$2, description=$3, main_image=$4, thumbnails=$5, variants=$6,
             updated_at=CURRENT_TIMESTAMP
         WHERE id=$7
         RETURNING *`,
        [name, category, description, mainImageUrl, JSON.stringify(thumbnailUrls), JSON.stringify(parsedVariants), req.params.id]
      );

      res.json({ bestseller: result.rows[0] });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Server error" });
    }
  }
);

/* ----------------- GET ALL BEST SELLERS ----------------- */
router.get("/all", async (req, res) => {
  try {
    const result = await pool.query(`SELECT * FROM elan_bestsellers ORDER BY id DESC`);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

/* ----------------- GET BEST SELLER BY ID ----------------- */
router.get("/:id", async (req, res) => {
  try {
    const result = await pool.query(`SELECT * FROM elan_bestsellers WHERE id=$1`, [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: "Best seller not found" });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

/* ----------------- DELETE BEST SELLER ----------------- */
router.delete("/delete/:id", async (req, res) => {
  try {
    const result = await pool.query(`DELETE FROM elan_bestsellers WHERE id=$1`, [req.params.id]);
    if (!result.rowCount) return res.status(404).json({ error: "Best seller not found" });
    res.json({ message: "Best seller deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

/* ----------------- REDUCE STOCK ----------------- */
router.post("/reduce-stock", async (req, res) => {
  try {
    const { bestseller_id, size, color, quantity } = req.body;

    // Fetch bestseller
    const bRes = await pool.query("SELECT variants FROM elan_bestsellers WHERE id=$1", [bestseller_id]);
    if (!bRes.rows.length) return res.status(404).json({ error: "Best seller not found" });

    let variants = bRes.rows[0].variants;

    const variantIndex = variants.findIndex(v => v.size === size && v.color === color);
    if (variantIndex === -1) return res.status(404).json({ error: "Variant not found" });

    if (variants[variantIndex].stock < quantity) 
      return res.status(400).json({ error: "Not enough stock" });

    variants[variantIndex].stock -= quantity;

    await pool.query("UPDATE elan_bestsellers SET variants=$1 WHERE id=$2", [JSON.stringify(variants), bestseller_id]);

    res.json({ success: true, variant: variants[variantIndex] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

/* ----------------- ADD REVIEW ----------------- */
router.post("/:id/review", async (req, res) => {
  try {
    const { name, rating, comment } = req.body;
    if (!name || !rating || !comment) 
      return res.status(400).json({ error: "All fields are required" });

    // Fetch existing reviews
    const result = await pool.query("SELECT reviews FROM elan_bestsellers WHERE id=$1", [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: "Best seller not found" });

    let reviews = result.rows[0].reviews || [];
    reviews.push({ name, rating: Number(rating), comment, date: new Date() });

    // Update the product with new review
    await pool.query("UPDATE elan_bestsellers SET reviews=$1 WHERE id=$2", [JSON.stringify(reviews), req.params.id]);

    res.json({ success: true, review: { name, rating: Number(rating), comment, date: new Date() } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
