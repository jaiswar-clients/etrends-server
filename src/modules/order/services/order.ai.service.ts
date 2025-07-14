import { Injectable } from '@nestjs/common';
import { ConfigService } from '@/common/config/services/config.service';
import { LoggerService } from '@/common/logger/services/logger.service';
import { OrderService } from './order.service';
import Anthropic from '@anthropic-ai/sdk';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Client, ClientDocument } from '@/db/schema/client.schema';
import { Customization, CustomizationDocument } from '@/db/schema/order/customization.schema';
import { License, LicenseDocument } from '@/db/schema/order/license.schema';
import { AdditionalService, AdditionalServiceDocument } from '@/db/schema/order/additional-service.schema';
import { Product, ProductDocument } from '@/db/schema/product.schema';

@Injectable()
export class OrderAiService {
  constructor(
    private readonly configService: ConfigService,
    private readonly loggerService: LoggerService,
    private readonly orderService: OrderService,
    @InjectModel(Client.name)
    private readonly clientModel: Model<ClientDocument>,
    @InjectModel(Customization.name)
    private readonly customizationModel: Model<CustomizationDocument>,
    @InjectModel(License.name)
    private readonly licenseModel: Model<LicenseDocument>,
    @InjectModel(AdditionalService.name)
    private readonly additionalServiceModel: Model<AdditionalServiceDocument>,
    @InjectModel(Product.name)
    private readonly productModel: Model<ProductDocument>,
  ) {}

  getCustomerWiseProductAdoptionReportPrompt(jsonData: string) {
    return `
You are a business intelligence analyst tasked with creating an insightful markdown report based on customer-wise product adoption data over the years. Your goal is to present a clear, concise, and informative analysis that highlights key trends and insights.

Here's the JSON data representing customer-wise product adoption:

<json_data>
${jsonData}
</json_data>

Please create a markdown report with the following structure:

1. Executive Summary
2. Overall Adoption Trends
3. Top Customers and Products
4. Customer-Year Product Adoption Table
5. Key Observations

Follow these specific instructions for each section:

1. Executive Summary:
   - Provide a brief overview of the analysis (2-3 sentences).
   - Highlight the most significant findings.

2. Overall Adoption Trends:
   - Analyze the total number of products adopted each year.
   - Identify any clear trends or patterns in adoption rates.
   - Use bullet points to list the main trends.

3. Top Customers and Products:
   - Identify the top 3 customers based on the total number of products adopted across all years.
   - List the top 5 most adopted products overall.
   - Present this information in two separate lists using bullet points.

4. Customer-Year Product Adoption Table:
   - Create a markdown table with the following columns: Customer, Year, Products Adopted.
   - Sort the table first by Customer (alphabetically), then by Year (ascending).
   - For each customer-year combination, list the products adopted separated by commas.

5. Key Observations:
   - Provide 3-5 insightful observations based on the data analysis.
   - Use bullet points for each observation.
   - Focus on patterns, anomalies, or interesting findings that aren't immediately obvious.

Formatting Guidelines:
- Use appropriate markdown syntax for headers, lists, and tables.
- Ensure the report is well-structured and easy to read.
- Use bold text to emphasize important points or numbers.

Your final output should be a complete markdown report that includes all the sections mentioned above. Do not include any explanations or notes outside of the report itself. The report should be ready for presentation to stakeholders without any additional editing.
    `;
  }

  getIndustryWiseProductDistributionReportPrompt(jsonData: string) {
    return `
You are a business intelligence analyst who needs to craft an insightful markdown report that explains industry-wise product distribution and identifies product adoption gaps across different industries. Use the following JSON data as your primary source:

<json_data>
${jsonData}
</json_data>

Generate a markdown report with these sections:

1. Executive Summary
2. Industry Distribution Overview
3. Product Adoption by Industry
4. Industry-Product Gap Table
5. Key Insights

Detailed instructions for each section:

1. Executive Summary:
   - Summarise the overall findings in 2-3 sentences.
   - Highlight the most important takeaways.

2. Industry Distribution Overview:
   - For each industry, state the total number of unique products adopted.
   - Present the information as a bullet list sorted by highest to lowest product count.

3. Product Adoption by Industry:
   - For each industry, list the products adopted (comma-separated).
   - Use sub-headings (###) for each industry followed by the list in bullet points.

4. Industry-Product Gap Table:
   - Create a markdown table with columns: Industry, Missing Products.
   - "Missing Products" should list products **not** adopted by that industry but present in the overall product list.
   - Sort the table alphabetically by industry.

5. Key Insights:
   - Provide 3-5 non-obvious insights or recommendations derived from the gap analysis.
   - Use bullet points.

Formatting guidelines:
- Use proper markdown headers, lists, and tables.
- Bold any noteworthy numbers or product names to draw attention.
- The report must be self-contained; do not add any explanatory notes outside the report.
    `;
  }

