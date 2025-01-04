export declare class SendEmailDto {
    subject: string;
    body: string;
    from: string;
    to: string;
    bcc?: string;
    cc?: string;
    client_id?: string;
    order_id?: string;
    amc_id?: string;
    license_id?: string;
    customization_id?: string;
    email_template_id: string;
}
