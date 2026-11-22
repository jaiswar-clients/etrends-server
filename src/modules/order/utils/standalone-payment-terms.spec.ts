import {
  buildPaymentTerms,
  effectivePaymentTerms,
  standaloneTermsDateFilter,
  summarizePaymentTerms,
  termAmount,
} from './standalone-payment-terms';

describe('standalone payment terms', () => {
  it('treats an item without terms as one 100% term from its legacy fields', () => {
    const legacy = {
      payment_status: 'pending',
      invoice_number: 'INV-1',
      invoice_date: '2025-05-01',
      payment_receive_date: null,
    };
    const [term] = effectivePaymentTerms(legacy, 5000);
    expect(term).toMatchObject({
      name: 'Full Payment',
      percentage_from_base_cost: 100,
      calculated_amount: 5000,
      status: 'to_be_created',
      invoice_number: 'INV-1',
    });
  });

  it('uses saved terms as they are', () => {
    const item = {
      payment_terms: [
        { name: 'Advance', calculated_amount: 300, status: 'paid' },
        { name: 'Balance', calculated_amount: 700, status: 'invoice' },
      ],
    };
    expect(effectivePaymentTerms(item, 1000)).toHaveLength(2);
  });

  it('derives the amount from the percentage when missing', () => {
    expect(termAmount({ percentage_from_base_cost: 40 }, 1000)).toBe(400);
    expect(termAmount({ percentage_from_base_cost: '25' }, 1000)).toBe(250);
    expect(
      termAmount(
        { calculated_amount: 123, percentage_from_base_cost: 40 },
        1000,
      ),
    ).toBe(123);
  });

  describe('summarizePaymentTerms', () => {
    it('paid only when every term is paid (latest receive date)', () => {
      const s = summarizePaymentTerms([
        {
          status: 'paid',
          invoice_date: '2025-01-10',
          invoice_number: 'A',
          payment_receive_date: '2025-02-01',
        },
        {
          status: 'paid',
          invoice_date: '2025-03-10',
          invoice_number: 'B',
          payment_receive_date: '2025-04-01',
        },
      ]);
      expect(s.payment_status).toBe('paid');
      expect(s.invoice_number).toBe('A'); // earliest invoiced term
      expect(s.payment_receive_date).toEqual(new Date('2025-04-01'));
    });

    it('invoice when any term is invoiced or paid; proforma / to_be_created otherwise', () => {
      expect(
        summarizePaymentTerms([{ status: 'paid' }, { status: 'to_be_created' }])
          .payment_status,
      ).toBe('invoice');
      expect(
        summarizePaymentTerms([
          { status: 'proforma' },
          { status: 'to_be_created' },
        ]).payment_status,
      ).toBe('proforma');
      expect(
        summarizePaymentTerms([{ status: 'to_be_created' }]).payment_status,
      ).toBe('to_be_created');
      expect(
        summarizePaymentTerms([{ status: 'invoice' }, { status: 'paid' }])
          .payment_receive_date,
      ).toBeNull();
    });
  });

  describe('buildPaymentTerms', () => {
    it('normalizes terms from the API', () => {
      const out = buildPaymentTerms(
        {
          payment_terms: [
            {
              name: 'Advance',
              percentage_from_base_cost: 50,
              status: 'invoice',
              invoice_number: 'X1',
              invoice_date: '2025-06-01',
            },
            { name: '', percentage_from_base_cost: 50, status: 'pending' },
          ],
        },
        2000,
      );
      expect(
        out.payment_terms.map((t) => [t.name, t.calculated_amount, t.status]),
      ).toEqual([
        ['Advance', 1000, 'invoice'],
        ['Term 2', 1000, 'to_be_created'],
      ]);
      expect(out.payment_terms[0].invoice_date).toEqual(new Date('2025-06-01'));
      expect(out.payment_status).toBe('invoice');
      expect(out.invoice_number).toBe('X1');
    });

    it('builds one term from legacy body fields when no terms are sent', () => {
      const out = buildPaymentTerms(
        {
          payment_status: 'paid',
          invoice_number: 'L1',
          invoice_date: '2025-01-01',
          payment_receive_date: '2025-01-20',
        },
        900,
      );
      expect(out.payment_terms).toHaveLength(1);
      expect(out.payment_terms[0]).toMatchObject({
        name: 'Full Payment',
        calculated_amount: 900,
        status: 'paid',
      });
      expect(out.payment_status).toBe('paid');
    });
  });

  it('date filter matches legacy invoice date, term invoice dates and (optionally) the purchase date', () => {
    const start = new Date('2025-04-01');
    const end = new Date('2026-03-31');
    expect(standaloneTermsDateFilter(start, end).$or).toHaveLength(2);
    const withPO = standaloneTermsDateFilter(start, end, 'purchase_date');
    expect(withPO.$or).toHaveLength(3);
    expect(withPO.$or[2]).toEqual({
      purchase_date: { $gte: start, $lte: end },
    });
  });
});
