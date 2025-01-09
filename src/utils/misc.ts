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

export const extractS3Key = (signedUrl: string) => {
  if(!signedUrl) return null;
  if (!signedUrl.includes('https://')) return signedUrl;
  // Regular expression to match the S3 key in the URL
  const regex = /https:\/\/[^\/]+\/([^?]+)/;
  const match = signedUrl.match(regex);

  if (match && match[1]) {
    return match[1]; // Return the S3 key
  } else {
    return null; // Return null if no match found
  }
};
