export const responseGenerator = (
  message?: string,
  data?: any,
  success: boolean = true,
) => {
  return {
    message,
    data,
    success,
  };
};

export const extractFileKey = (signedUrl: string) => {
  if (!signedUrl) return null;

  try {
    // Check if it's a valid URL
    new URL(signedUrl);
    
    // Extract everything after the last '/'
    const parts = signedUrl.split('/');
    return parts[parts.length - 1] || null;
  } catch {
    // If not a valid URL, return as is assuming it's already a key
    return signedUrl;
  }
};
