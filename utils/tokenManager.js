const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { SECURITY_CONFIG } = require('../config/security');

// RefreshToken model — lazy-required to avoid circular deps at module load time
const getRefreshTokenModel = () => require('../models/RefreshToken');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function parseExpiry(expiry) {
  // Convert JWT expiry string (e.g. '7d', '15m') to milliseconds
  const units = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
  const match = String(expiry).match(/^(\d+)([smhd])$/);
  if (match) return parseInt(match[1]) * units[match[2]];
  return 7 * 86400000; // default 7 days
}

// ---------------------------------------------------------------------------
// TokenManager
// ---------------------------------------------------------------------------

class TokenManager {
  // Generate access token (stateless JWT — no DB storage needed)
  static generateAccessToken(payload) {
    return jwt.sign(
      { ...payload, type: 'access', iat: Math.floor(Date.now() / 1000) },
      process.env.JWT_SECRET,
      {
        expiresIn: SECURITY_CONFIG.jwt.accessTokenExpiry,
        issuer: SECURITY_CONFIG.jwt.issuer,
        audience: SECURITY_CONFIG.jwt.audience,
        algorithm: 'HS256',
      }
    );
  }

  // Generate refresh token and persist it in MongoDB
  static async generateRefreshToken(userId) {
    const tokenId = crypto.randomUUID();
    const expiryMs = parseExpiry(SECURITY_CONFIG.jwt.refreshTokenExpiry);

    const refreshToken = jwt.sign(
      { userId, type: 'refresh', tokenId, iat: Math.floor(Date.now() / 1000) },
      process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
      {
        expiresIn: SECURITY_CONFIG.jwt.refreshTokenExpiry,
        issuer: SECURITY_CONFIG.jwt.issuer,
        audience: SECURITY_CONFIG.jwt.audience,
        algorithm: 'HS256',
      }
    );

    // Persist in MongoDB — safe for Workers (no in-memory state)
    const RefreshToken = getRefreshTokenModel();
    await RefreshToken.create({
      tokenId,
      userId: userId.toString(),
      tokenHash: hashToken(refreshToken),
      expiresAt: new Date(Date.now() + expiryMs),
    });

    return refreshToken;
  }

  // Generate token pair (access + refresh)
  static async generateTokenPair(payload) {
    const accessToken = this.generateAccessToken(payload);
    const refreshToken = await this.generateRefreshToken(payload.id);
    return { accessToken, refreshToken };
  }

  // Verify access token (stateless — no DB lookup needed)
  static verifyAccessToken(token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      if (!decoded.type) decoded.type = 'access';
      return decoded;
    } catch (error) {
      if (error.name === 'TokenExpiredError') throw new Error('Token has expired');
      if (error.name === 'JsonWebTokenError') throw new Error('Invalid token');
      throw error;
    }
  }

  // Verify refresh token — checks JWT signature AND MongoDB record
  static async verifyRefreshToken(token) {
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET, {
        issuer: SECURITY_CONFIG.jwt.issuer,
        audience: SECURITY_CONFIG.jwt.audience,
        algorithms: ['HS256'],
      });
    } catch (error) {
      if (error.name === 'TokenExpiredError') throw new Error('Refresh token has expired');
      throw new Error('Invalid refresh token');
    }

    if (decoded.type !== 'refresh') throw new Error('Invalid token type');

    // Check MongoDB record — not revoked, not expired
    const RefreshToken = getRefreshTokenModel();
    const record = await RefreshToken.findOne({
      tokenHash: hashToken(token),
      isRevoked: false,
      expiresAt: { $gt: new Date() },
    });

    if (!record) throw new Error('Refresh token not found or revoked');

    return decoded;
  }

  // Rotate refresh token — revoke old, issue new pair (call this in /refresh endpoint)
  static async rotateRefreshToken(oldRefreshToken, userPayload) {
    const decoded = await this.verifyRefreshToken(oldRefreshToken);

    if (decoded.userId !== userPayload.id.toString()) {
      throw new Error('Token user mismatch');
    }

    // Revoke old token atomically before issuing new one
    await this.revokeRefreshToken(oldRefreshToken);

    // Issue fresh pair
    return this.generateTokenPair(userPayload);
  }

  // Revoke a single refresh token
  static async revokeRefreshToken(token) {
    const RefreshToken = getRefreshTokenModel();
    await RefreshToken.updateOne(
      { tokenHash: hashToken(token) },
      { isRevoked: true }
    );
  }

  // Revoke all refresh tokens for a user (logout all devices)
  static async revokeAllUserTokens(userId) {
    const RefreshToken = getRefreshTokenModel();
    await RefreshToken.updateMany(
      { userId: userId.toString(), isRevoked: false },
      { isRevoked: true }
    );
  }

  // Revoke a single access token — access tokens are short-lived (15m) so we
  // only need to blacklist them for their remaining lifetime. Store in MongoDB
  // with a short TTL so the collection stays small.
  static async revokeToken(token) {
    try {
      const decoded = jwt.decode(token);
      if (!decoded || !decoded.exp) return;

      const expiresAt = new Date(decoded.exp * 1000);
      if (expiresAt <= new Date()) return; // already expired, no need to store

      // Re-use RefreshToken collection with a special marker
      const RefreshToken = getRefreshTokenModel();
      await RefreshToken.updateOne(
        { tokenHash: hashToken(token) },
        {
          $setOnInsert: {
            tokenId: decoded.jti || crypto.randomUUID(),
            userId: decoded.id || 'access',
            tokenHash: hashToken(token),
            isRevoked: true,
            expiresAt,
          },
        },
        { upsert: true }
      );
    } catch {
      // Best-effort — access tokens expire in 15m anyway
    }
  }

  // Get token info (for debugging)
  static getTokenInfo(token) {
    try {
      const decoded = jwt.decode(token, { complete: true });
      return {
        header: decoded.header,
        payload: decoded.payload,
        isExpired: decoded.payload.exp < Math.floor(Date.now() / 1000),
      };
    } catch {
      return null;
    }
  }
}

module.exports = TokenManager;
