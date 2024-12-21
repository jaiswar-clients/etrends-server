export declare const responseGenerator: (message?: string, data?: any, success?: boolean) => {
    message: string;
    data: any;
    success: boolean;
};
export declare const extractS3Key: (signedUrl: string) => string;
