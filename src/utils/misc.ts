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
