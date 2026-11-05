export const optimizeImage = (url: string | undefined | null) => {
  if (!url || !url.includes("cloudinary.com")) return url || "";
  // Prevent double-injecting if it's already optimized
  if (url.includes("q_auto") || url.includes("f_auto")) return url;
  
  // Injects auto-quality and auto-format right after /upload/
  return url.replace("/upload/", "/upload/q_auto,f_auto/");
};