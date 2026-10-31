const express = require('express');
const router = express.Router();
const SocialConnection = require('../models/SocialConnection');
const authenticate = require("../middleware/authenticate");

// ==========================================
// 0. CHECK CONNECTION STATUS (For Frontend UI)
// ==========================================
router.get('/auth/connections', authenticate, async (req, res) => {
  try {
    // req.user._id or req.userId depending on how your auth middleware sets it
    const userId = req.user ? req.user._id : req.userId; 
    
    const connections = await SocialConnection.find({ userId });
    
    const status = {
      linkedin: connections.some(c => c.provider === 'linkedin'),
      // substack: connections.some(c => c.provider === 'substack'),
    };
    
    res.json(status);
  } catch (err) {
    console.error("Error fetching connections:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ==========================================
// 1. REDIRECT TO LINKEDIN LOGIN
// ==========================================
router.get('/auth/:provider/connect', authenticate, (req, res) => {
  const { provider } = req.params;
  
  if (provider === 'linkedin') {
    // We pass req.userId into the 'state' parameter so we remember WHO is connecting
    const linkedInAuthUrl = `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${process.env.LINKEDIN_CLIENT_ID}&redirect_uri=${process.env.LINKEDIN_REDIRECT_URI}&scope=w_member_social%20profile%20openid&state=${req.userId}`; 
    
    return res.json({ url: linkedInAuthUrl });
  }

  return res.status(400).json({ error: "Unsupported provider" });
});

// ==========================================
// 2. THE CALLBACK & TOKEN EXCHANGE
// ==========================================
router.get('/auth/:provider/callback', async (req, res) => {
  const { provider } = req.params;
  const { code, state: userId, error } = req.query;

  // Where to send the user back to on your React frontend
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

  if (error) {
    console.error("OAuth Error:", error);
    return res.redirect(`${frontendUrl}/?error=AuthFailed`);
  }

  if (!userId) {
    return res.redirect(`${frontendUrl}/?error=MissingUserId`);
  }

  if (provider === 'linkedin') {
    try {
      // A. Trade the authorization code for an Access Token
      const tokenResponse = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code: code,
          client_id: process.env.LINKEDIN_CLIENT_ID,
          client_secret: process.env.LINKEDIN_CLIENT_SECRET,
          redirect_uri: process.env.LINKEDIN_REDIRECT_URI, // Must exactly match the .env
        }),
      });

      const tokenData = await tokenResponse.json();
      if (!tokenResponse.ok) throw new Error(tokenData.error_description);

      const accessToken = tokenData.access_token;
      const expiresIn = tokenData.expires_in; // Seconds until expiration (usually 60 days)

      // B. Fetch the user's profile to get their unique LinkedIn URN
      const profileResponse = await fetch('https://api.linkedin.com/v2/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      
      const profileData = await profileResponse.json();
      if (!profileResponse.ok) throw new Error("Failed to fetch LinkedIn profile");

      // For personal profiles, the URN format is 'urn:li:person:{id}'
      const providerAccountId = `urn:li:person:${profileData.sub}`;
      const profileName = profileData.name;
      const tokenExpiresAt = new Date(Date.now() + expiresIn * 1000);

      // C. Save or update the connection in MongoDB
      await SocialConnection.findOneAndUpdate(
        { userId, provider: 'linkedin' },
        {
          providerAccountId,
          profileName,
          accessToken,
          tokenExpiresAt,
        },
        { upsert: true, new: true }
      );

      // D. Redirect back to React frontend on success
      return res.redirect(`${frontendUrl}/?success=linkedin_connected`);

    } catch (err) {
      console.error("LinkedIn OAuth Error:", err);
      return res.redirect(`${frontendUrl}/?error=TokenExchangeFailed`);
    }
  }

  return res.status(400).json({ error: "Unsupported provider" });
});

module.exports = router;