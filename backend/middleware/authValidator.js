/**
 * JWT Token Security and Payload Validation Helpers
 * Provides structured validation for authorization headers, bearer tokens, and user permissions.
 */

const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('./auth');

function validateAuthHeader(authHeader) {
  if (!authHeader || typeof authHeader !== 'string') {
    return { valid: false, error: 'Missing or malformed Authorization header' };
  }
  const parts = authHeader.trim().split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return { valid: false, error: 'Authorization header format must be Bearer <token>' };
  }
  return { valid: true, token: parts[1] };
}

function verifyAndDecodeToken(token) {
  try {
    const payload = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
    return { valid: true, payload };
  } catch (err) {
    let errorMsg = 'Invalid token';
    if (err.name === 'TokenExpiredError') {
      errorMsg = 'Token has expired';
    } else if (err.name === 'JsonWebTokenError') {
      errorMsg = 'Invalid token signature';
    }
    return { valid: false, error: errorMsg };
  }
}

function generateAccessToken(userPayload, expiresIn = '8h') {
  return jwt.sign(
    {
      id: userPayload.id,
      email: userPayload.email,
      role: userPayload.role || 'user',
      iss: 'StockPilot-Auth'
    },
    JWT_SECRET,
    { expiresIn }
  );
}

module.exports = {
  validateAuthHeader,
  verifyAndDecodeToken,
  generateAccessToken
};