  getDomesticInternationalRevenueReportPrompt(jsonData: string) {
    return `
You are a financial analyst tasked with presenting a clear markdown report that compares **Domestic** vs **International** revenue and the average realisation per product. Use the JSON data below as your source of truth.

<json_data>
${jsonData}
</json_data>

Please create a markdown report with these sections:

1. Executive Summary
2. Overall Revenue Split
3. Product-wise Revenue & Realisation
4. Key Takeaways

Guidelines:

1. Executive Summary
   - 2-3 sentences summarising the most important findings.

2. Overall Revenue Split
   - Show total Domestic revenue, total International revenue, and the percentage share of each.
   - Display this as a two-column markdown table (**Revenue is in absolute currency units, not percentage**).

3. Product-wise Revenue & Realisation
   - Create a markdown table with columns: Product, Domestic Revenue, International Revenue, Total Revenue, Average Domestic Realisation, Average International Realisation, Overall Average Realisation.
   - Sort products by Total Revenue (descending).
   - Format revenue numbers with comma separators and two decimal places; highlight the top 3 revenue-generating products in **bold**.

4. Key Takeaways
   - Provide 3-5 insights based on the analysis (e.g., products that perform better internationally, high realisation gaps, etc.).
   - Use bullet points.

Formatting:
- Use markdown headers (##, ###) appropriately.
- Bold important numbers or product names where impactful.
- The report should be standalone; avoid including any notes outside the report.

NOTE: USE THE REVENUE ARE PROVIDED IN INDIAN RUPEE
    `;
  }

  getDirectFranchiseSalesReportPrompt(jsonData: string) {
    return `
You are preparing a concise markdown report that compares **Direct** vs **Franchise** sales performance. A **Direct** sale is where the client has _no_ parent_company_id, while **Franchise** sales relate to clients that _do_ have a parent_company_id. Use the JSON data below as the only source and produce the report in Indian Rupees (₹).

<json_data>
${jsonData}
</json_data>

Create the report with these sections:

1. Executive Summary
2. Overall Sales Split (Volume & Value)
3. Product-wise Breakdown
4. Key Insights

Detailed instructions:

1. Executive Summary
   - 2-3 sentences highlighting the main findings.

2. Overall Sales Split
   - Provide a markdown table with columns: Channel, Volume (Orders), Revenue (₹), Share % (Revenue).
   - Channels are **Direct** and **Franchise**.

3. Product-wise Breakdown
   - Markdown table columns: Product, Direct Volume, Direct Revenue (₹), Franchise Volume, Franchise Revenue (₹), Total Revenue (₹).
   - Sort rows by Total Revenue descending and bold top 3 products.

4. Key Insights
   - 3-5 bullet points with notable observations or recommendations.

Formatting guidelines:
- Use markdown headers (##, ###) properly.
- Format currency with comma separators and two decimal places.
- Bold significant numbers or product names where impactful.
- The report should be self-contained with **no** explanatory notes outside the required sections.
    `;
  }

  /* ------------------ PROMPT BUILDERS ------------------ */
  getProductRealisationVariationPrompt(jsonData: string) {
    return `
You are analysing pricing dispersion for products across different clients. Using the JSON data provided, craft a markdown report that highlights realisation variability (price differences) for each product among clients.

<json_data>
${jsonData}
</json_data>

Report sections:
1. Executive Summary
2. Product-wise Realisation Range
3. Top Variability Cases
4. Key Takeaways

Guidelines:
- Section 2: Table with columns Product, Client (Lowest), Price ₹, Client (Highest), Price ₹, Difference ₹, Difference %.
- Section 3: Bullet list of 3–5 products with the highest variability.
- Prices in Indian Rupees with comma separators & two decimals.
- Bold noteworthy values.
    `;
  }

  getUpsellPotentialPrompt(jsonData: string) {
    return `
Create a markdown report identifying clients with upsell potential based on low product count and/or low AMC revenue. Use the JSON below.

<json_data>
${jsonData}
</json_data>

Sections:
1. Executive Summary
2. Clients with Few Products (<=2)
3. Clients with Low AMC Revenue (bottom 25%)
4. Combined Opportunities
5. Recommendations
    `;
  }

