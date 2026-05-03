const express = require("express");
const router = express.Router();
const { uploadDoc } = require("../config/uploadDocument");
const { uploadDocument } = require("../controllers/uploads/uploadDocController");

// Upload 1 file duy nhất với key là "document"
router.post("/document", uploadDoc.single("document"), uploadDocument);

// Upload file Word cho import câu hỏi
router.post("/word", uploadDoc.single("document"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "Vui lòng upload file Word (.docx)" });
    }
    
    res.status(200).json({
      success: true,
      message: "Upload thành công",
      filename: req.file.filename,
      path: `/uploads/docs/${req.file.filename}`
    });
  } catch (error) {
    res.status(500).json({ message: "Upload thất bại", error: error.message });
  }
});

module.exports = router;