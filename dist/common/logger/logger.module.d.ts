declare module 'http' {
    interface IncomingMessage {
        requestId: string;
    }
}
export declare class LoggerModule {
}