  getCrossSellOpportunitiesPrompt(jsonData: string) {
    return `
Analyse cross-sell opportunities for specific products. Focus: clients who own **LARS** but not **LERMS**, **LLCS**, **LICM**. Produce a markdown report.

<json_data>
${jsonData}
</json_data>

Sections:
1. Executive Summary
2. Clients Owning LARS Only
3. Potential Cross-Sell Products per Client
4. Key Insights
    `;
  }

  getPartnerPerformancePrompt(jsonData: string) {
    return `
Generate a markdown report evaluating partner-wise performance. Partners are identified by *vendor_id* at client level.

<json_data>
${jsonData}
</json_data>

Sections:
1. Executive Summary
2. Partner Sales Contribution
3. Partner Margin Levels (if margin unavailable, use Average Selling Price)
4. Top & Bottom Performers
5. Observations
    `;
  }

  /**
   * Calls Anthropic Claude with the given prompt and returns the generated markdown.
   * This helper centralises all AI-interaction logic so it can be re-used by other
   * report generators within this service.
   */
  private async generateMarkdownReport(
    prompt: string,
    enableThinking: boolean,
  ): Promise<string> {
    const anthropic = new Anthropic({
      apiKey: this.configService.get<string>('ANTHROPHIC_API_KEY', {
        infer: true,
      }),
    });

    this.loggerService.log(
      JSON.stringify({
        message: 'generateMarkdownReport: Invoking Anthropic',
        options: { enableThinking },
      }),
    );

    if (enableThinking) {
      // Non-streaming path to include thinking blocks
      const response = await anthropic.messages.create({
        model: 'claude-4-sonnet-20250514',
        max_tokens: 30000,
        messages: [{ role: 'user', content: prompt }],
        thinking: {
          type: 'enabled',
          budget_tokens: 15000,
        },
      });

      const markdownContent = response.content
        .filter((block): block is Anthropic.TextBlock => block.type === 'text')
        .map((block) => block.text)
        .join('');

      this.loggerService.log(
        JSON.stringify({
          message: 'generateMarkdownReport: Received non-streaming response',
        }),
      );

      return markdownContent;
    } else {
      // Streaming path – collect text deltas
      const stream = await anthropic.messages.create({
        model: 'claude-4-sonnet-20250514',
        max_tokens: 10000,
        messages: [{ role: 'user', content: prompt }],
        stream: true,
      });

      let markdownContent = '';
      for await (const event of stream) {
        if (
          event.type === 'content_block_delta' &&
          event.delta.type === 'text_delta'
        ) {
          markdownContent += event.delta.text;
        }
      }

      this.loggerService.log(
        JSON.stringify({
          message: 'generateMarkdownReport: Streaming completed',
        }),
      );

      return markdownContent;
    }
  }

  /**
   * Generates a customer-wise product adoption report (year over year) in markdown format.
   *
   * 1. Loads all orders along with populated client & product details.
   * 2. Builds an aggregated structure: { client -> { year -> [products] } }.
   * 3. Passes this structured JSON to Anthropic Claude to create a concise markdown report.
   * 4. Returns the markdown string.
   */
  async getCustomerProductAdoptionReport(
    enableThinking = false,
  ): Promise<string> {
    // 1. Fetch all orders (large limit to cover entire dataset)
    this.loggerService.log(
      JSON.stringify({
        message: 'getCustomerProductAdoptionReport: Fetching all orders',
      }),
    );

    const { purchases } = await this.orderService.loadAllOrdersWithAttributes(
      1,
      100000, // sufficiently large to fetch everything
      {},
    );

    this.loggerService.log(
      JSON.stringify({
        message: 'getCustomerProductAdoptionReport: Orders fetched',
        totalOrders: purchases.length,
      }),
    );

    // 2. Aggregate data
    const adoptionData: Record<string, Record<string, Set<string>>> = {};

    purchases.forEach((order: any) => {
      try {
        const clientName: string = order?.client_id?.name ?? 'Unknown Client';
        const purchaseYear: string = new Date(order?.purchased_date)
          .getFullYear()
          .toString();
        const productNames: string[] = (order?.products ?? []).map(
          (p: any) => p?.name ?? 'Unknown Product',
        );

        if (!adoptionData[clientName]) adoptionData[clientName] = {};
        if (!adoptionData[clientName][purchaseYear])
          adoptionData[clientName][purchaseYear] = new Set<string>();

        productNames.forEach((prod) =>
          adoptionData[clientName][purchaseYear].add(prod),
        );
      } catch (error: any) {
        this.loggerService.error(
          JSON.stringify({
            message:
              'getCustomerProductAdoptionReport: Error aggregating order',
            orderId: order?._id,
            error: error.message,
          }),
        );
      }
    });

    // Convert Sets to arrays for JSON serialization
    const serializableData: Record<string, Record<string, string[]>> = {};
    Object.entries(adoptionData).forEach(([client, years]) => {
      serializableData[client] = {};
      Object.entries(years).forEach(([year, productsSet]) => {
        serializableData[client][year] = Array.from(productsSet as Set<string>);
      });
    });

    this.loggerService.log(
      JSON.stringify({
        message: 'getCustomerProductAdoptionReport: Aggregation completed',
        clientCount: Object.keys(serializableData).length,
      }),
    );

    const prompt = this.getCustomerWiseProductAdoptionReportPrompt(
      JSON.stringify(serializableData, null, 2),
    );

    return this.generateMarkdownReport(prompt, enableThinking);
  }

