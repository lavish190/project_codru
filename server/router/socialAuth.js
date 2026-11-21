const express = require('express');
const router = express.Router();
const User = require('../models/userSchema'); // Adjust path to your User model if needed
const SocialConnection = require('../models/SocialConnection');
const authenticate = require("../middleware/authenticate");

// ==========================================
// 0. CHECK CONNECTION STATUS (For Frontend UI)
// ==========================================
router.get('/auth/connections', authenticate, async (req, res) => {
  try {
    const userId = req.user ? req.user._id : req.userId; 
    
    const connections = await SocialConnection.find({ userId });
    
    const status = {
      linkedin: connections.some(c => c.provider === 'linkedin' && c.accessToken),
      facebook: connections.some(c => c.provider === 'facebook' && c.accessToken),
      // substack: connections.some(c => c.provider === 'substack'),
    };
    
    res.json(status);
  } catch (err) {
    console.error("Error fetching connections:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ==========================================
// 1. REDIRECT TO PROVIDER LOGIN (WITH BACKEND ROLE SECURITY)
// ==========================================
router.get('/auth/:provider/connect', authenticate, async (req, res) => {
  try {
    const { provider } = req.params;
    const userId = req.user ? req.user._id : req.userId;
    
    // 🚨 BACKEND SECURITY FIREWALL: Fetch user and verify role
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    const isStudent = user.Role?.toLowerCase() === 'student' || user.role?.toLowerCase() === 'student';
    const hasAdminOverride = user.socialOverride === true;

    if (isStudent && !hasAdminOverride) {
      return res.status(403).json({ 
        error: "Access Denied: Students are not permitted to connect social media accounts without Admin override." 
      });
    }

    // If they pass the security check, generate the Auth URL
    if (provider === 'linkedin') {
      const linkedInAuthUrl = `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${process.env.LINKEDIN_CLIENT_ID}&redirect_uri=${process.env.LINKEDIN_REDIRECT_URI}&scope=w_member_social%20profile%20openid&state=${userId}`; 
      return res.json({ url: linkedInAuthUrl });
    }

    if (provider === 'facebook') {
      const redirectUri = process.env.FACEBOOK_REDIRECT_URI;
      const appId = process.env.FACEBOOK_APP_ID;
      const scopes = 'pages_show_list,pages_read_engagement,pages_manage_posts,public_profile';

      const fbAuthUrl = `https://www.facebook.com/v19.0/dialog/oauth?client_id=${appId}&redirect_uri=${redirectUri}&state=${userId}&scope=${scopes}`;
      return res.json({ url: fbAuthUrl });
    }

    return res.status(400).json({ error: "Unsupported provider" });

  } catch (error) {
    console.error("Auth connect error:", error);
    res.status(500).json({ error: "Server error during connection initialization" });
  }
});

// ==========================================
// 2. THE CALLBACK & TOKEN EXCHANGE
// ==========================================
router.get('/auth/:provider/callback', async (req, res) => {
  const { provider } = req.params;
  const { code, state: userId, error } = req.query;

  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

  if (error) {
    console.error(`OAuth Error (${provider}):`, error);
    return res.redirect(`${frontendUrl}/?error=${provider}AuthFailed`);
  }

  if (!userId) {
    return res.redirect(`${frontendUrl}/?error=MissingUserId`);
  }

  // --- LINKEDIN CALLBACK ---
  if (provider === 'linkedin') {
    try {
      const tokenResponse = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code: code,
          client_id: process.env.LINKEDIN_CLIENT_ID,
          client_secret: process.env.LINKEDIN_CLIENT_SECRET,
          redirect_uri: process.env.LINKEDIN_REDIRECT_URI, 
        }),
      });

      const tokenData = await tokenResponse.json();
      if (!tokenResponse.ok) throw new Error(tokenData.error_description);

      const accessToken = tokenData.access_token;
      const expiresIn = tokenData.expires_in;

      const profileResponse = await fetch('https://api.linkedin.com/v2/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      
      const profileData = await profileResponse.json();
      if (!profileResponse.ok) throw new Error("Failed to fetch LinkedIn profile");

      const providerAccountId = `urn:li:person:${profileData.sub}`;
      const profileName = profileData.name;
      const tokenExpiresAt = new Date(Date.now() + expiresIn * 1000);

      await SocialConnection.findOneAndUpdate(
        { userId, provider: 'linkedin' },
        { providerAccountId, profileName, accessToken, tokenExpiresAt },
        { upsert: true, new: true }
      );

      return res.redirect(`${frontendUrl}/?success=linkedin_connected`);
    } catch (err) {
      console.error("LinkedIn OAuth Error:", err);
      return res.redirect(`${frontendUrl}/?error=LinkedInTokenExchangeFailed`);
    }
  }

  // --- FACEBOOK CALLBACK ---
  if (provider === 'facebook') {
    try {
      const redirectUri = process.env.FACEBOOK_REDIRECT_URI;
      const appId = process.env.FACEBOOK_APP_ID;
      const appSecret = process.env.FACEBOOK_APP_SECRET;

      // STEP A: Exchange the temporary code for a Short-Lived User Token
      const tokenRes = await fetch(`https://graph.facebook.com/v19.0/oauth/access_token?client_id=${appId}&redirect_uri=${redirectUri}&client_secret=${appSecret}&code=${code}`);
      const tokenData = await tokenRes.json();
      
      if (tokenData.error) throw new Error(tokenData.error.message);
      const shortLivedToken = tokenData.access_token;

      // STEP B: Exchange for a Long-Lived User Token (60 days)
      const longLivedRes = await fetch(`https://graph.facebook.com/v19.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${shortLivedToken}`);
      const longLivedData = await longLivedRes.json();
      
      if (longLivedData.error) throw new Error(longLivedData.error.message);
      const longLivedToken = longLivedData.access_token;

      // STEP C: Fetch the User's Pages (using the long-lived token)
      const pagesRes = await fetch(`https://graph.facebook.com/v19.0/me/accounts?access_token=${longLivedToken}`);
      const pagesData = await pagesRes.json();

      if (!pagesData.data || pagesData.data.length === 0) {
        return res.redirect(`${frontendUrl}/?error=no_facebook_pages_found`);
      }

      // Automatically link the FIRST page they manage
      const selectedPage = pagesData.data[0]; 
      const pageAccessToken = selectedPage.access_token;
      const pageId = selectedPage.id;
      const pageName = selectedPage.name;

      // STEP D: Save the Permanent Page Token to MongoDB
      await SocialConnection.findOneAndUpdate(
        { userId, provider: 'facebook' },
        {
          accessToken: pageAccessToken,
          providerAccountId: pageId,
          profileName: pageName,
          updatedAt: new Date()
        },
        { upsert: true, new: true }
      );

      return res.redirect(`${frontendUrl}/?success=facebook_connected`);
    } catch (err) {
      console.error("Facebook OAuth processing error:", err);
      return res.redirect(`${frontendUrl}/?error=FacebookTokenExchangeFailed`);
    }
  }

  return res.status(400).json({ error: "Unsupported provider" });
});

module.exports = router;