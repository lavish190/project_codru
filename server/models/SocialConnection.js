const mongoose = require('mongoose');

const socialConnectionSchema = new mongoose.Schema({
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  provider: { 
    type: String, 
    enum: ['linkedin', 'facebook', 'substack', 'meta', 'x'], // Added 'facebook'
    required: true 
  },
  providerAccountId: { 
    type: String, 
    required: true 
  }, // e.g., LinkedIn Person URN or FB User ID
  profileName: String, 
  accessToken: { 
    type: String, 
    required: true 
  },
  refreshToken: String,
  tokenExpiresAt: Date, 
  
  // 🚨 NEW: Facebook Pages Support
  defaultPageId: {
    type: String
  },
  pages: [{
    pageId: String,
    name: String,
    accessToken: String
  }]
}, { timestamps: true });

socialConnectionSchema.index({ userId: 1, provider: 1 }, { unique: true });

module.exports = mongoose.model('SocialConnection', socialConnectionSchema);