  /**
   * Generates an industry-wise product distribution & gap analysis markdown report.
   *
   * Steps:
   * 1. Fetches all orders with populated client & product details.
   * 2. Aggregates data into the structure: { industries: { [industry]: string[] }, allProducts: string[] }.
   * 3. Sends the structured JSON to Anthropic Claude to obtain a polished markdown report.
   * 4. Returns the markdown string.
   */
  async getIndustryProductDistributionReport(
    enableThinking = false,
  ): Promise<string> {
    // 1. Fetch all orders with industry
    this.loggerService.log(
      JSON.stringify({
        message: 'getIndustryProductDistributionReport: Fetching orders with industry',
      }),
    );

    const purchases = await this.loadAllOrdersWithIndustry();

    this.loggerService.log(
      JSON.stringify({
        message: 'getIndustryProductDistributionReport: Orders fetched',
        totalOrders: purchases.length,
      }),
    );

    // 2. Aggregate data
    const industryProducts: Record<string, Set<string>> = {};
    const allProductsSet: Set<string> = new Set<string>();

    purchases.forEach((order: any) => {
      try {
        const industry: string = order?.client_id?.industry ?? 'Unknown Industry';
        const productNames: string[] = (order?.products ?? []).map(
          (p: any) => p?.name ?? 'Unknown Product',
        );

        if (!industryProducts[industry]) industryProducts[industry] = new Set<string>();

        productNames.forEach((prod) => {
          industryProducts[industry].add(prod);
          allProductsSet.add(prod);
        });
      } catch (error: any) {
        this.loggerService.error(
          JSON.stringify({
            message: 'getIndustryProductDistributionReport: Error aggregating order',
            orderId: order?._id,
            error: error.message,
          }),
        );
      }
    });

    // 3. Prepare serialisable structure
    const serializableData: {
      industries: Record<string, string[]>;
      allProducts: string[];
    } = {
      industries: {},
      allProducts: Array.from(allProductsSet),
    };

    Object.entries(industryProducts).forEach(([industry, productsSet]) => {
      serializableData.industries[industry] = Array.from(productsSet as Set<string>);
    });

    this.loggerService.log(
      JSON.stringify({
        message: 'getIndustryProductDistributionReport: Aggregation completed',
        industryCount: Object.keys(serializableData.industries).length,
        totalUniqueProducts: serializableData.allProducts.length,
      }),
    );

    const prompt = this.getIndustryWiseProductDistributionReportPrompt(
      JSON.stringify(serializableData, null, 2),
    );

    return this.generateMarkdownReport(prompt, enableThinking);
  }

  /**
   * Fetches all orders and ensures the client's industry field is populated.
   * Uses bulk lookup to avoid N+1 queries.
   */
  private async loadAllOrdersWithIndustry(): Promise<any[]> {
    const { purchases } = await this.orderService.loadAllOrdersWithAttributes(
      1,
      100000,
      {},
    );

    // Identify client IDs missing industry
    const missingClientIds = new Set<string>();
    purchases.forEach((order: any) => {
      if (
        order?.client_id &&
        !order.client_id.industry &&
        order.client_id._id
      ) {
        missingClientIds.add(order.client_id._id.toString());
      }
    });

    if (missingClientIds.size === 0) {
      return purchases; // All industries already present
    }

    // Bulk fetch client industries
    const clients = await this.clientModel
      .find({ _id: { $in: Array.from(missingClientIds) } })
      .select('industry')
      .lean<{ _id: any; industry: string }[]>();

    const industryMap = new Map(
      clients.map((c) => [c._id.toString(), c.industry ?? 'Unknown Industry']),
    );

    // Patch purchases with industry
    purchases.forEach((order: any) => {
      const cid = order?.client_id?._id?.toString?.();
      if (cid && industryMap.has(cid)) {
        order.client_id.industry = industryMap.get(cid);
      }
    });

    return purchases;
  }

