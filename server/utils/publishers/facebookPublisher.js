const SocialConnection = require('../../models/SocialConnection');
const { formatHtmlForLinkedIn } = require('../formatters');

const publishToFacebook = async (post) => {
  // Grab the Facebook connection for this user
  const connection = await SocialConnection.findOne({ userId: post.userId, provider: 'facebook' });
  
  if (!connection || !connection.accessToken || !connection.providerAccountId) {
    throw new Error("Facebook Page token or Page ID not found.");
  }

  const pageId = connection.providerAccountId;
  const pageToken = connection.accessToken;
  
  // Facebook expects raw text, so we strip HTML tags
  const plainTextContent = formatHtmlForLinkedIn(post.content || '');

  try {
    let finalPostPayload = {
      message: plainTextContent,
      access_token: pageToken
    };

    // If there are images, we must upload them to Facebook first as "unpublished" photos, 
    // grab their Meta IDs, and then attach them to the final feed post.
    if (post.images && post.images.length > 0) {
      console.log(`[Facebook] Processing ${post.images.length} images for post ${post._id}`);
      const uploadedMediaIds = [];

      for (const imageUrl of post.images) {
        const photoRes = await fetch(`https://graph.facebook.com/v19.0/${pageId}/photos`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: imageUrl,
            published: false, // Don't put it on the timeline yet
            access_token: pageToken
          })
        });

        const photoData = await photoRes.json();
        if (photoData.error) throw new Error(`FB Image Upload Error: ${photoData.error.message}`);
        
        uploadedMediaIds.push(photoData.id);
      }

      // Format the media IDs for the final feed post payload
      uploadedMediaIds.forEach((mediaId, index) => {
        finalPostPayload[`attached_media[${index}]`] = `{"media_fbid":"${mediaId}"}`;
      });
    }

    // Fire the final post to the Page Feed
    const fbRes = await fetch(`https://graph.facebook.com/v19.0/${pageId}/feed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(finalPostPayload)
    });

    const fbData = await fbRes.json();
    
    if (fbData.error) {
      throw new Error(fbData.error.message);
    }

    return true; // Success!

  } catch (error) {
    throw error;
  }
};

module.exports = {
  publishToFacebook
};