const mongoose = require('mongoose');

const socialConnectionSchema = new mongoose.Schema({
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  provider: { 
    type: String, 
    enum: ['linkedin', 'substack', 'meta', 'x'], // Ready for future platforms
    required: true 
  },
  providerAccountId: { 
    type: String, 
    required: true 
  }, // e.g., LinkedIn Person URN
  profileName: String, // Useful to show "Connected as [Name]" in your UI
  accessToken: { 
    type: String, 
    required: true 
  },
  refreshToken: String,
  tokenExpiresAt: Date, // LinkedIn tokens expire after 60 days
}, { timestamps: true });

// Ensure a user can only have ONE connection per platform
socialConnectionSchema.index({ userId: 1, provider: 1 }, { unique: true });

module.exports = mongoose.model('SocialConnection', socialConnectionSchema);