  /**
   * Generates a Domestic vs International revenue split report with average realisation per product.
   */
  async getDomesticInternationalRevenueReport(
    enableThinking = false,
  ): Promise<any> {
    this.loggerService.log(
      JSON.stringify({
        message: 'getDomesticInternationalRevenueReport: Fetching orders',
      }),
    );

    const purchases = await this.loadAllOrdersWithIndustry(); // Reuse helper to ensure client info is populated

    this.loggerService.log(
      JSON.stringify({
        message: 'getDomesticInternationalRevenueReport: Orders fetched',
        totalOrders: purchases.length,
      }),
    );

    const totals = {
      domesticRevenue: 0,
      internationalRevenue: 0,
    };

    interface ProductStats {
      name: string;
      domesticRevenue: number;
      internationalRevenue: number;
      domesticOrders: number;
      internationalOrders: number;
    }

    const productMap: Map<string, ProductStats> = new Map();

    purchases.forEach((order: any) => {
      try {
        const isDomestic = !!order?.client_id?.gst_number; // heuristic
        const productDocs: any[] = order?.products ?? [];

        // Revenue allocation per product
        const productRevenueAlloc: Record<string, number> = {};
        if (
          Array.isArray(order.base_cost_seperation) &&
          order.base_cost_seperation.length > 0
        ) {
          order.base_cost_seperation.forEach((sep: any) => {
            const prodId = sep.product_id?.toString?.();
            const prod = productDocs.find((p: any) => p?._id?.toString?.() === prodId);
            const name = prod?.name ?? 'Unknown Product';
            productRevenueAlloc[name] = (productRevenueAlloc[name] || 0) + (sep.amount ?? 0);
          });
        }

        // If separation not present or incomplete, distribute equally among products
        if (Object.keys(productRevenueAlloc).length === 0) {
          const equalShare = (order.base_cost ?? 0) / (productDocs.length || 1);
          productDocs.forEach((p: any) => {
            const name = p?.name ?? 'Unknown Product';
            productRevenueAlloc[name] = (productRevenueAlloc[name] || 0) + equalShare;
          });
        }

        // Update totals and per-product stats
        Object.entries(productRevenueAlloc).forEach(([name, revenue]) => {
          if (!productMap.has(name)) {
            productMap.set(name, {
              name,
              domesticRevenue: 0,
              internationalRevenue: 0,
              domesticOrders: 0,
              internationalOrders: 0,
            });
          }
          const stats = productMap.get(name)!;
          if (isDomestic) {
            stats.domesticRevenue += revenue;
            stats.domesticOrders += 1;
            totals.domesticRevenue += revenue;
          } else {
            stats.internationalRevenue += revenue;
            stats.internationalOrders += 1;
            totals.internationalRevenue += revenue;
          }
        });
      } catch (error: any) {
        this.loggerService.error(
          JSON.stringify({
            message: 'getDomesticInternationalRevenueReport: Error processing order',
            orderId: order?._id,
            error: error.message,
          }),
        );
      }
    });

    /* ---- Process Customizations ---- */
    const customizations = await this.customizationModel
      .find()
      .populate('product_id')
      .populate({
        path: 'order_id',
        populate: { path: 'client_id', model: Client.name },
      })
      .lean();

    for (const cust of customizations) {
      try {
        const order = cust.order_id as any;
        if (!order || !order.client_id) continue;
        const isDomestic = !!order.client_id?.gst_number;
        const productDoc: any = cust.product_id ?? {};
        const name = productDoc?.name ?? 'Unknown Product';

        if (!productMap.has(name)) {
          productMap.set(name, {
            name,
            domesticRevenue: 0,
            internationalRevenue: 0,
            domesticOrders: 0,
            internationalOrders: 0,
          });
        }

        const stats = productMap.get(name)!;
        const amount = cust.cost ?? 0;
        if (isDomestic) {
          stats.domesticRevenue += amount;
          stats.domesticOrders += 1;
          totals.domesticRevenue += amount;
        } else {
          stats.internationalRevenue += amount;
          stats.internationalOrders += 1;
          totals.internationalRevenue += amount;
        }
      } catch {}
    }

    /* ---- Process Licenses ---- */
    const licenses = await this.licenseModel
      .find()
      .populate('product_id')
      .populate({
        path: 'order_id',
        populate: { path: 'client_id', model: Client.name },
      })
      .lean();

    for (const lic of licenses) {
      try {
        const order = lic.order_id as any;
        if (!order || !order.client_id) continue;
        const isDomestic = !!order.client_id?.gst_number;
        const productDoc: any = lic.product_id ?? {};
        const name = productDoc?.name ?? 'Unknown Product';
        const revenue = (lic.rate?.amount ?? 0) * (lic.total_license ?? 0);

        if (!productMap.has(name)) {
          productMap.set(name, {
            name,
            domesticRevenue: 0,
            internationalRevenue: 0,
            domesticOrders: 0,
            internationalOrders: 0,
          });
        }

        const stats = productMap.get(name)!;
        if (isDomestic) {
          stats.domesticRevenue += revenue;
          stats.domesticOrders += 1;
          totals.domesticRevenue += revenue;
        } else {
          stats.internationalRevenue += revenue;
          stats.internationalOrders += 1;
          totals.internationalRevenue += revenue;
        }
      } catch {}
    }

    /* ---- Process Additional Services ---- */
    const services = await this.additionalServiceModel
      .find()
      .populate('product_id')
      .populate({
        path: 'order_id',
        populate: { path: 'client_id', model: Client.name },
      })
      .lean();

    for (const serv of services) {
      try {
        const order = serv.order_id as any;
        if (!order || !order.client_id) continue;
        const isDomestic = !!order.client_id?.gst_number;
        const productDoc: any = serv.product_id ?? {};
        const name = productDoc?.name ?? 'Unknown Product';
        const amount = serv.cost ?? 0;

        if (!productMap.has(name)) {
          productMap.set(name, {
            name,
            domesticRevenue: 0,
            internationalRevenue: 0,
            domesticOrders: 0,
            internationalOrders: 0,
          });
        }

        const stats = productMap.get(name)!;
        if (isDomestic) {
          stats.domesticRevenue += amount;
          stats.domesticOrders += 1;
          totals.domesticRevenue += amount;
        } else {
          stats.internationalRevenue += amount;
          stats.internationalOrders += 1;
          totals.internationalRevenue += amount;
        }
      } catch {}
    }

    // Prepare serialisable product data
    const productsSerializable: Record<string, any> = {};
    productMap.forEach((stats, name) => {
      const totalOrders = stats.domesticOrders + stats.internationalOrders;
      const totalRevenue = stats.domesticRevenue + stats.internationalRevenue;
      productsSerializable[name] = {
        domesticRevenue: stats.domesticRevenue,
        internationalRevenue: stats.internationalRevenue,
        totalRevenue,
        avgDomesticRealisation:
          stats.domesticOrders > 0 ? stats.domesticRevenue / stats.domesticOrders : 0,
        avgInternationalRealisation:
          stats.internationalOrders > 0
            ? stats.internationalRevenue / stats.internationalOrders
            : 0,
        avgOverallRealisation: totalOrders > 0 ? totalRevenue / totalOrders : 0,
      };
    });

    const serializableData = {
      totals,
      products: productsSerializable,
    };

    this.loggerService.log(
      JSON.stringify({
        message: 'getDomesticInternationalRevenueReport: Aggregation completed',
        domesticRevenue: totals.domesticRevenue,
        internationalRevenue: totals.internationalRevenue,
        productCount: productMap.size,
      }),
    );

    const prompt = this.getDomesticInternationalRevenueReportPrompt(
      JSON.stringify(serializableData, null, 2),
    );

    return this.generateMarkdownReport(prompt, enableThinking);
    
  }

