// backend/utils/jwtUtils.js নামে নতুন ফাইল তৈরি করুন

const jwt = require("jsonwebtoken");

// 1. Token তৈরি করার ফাংশন
const generateToken = (user) => {
  return jwt.sign(
    {
      id: user._id,
      email: user.email,
      role: user.role || "student",
      name: user.name,
    },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_EXPIRE || "7d",
    },
  );
};

// 2. Token verify করার ফাংশন
const verifyToken = (token) => {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return {
      valid: true,
      expired: false,
      decoded,
    };
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return {
        valid: false,
        expired: true,
        message: "Token expired",
      };
    }
    return {
      valid: false,
      expired: false,
      message: "Invalid token",
    };
  }
};

module.exports = {
  generateToken,
  verifyToken,
};
