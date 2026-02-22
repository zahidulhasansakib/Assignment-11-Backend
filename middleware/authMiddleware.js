

const { verifyToken } = require("../utils/jwtUtils");

// 1. Token check middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({
      success: false,
      message: "Token দেওয়া হয়নি",
    });
  }

  const verification = verifyToken(token);

  if (!verification.valid) {
    if (verification.expired) {
      return res.status(401).json({
        success: false,
        message: "Token expire হয়ে গেছে",
        code: "TOKEN_EXPIRED",
      });
    }
    return res.status(403).json({
      success: false,
      message: "Token ঠিক নেই",
    });
  }

  req.user = verification.decoded;
  next();
};

// 2. Role check middleware
const authorizeRoles = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "প্রথমে login করুন",
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `এই কাজটি শুধু ${allowedRoles.join(", ")}-রা করতে পারবে`,
      });
    }

    next();
  };
};

module.exports = {
  authenticateToken,
  authorizeRoles,
};