  /**
   * Generates Direct vs Franchise sales breakdown (volume & value).
   */
  async getDirectFranchiseSalesReport(enableThinking = false): Promise<string> {
    this.loggerService.log(
      JSON.stringify({
        message: 'getDirectFranchiseSalesReport: Fetching orders',
      }),
    );

    const purchases = await this.loadAllOrdersWithIndustry();

    this.loggerService.log(
      JSON.stringify({
        message: 'getDirectFranchiseSalesReport: Orders fetched',
        totalOrders: purchases.length,
      }),
    );

    const totals = {
      directRevenue: 0,
      franchiseRevenue: 0,
      directVolume: 0,
      franchiseVolume: 0,
    };

    interface ProductStats {
      name: string;
      directRevenue: number;
      franchiseRevenue: number;
      directVolume: number;
      franchiseVolume: number;
    }

    const productMap: Map<string, ProductStats> = new Map();

    const processEntry = (
      name: string,
      revenue: number,
      isDirect: boolean,
    ) => {
      if (!productMap.has(name)) {
        productMap.set(name, {
          name,
          directRevenue: 0,
          franchiseRevenue: 0,
          directVolume: 0,
          franchiseVolume: 0,
        });
      }
      const stats = productMap.get(name)!;
      if (isDirect) {
        stats.directRevenue += revenue;
        stats.directVolume += 1;
        totals.directRevenue += revenue;
        totals.directVolume += 1;
      } else {
        stats.franchiseRevenue += revenue;
        stats.franchiseVolume += 1;
        totals.franchiseRevenue += revenue;
        totals.franchiseVolume += 1;
      }
    };

    /* ---- Orders ---- */
    purchases.forEach((order: any) => {
      try {
        const client = order?.client_id ?? {};
        const isDirect = !client?.parent_company_id;
        const productDocs: any[] = order?.products ?? [];

        // Revenue allocation per product
        const revenueAlloc: Record<string, number> = {};
        if (
          Array.isArray(order.base_cost_seperation) &&
          order.base_cost_seperation.length > 0
        ) {
          order.base_cost_seperation.forEach((sep: any) => {
            const prodId = sep.product_id?.toString?.();
            const prod = productDocs.find((p: any) => p?._id?.toString?.() === prodId);
            const name = prod?.name ?? 'Unknown Product';
            revenueAlloc[name] = (revenueAlloc[name] || 0) + (sep.amount ?? 0);
          });
        }
        if (Object.keys(revenueAlloc).length === 0) {
          const equalShare = (order.base_cost ?? 0) / (productDocs.length || 1);
          productDocs.forEach((p: any) => {
            const name = p?.name ?? 'Unknown Product';
            revenueAlloc[name] = (revenueAlloc[name] || 0) + equalShare;
          });
        }
        Object.entries(revenueAlloc).forEach(([name, rev]) =>
          processEntry(name, rev, isDirect),
        );
      } catch (e) {}
    });

    /* ---- Customizations ---- */
    const customizations = await this.customizationModel
      .find()
      .populate('product_id')
      .populate({
        path: 'order_id',
        populate: { path: 'client_id', model: Client.name },
      })
      .lean();
    for (const cust of customizations) {
      const order = cust.order_id as any;
      if (!order || !order.client_id) continue;
      const isDirect = !order.client_id?.parent_company_id;
      const productDoc: any = cust.product_id ?? {};
      processEntry(productDoc?.name ?? 'Unknown Product', cust.cost ?? 0, isDirect);
    }

    /* ---- Licenses ---- */
    const licenses = await this.licenseModel
      .find()
      .populate('product_id')
      .populate({
        path: 'order_id',
        populate: { path: 'client_id', model: Client.name },
      })
      .lean();
    for (const lic of licenses) {
      const order = lic.order_id as any;
      if (!order || !order.client_id) continue;
      const isDirect = !order.client_id?.parent_company_id;
      const productDoc: any = lic.product_id ?? {};
      const revenue = (lic.rate?.amount ?? 0) * (lic.total_license ?? 0);
      processEntry(productDoc?.name ?? 'Unknown Product', revenue, isDirect);
    }

    /* ---- Additional Services ---- */
    const services = await this.additionalServiceModel
      .find()
      .populate('product_id')
      .populate({
        path: 'order_id',
        populate: { path: 'client_id', model: Client.name },
      })
      .lean();
    for (const serv of services) {
      const order = serv.order_id as any;
      if (!order || !order.client_id) continue;
      const isDirect = !order.client_id?.parent_company_id;
      const productDoc: any = serv.product_id ?? {};
      processEntry(productDoc?.name ?? 'Unknown Product', serv.cost ?? 0, isDirect);
    }

    // Build serialisable structure
    const productsSerializable: Record<string, any> = {};
    productMap.forEach((stats, name) => {
      const totalRevenue = stats.directRevenue + stats.franchiseRevenue;
      productsSerializable[name] = {
        directVolume: stats.directVolume,
        directRevenue: stats.directRevenue,
        franchiseVolume: stats.franchiseVolume,
        franchiseRevenue: stats.franchiseRevenue,
        totalRevenue,
      };
    });

    const serializableData = {
      totals,
      products: productsSerializable,
    };

    this.loggerService.log(
      JSON.stringify({
        message: 'getDirectFranchiseSalesReport: Aggregation completed',
        directRevenue: totals.directRevenue,
        franchiseRevenue: totals.franchiseRevenue,
        directVolume: totals.directVolume,
        franchiseVolume: totals.franchiseVolume,
      }),
    );

    const prompt = this.getDirectFranchiseSalesReportPrompt(
      JSON.stringify(serializableData, null, 2),
    );

    return this.generateMarkdownReport(prompt, enableThinking);
  }

