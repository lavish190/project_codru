const jwt = require("jsonwebtoken");
const dotenv = require("dotenv");
dotenv.config();
const User = require("../models/userSchema");

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer")) {
      console.log("Token not found");
      return res.status(401).json({ message: "Unauthorized access" });
    }

    const token = authHeader.split(" ")[1];
    console.log("Token received:", token);
    
    const verified = jwt.verify(token, process.env.TOKEN_SECRET);
    console.log("Verified Token:", verified);
    
    const user = await User.findOne({ _id: verified._id });

    if (!user) {
      return res.status(401).json({ error: "Unauthorized: User not found" });
    }

    req.token = token;
    req.user = user;
    req.userId = user._id;
    req.userID = user._id; // For all your previous code
    req.username = user.username;
    req.email = user.email;
    req.exp = verified.exp; 

    next();
  } catch (err) {
    res.status(401).json({ error: "Unauthorized: Invalid token" });
  }
};

module.exports = authenticate;