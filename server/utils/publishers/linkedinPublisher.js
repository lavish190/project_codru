const SocialConnection = require('../../models/SocialConnection');
const { formatHtmlForLinkedIn } = require('../formatters');
const { uploadImageToLinkedIn } = require('../linkedinHelper');

const publishToLinkedIn = async (post) => {
  const connection = await SocialConnection.findOne({ userId: post.userId, provider: 'linkedin' });
  
  if (!connection || !connection.accessToken) {
    throw new Error("LinkedIn token not found or expired.");
  }

  const plainTextContent = formatHtmlForLinkedIn(post.content || '');
  
  let specificContent = {
    "com.linkedin.ugc.ShareContent": {
      shareCommentary: { text: plainTextContent },
      shareMediaCategory: "NONE"
    }
  };

  // 1. Process Images if they exist
  if (post.images && post.images.length > 0) {
    console.log(`[LinkedIn] Processing ${post.images.length} images for post ${post._id}`);
    const uploadPromises = post.images.map(url => 
      uploadImageToLinkedIn(url, connection.accessToken, connection.providerAccountId)
    );
    const assetUrns = await Promise.all(uploadPromises);

    specificContent["com.linkedin.ugc.ShareContent"].shareMediaCategory = "IMAGE";
    specificContent["com.linkedin.ugc.ShareContent"].media = assetUrns.map(urn => ({
      status: "READY",
      media: urn
    }));
  }

  // 2. Fire to LinkedIn API
  const linkedInRes = await fetch('https://api.linkedin.com/v2/ugcPosts', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${connection.accessToken}`,
      'Content-Type': 'application/json',
      'X-Restli-Protocol-Version': '2.0.0'
    },
    body: JSON.stringify({
      author: connection.providerAccountId,
      lifecycleState: 'PUBLISHED',
      specificContent: specificContent,
      visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' }
    })
  });

  if (!linkedInRes.ok) {
    const errData = await linkedInRes.json();
    throw new Error(errData.message || "LinkedIn API Error");
  }
  
  return true; // Success!
};

module.exports = {
  publishToLinkedIn
};