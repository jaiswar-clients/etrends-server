# Report Service Documentation

This document provides detailed information about the Report Service functionality in the AMC system. The Report Service is responsible for generating various financial and business reports using the Indian Financial Year format.

## Table of Contents
1. [Indian Financial Year](#indian-financial-year)
2. [Report Filtering Options](#report-filtering-options)
3. [Report Types](#report-types)
   - [Product-wise Revenue Distribution](#1-product-wise-revenue-distribution)
   - [Industry-wise Revenue Distribution](#2-industry-wise-revenue-distribution)
   - [Total Business Revenue](#3-total-business-revenue)
   - [AMC Annual Breakdown](#4-amc-annual-breakdown)
   - [Expected vs Received Chart Data](#5-expected-vs-received-chart-data)
   - [Industry Revenue Distribution](#6-industry-revenue-distribution)

## Indian Financial Year

All reports in the system use the Indian Financial Year (FY) format instead of the calendar year. The Indian Financial Year:

- Runs from April 1st to March 31st of the following year
- Is often represented as "FY23-24" (for April 1, 2023 to March 31, 2024)
- Is divided into four quarters:
  - Q1: April - June
  - Q2: July - September
  - Q3: October - December
  - Q4: January - March

This is different from the calendar year format where:
- The year runs from January 1st to December 31st
- Quarters are: Q1 (Jan-Mar), Q2 (Apr-Jun), Q3 (Jul-Sep), Q4 (Oct-Dec)

## Report Filtering Options

All reports support the following filter types:

- **monthly**: Data for a specific month or range of months
- **quarterly**: Data for a specific quarter or the current quarter
- **yearly**: Data for a specific Indian financial year
- **all**: Data for all time

Additional filter options may include:
- `startDate` and `endDate`: For custom date ranges
- `month` and `year`: For specific month filtering
- `quarter`: For specific quarter (e.g., "Q1 2023")
- `productId`: For filtering by specific product

## Report Types

### 1. Product-wise Revenue Distribution

**Method**: `getProductWiseRevenueDistribution`

**Purpose**: Provides revenue distribution across different products for a given period. This helps identify which products are generating the most revenue, creating a Pareto chart-like distribution.

**Data Sources**:
- Orders
- Customizations
- Licenses
- Additional Services

**Response Format**:
```json
[
  {
    "productId": "product_id",
    "productName": "Product Name",
    "revenue": 5000,
    "percentage": 25.5,
    "cumulativePercentage": 25.5
  },
  ...
]
```

**Usage Examples**:
- Identify top revenue-generating products
- Create Pareto charts (80/20 analysis)
- Track product performance over time

### 2. Industry-wise Revenue Distribution

**Method**: `getIndustryWiseRevenueDistribution`

**Purpose**: Provides revenue distribution across different industries over time. This helps understand which industries contribute most to the business revenue.

**Data Sources**:
- Orders
- Customizations
- Licenses
- Additional Services
- AMCs

**Response Format**:
```json
[
  {
    "period": "Q1 FY23-24",
    "industry": "Healthcare",
    "revenue": 8500
  },
  ...
]
```

**Usage Examples**:
- Identify key industry segments for the business
- Track industry trends over time
- Make strategic decisions on industry focus

### 3. Total Business Revenue

**Method**: `getTotalBussinessRevenue`

**Purpose**: Provides a breakdown of total business revenue separated by purchase billing and AMC billing over time.

**Data Sources**:
- Orders (payment terms)
- Customizations
- Licenses
- Additional Services
- AMCs (payments)

**Response Format**:
```json
[
  {
    "period": "FY23-24",
    "total_amc_billing": 3500,
    "total_purchase_billing": 12000
  },
  ...
]
```

**Usage Examples**:
- Track overall business performance
- Compare recurring revenue (AMC) vs one-time purchases
- Monitor financial growth trends

### 4. AMC Annual Breakdown

**Method**: `getAMCAnnualBreakdown`

**Purpose**: Provides a detailed breakdown of AMC revenue, comparing expected vs collected amounts over time periods. Supports optional filtering by product.

**Data Sources**:
- AMCs (excluding first payment, which is typically free maintenance)

**Response Format**:
```json
[
  {
    "period": "Q2 FY23-24",
    "totalExpected": 5000,
    "totalCollected": 4500
  },
  ...
]
```

**Usage Examples**:
- Track AMC collection efficiency
- Identify periods with payment gaps
- Monitor recurring revenue expectations vs reality

### 5. Expected vs Received Chart Data

**Method**: `getExpectedVsReceivedChartData`

**Purpose**: Provides comparative data of expected income vs actually received income across all revenue streams, useful for cash flow analysis.

**Data Sources**:
- Orders (payment terms)
- Customizations
- Licenses
- Additional Services
- AMCs (payments)

**Response Format**:
```json
[
  {
    "period": "FY23-24",
    "expected_amount": 15000,
    "received_amount": 14200
  },
  ...
]
```

**Usage Examples**:
- Cash flow analysis
- Financial planning
- Collection efficiency monitoring

### 6. Industry Revenue Distribution

**Method**: `fetchIndustryRevenueDistribution`

**Purpose**: Provides detailed revenue breakdown by industry and product, showing the contribution of each product within each industry.

**Data Sources**:
- Orders
- Customizations
- Licenses
- Additional Services
- AMCs

**Response Format**:
```json
[
  {
    "period": "Q3 FY23-24",
    "industry": "Manufacturing",
    "total": 7500,
    "Product A": 3000,
    "Product B": 4500
  },
  ...
]
```

**Usage Examples**:
- Analyze product-industry fit
- Identify cross-selling opportunities
- Develop industry-specific marketing strategies

## Implementation Notes

1. **Date Handling**: All dates are automatically converted to the appropriate Indian Financial Year format for consistent reporting.

2. **Data Aggregation**: Reports aggregate data from multiple sources (orders, licenses, AMCs, etc.) to provide a comprehensive view.

3. **Sorting**: Results are sorted in chronological order based on the period format (monthly, quarterly, or yearly).

4. **Revenue Calculation**:
   - For orders with multiple products, revenue is distributed based on:
     - Base cost separation if available
     - Equal distribution if separation is not defined

5. **Error Handling**: All report methods include error handling and will return HTTP 500 if any unexpected errors occur.

## Common Patterns

1. **Period Formatting**:
   - Monthly: "January 2023"
   - Quarterly: "Q1 FY23-24"
   - Yearly: "FY23-24"
   - All Time: "All Time"

2. **Report Filtering**: All reports follow a consistent pattern for filtering by time period.

3. **Data Processing Flow**:
   - Initialize date range based on filter options
   - Fetch raw data from database collections
   - Process and aggregate data
   - Format results according to period grouping
   - Sort data chronologically
   - Return formatted response 