  /* ------------------ REPORT METHODS ------------------ */
  async getProductRealisationVariationReport(enableThinking = false): Promise<string> {
    const { purchases } = await this.orderService.loadAllOrdersWithAttributes(1, 100000, {});

    // Map: product -> {client -> realisation}
    const variation: Record<string, Record<string, number[]>> = {};

    purchases.forEach((order: any) => {
      const clientName = order?.client_id?.name ?? 'Unknown Client';
      const productDocs: any[] = order?.products ?? [];

      let alloc: Record<string, number> = {};
      if (Array.isArray(order.base_cost_seperation) && order.base_cost_seperation.length) {
        order.base_cost_seperation.forEach((sep: any) => {
          const p = productDocs.find((pd: any) => pd?._id?.toString?.() === sep.product_id?.toString?.());
          const name = p?.name ?? 'Unknown Product';
          alloc[name] = (alloc[name] || 0) + (sep.amount ?? 0);
        });
      } else {
        const share = (order.base_cost ?? 0) / (productDocs.length || 1);
        productDocs.forEach((p: any) => {
          alloc[p?.name ?? 'Unknown Product'] = (alloc[p?.name ?? 'Unknown Product'] || 0) + share;
        });
      }

      Object.entries(alloc).forEach(([prod, amount]) => {
        if (!variation[prod]) variation[prod] = {};
        if (!variation[prod][clientName]) variation[prod][clientName] = [];
        variation[prod][clientName].push(amount);
      });
    });

    const prompt = this.getProductRealisationVariationPrompt(
      JSON.stringify(variation, null, 2),
    );
    return this.generateMarkdownReport(prompt, enableThinking);
  }

