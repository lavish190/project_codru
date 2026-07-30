const express = require("express");
const router = express.Router();
const { addSubject, addPrice, deleteSubject , deletePrice} = require("../controllers/CourseController");

router.post("/add-subject", addSubject);

router.post("/add-price", addPrice);

router.post("/delete-subject",deleteSubject);

router.post("/delete-price", deletePrice);
module.exports = router;
