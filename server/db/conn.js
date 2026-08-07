const mongoose = require("mongoose");
require("dotenv").config();

console.log("DATABASE =", process.env.DATABASE);

const DB = process.env.DATABASE;

mongoose
  .connect(DB)
  .then(() => {
    console.log("Connection Successful! 🚀");
  })
  .catch((err) => console.log("Connection Error: 🚨", err));