  async getUpsellPotentialClientsReport(enableThinking = false): Promise<string> {
    const { purchases } = await this.orderService.loadAllOrdersWithAttributes(1, 100000, {});

    // Aggregate per client
    const map: Record<string, { products: Set<string>; amcRevenue: number }> = {};

    purchases.forEach((order: any) => {
      const client = order?.client_id;
      if (!client) return;
      const clientName = client.name ?? 'Unknown Client';
      if (!map[clientName]) map[clientName] = { products: new Set(), amcRevenue: 0 };
      (order?.products ?? []).forEach((p: any) => map[clientName].products.add(p?.name ?? 'Unknown Product'));
      // AMC amount
      if (order?.amc_id?.amount) map[clientName].amcRevenue += order.amc_id.amount;
    });

    const prompt = this.getUpsellPotentialPrompt(JSON.stringify(map, null, 2));
    return this.generateMarkdownReport(prompt, enableThinking);
  }

  async getCrossSellOpportunitiesReport(enableThinking = false): Promise<string> {
    const { purchases } = await this.orderService.loadAllOrdersWithAttributes(1, 100000, {});
    const targetProducts = ['LARS', 'LERMS', 'LLCS', 'LICM'];

    const map: Record<string, string[]> = {};
    purchases.forEach((order: any) => {
      const clientName = order?.client_id?.name ?? 'Unknown Client';
      if (!map[clientName]) map[clientName] = [];
      (order?.products ?? []).forEach((p: any) => {
        const name = p?.name;
        if (targetProducts.includes(name) && !map[clientName].includes(name)) {
          map[clientName].push(name);
        }
      });
    });

    const prompt = this.getCrossSellOpportunitiesPrompt(JSON.stringify(map, null, 2));
    return this.generateMarkdownReport(prompt, enableThinking);
  }

  async getPartnerPerformanceReport(enableThinking = false): Promise<string> {
    const { purchases } = await this.orderService.loadAllOrdersWithAttributes(1, 100000, {});

    const partnerMap: Record<string, { revenue: number; orders: number }> = {};

    purchases.forEach((order: any) => {
      const client = order?.client_id;
      if (!client) return;
      const partner = client.vendor_id ?? 'Unknown Partner';
      if (!partnerMap[partner]) partnerMap[partner] = { revenue: 0, orders: 0 };

      let orderRevenue = order.base_cost ?? 0;
      partnerMap[partner].revenue += orderRevenue;
      partnerMap[partner].orders += 1;
    });

    const prompt = this.getPartnerPerformancePrompt(JSON.stringify(partnerMap, null, 2));
    return this.generateMarkdownReport(prompt, enableThinking);
  }
}
