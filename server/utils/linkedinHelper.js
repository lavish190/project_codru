
const uploadImageToLinkedIn = async (imageUrl, accessToken, personUrn) => {
  try {
    const registerRes = await fetch("https://api.linkedin.com/v2/assets?action=registerUpload", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        registerUploadRequest: {
          recipes: ["urn:li:digitalmediaRecipe:feedshare-image"],
          owner: personUrn,
          serviceRelationships: [{ relationshipType: "OWNER", identifier: "urn:li:userGeneratedContent" }]
        }
      })
    });

    if (!registerRes.ok) throw new Error("Failed to register LinkedIn asset");
    const registerData = await registerRes.json();
    const uploadUrl = registerData.value.uploadMechanism["com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest"].uploadUrl;
    const assetUrn = registerData.value.asset;

    const imageRes = await fetch(imageUrl);
    const arrayBuffer = await imageRes.arrayBuffer();
    const imageBuffer = Buffer.from(arrayBuffer);

    const uploadRes = await fetch(uploadUrl, {
      method: "PUT",
      headers: { 
        "Authorization": `Bearer ${accessToken}`, 
        "Content-Type": "application/octet-stream" 
      },
      body: imageBuffer
    });

    if (!uploadRes.ok) throw new Error("Failed to upload binary to LinkedIn");
    
    return assetUrn;
  } catch (error) {
    console.error("LinkedIn Image Upload Error:", error);
    throw error;
  }
};

module.exports = {
  uploadImageToLinkedIn
};