export declare const responseGenerator: (message?: string, data?: any, success?: boolean) => {
    message: string;
    data: any;
    success: boolean;
};
export declare const extractFileKey: (signedUrl: string) => string;
export declare function formatCurrency(value: number, precision?: number): string;
