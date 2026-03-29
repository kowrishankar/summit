import OpenAI from 'openai';
import type { ExtractedInvoiceData, LineItem } from '../types';
import { v4 as uuidv4 } from 'uuid';

const EXTRACTION_SCHEMA = `Extract invoice data and return a single JSON object (no markdown, no code block) with this shape. Use null for missing values. Amounts as numbers (no currency symbols). Detect the invoice currency (e.g. USD, EUR, GBP) from the document.

IMPORTANT - Dates: Invoice dates are in UK format (day first): DD/MM/YYYY or DD-MM-YYYY (e.g. 25/03/2025 = 25 March 2025). Always interpret dates as UK format (day, then month, then year). Output the "date" field as YYYY-MM-DD only (e.g. 2025-03-25).

{
  "issuedBy": string | null (the company or person ISSUING the receipt or invoice — the seller/vendor you pay on purchases; the business receiving payment on sales),
  "issuedTo": string | null (the CUSTOMER or party the document is issued to — "Bill to", "Sold to", "Customer", buyer name; on expenses this is often yourself or your business),
  "merchantName": string | null (trading or store name if shown; may match issuedBy),
  "merchantAddress": string | null,
  "merchantPhone": string | null,
  "merchantEmail": string | null,
  "merchantWebsite": string | null,
  "supplierName": string | null (legal or parent supplier name only if clearly different from issuedBy/merchant),
  "vatAmount": number | null,
  "category": string | null (whenever you can infer it from merchant, supplier, or line items: a SHORT bookkeeping label — do not leave null if the type of spend or income is reasonably clear),
  "currency": string | null (ISO 4217 code e.g. USD, EUR, GBP),
  "amount": number,
  "date": string (YYYY-MM-DD; interpret source dates as UK format DD/MM/YYYY),
  "paymentType": string | null (e.g. Card, Bank transfer, Cash, Invoice, Credit),
  "ownedBy": string | null (optional duplicate of issuedTo for compatibility),
  "documentReference": string | null (invoice number, reference, or order ID),
  "lineItems": Array<{
    "description": string,
    "quantity": number,
    "unitPrice": number,
    "totalPrice": number,
    "taxRate": number | null,
    "taxAmount": number | null,
    "taxType": string | null
  }>
}`;

export function getOpenAIClient(): OpenAI | null {
  const apiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY;
  if (!apiKey) return null;
  return new OpenAI({ apiKey });
}

function docKindCategoryHint(docKind: 'invoice' | 'sale'): string {
  if (docKind === 'sale') {
    return ' For "category", infer a concise UK-friendly INCOME label when possible (e.g. Services, Product sales, Consulting, Fees, Other income). Prefer a specific label over null.';
  }
  return ' For "category", infer a concise UK-friendly EXPENSE label when possible (e.g. Travel, Meals, Software subscriptions, Office supplies, Rent, Utilities, Motor fuel, Groceries, Professional fees, Insurance, Telecommunications). Prefer a specific label over null.';
}

function docKindPartyHint(docKind: 'invoice' | 'sale'): string {
  if (docKind === 'sale') {
    return ' For SALES/INCOME: issuedBy = the business or person issuing the receipt (seller). issuedTo = the customer or client paying (buyer). When both appear on the document, never swap them.';
  }
  return ' For PURCHASES/EXPENSES: issuedBy = the shop, supplier, or vendor that issued the receipt (seller). issuedTo = the billed-to party (often you or your company — "Bill to", "Customer"). When both appear, never swap them.';
}

function extractionHints(docKind: 'invoice' | 'sale'): string {
  return `${docKindCategoryHint(docKind)} ${docKindPartyHint(docKind)}`;
}

export async function extractFromText(
  text: string,
  docKind: 'invoice' | 'sale' = 'invoice'
): Promise<ExtractedInvoiceData> {
  const openai = getOpenAIClient();
  if (!openai) {
    return mockExtraction(text);
  }
  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: `You are an invoice data extractor. ${EXTRACTION_SCHEMA}${extractionHints(docKind)}`,
      },
      {
        role: 'user',
        content: `Extract invoice data from this text:\n\n${text.slice(0, 12000)}`,
      },
    ],
    response_format: { type: 'json_object' },
  });
  const content = response.choices[0]?.message?.content;
  if (!content) return mockExtraction(text);
  try {
    const parsed = JSON.parse(content) as Record<string, unknown>;
    return normalizeExtraction(parsed);
  } catch {
    return mockExtraction(text);
  }
}

export async function extractFromImageBase64(
  base64Image: string,
  mimeType: string,
  docKind: 'invoice' | 'sale' = 'invoice'
): Promise<ExtractedInvoiceData> {
  const openai = getOpenAIClient();
  if (!openai) {
    return mockExtraction('Image received (no API key).');
  }
  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: `You are an invoice data extractor. Analyze the invoice image and return a single JSON object (no markdown). ${EXTRACTION_SCHEMA}${extractionHints(docKind)}`,
      },
      {
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: {
              url: `data:${mimeType};base64,${base64Image}`,
            },
          },
        ],
      },
    ],
    response_format: { type: 'json_object' },
    max_tokens: 4096,
  });
  const content = response.choices[0]?.message?.content;
  if (!content) return mockExtraction('Image');
  try {
    const parsed = JSON.parse(content) as Record<string, unknown>;
    return normalizeExtraction(parsed);
  } catch {
    return mockExtraction('Image');
  }
}

/** Extract invoice data by sending the PDF directly to GPT-4 (vision-capable model with PDF support). */
export async function extractFromPdfBase64(
  pdfBase64: string,
  filename?: string,
  docKind: 'invoice' | 'sale' = 'invoice'
): Promise<ExtractedInvoiceData> {
  const openai = getOpenAIClient();
  if (!openai) {
    return mockExtraction('PDF (no API key).');
  }
  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: `You are an invoice data extractor. Analyze the PDF invoice and return a single JSON object (no markdown). ${EXTRACTION_SCHEMA}${extractionHints(docKind)}`,
      },
      {
        role: 'user',
        content: [
          {
            type: 'file',
            file: {
              file_data: `data:application/pdf;base64,${pdfBase64}`,
              filename: filename || 'invoice.pdf',
            },
          },
          {
            type: 'text',
            text: 'Extract invoice data from this PDF and return the JSON object only.',
          },
        ],
      },
    ],
    response_format: { type: 'json_object' },
    max_tokens: 4096,
  });
  const content = response.choices[0]?.message?.content;
  if (!content) return mockExtraction('PDF');
  try {
    const parsed = JSON.parse(content) as Record<string, unknown>;
    return normalizeExtraction(parsed);
  } catch {
    return mockExtraction('PDF');
  }
}

/** Extract from multiple images in order (e.g. long receipt split into sections). Sends all images in one request. */
export async function extractFromMultipleImagesBase64(
  images: Array<{ base64: string; mimeType: string }>,
  docKind: 'invoice' | 'sale' = 'invoice'
): Promise<ExtractedInvoiceData> {
  const openai = getOpenAIClient();
  if (!openai || images.length === 0) {
    return mockExtraction('Images (no API key or empty).');
  }
  if (images.length === 1) {
    return extractFromImageBase64(images[0].base64, images[0].mimeType, docKind);
  }
  const content: Array<{ type: 'image_url'; image_url: { url: string } } | { type: 'text'; text: string }> = [];
  for (const img of images) {
    content.push({
      type: 'image_url',
      image_url: { url: `data:${img.mimeType};base64,${img.base64}` },
    });
  }
  content.push({
    type: 'text',
    text: 'The above images are consecutive sections of a single long receipt or invoice, in order from top to bottom. Extract invoice data from the combined content and return one JSON object for the whole receipt.',
  });
  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: `You are an invoice data extractor. ${EXTRACTION_SCHEMA}${extractionHints(docKind)}`,
      },
      { role: 'user', content },
    ],
    response_format: { type: 'json_object' },
    max_tokens: 4096,
  });
  const responseContent = response.choices[0]?.message?.content;
  if (!responseContent) return mockExtraction('Images');
  try {
    const parsed = JSON.parse(responseContent) as Record<string, unknown>;
    return normalizeExtraction(parsed);
  } catch {
    return mockExtraction('Images');
  }
}

function strField(v: unknown): string | undefined {
  if (typeof v !== 'string') return undefined;
  const t = v.trim();
  return t.length ? t : undefined;
}

function normalizeExtraction(parsed: Record<string, unknown>): ExtractedInvoiceData {
  const lineItems = (parsed.lineItems as unknown[] | undefined) || [];

  const issuedTo = strField(parsed.issuedTo) ?? strField(parsed.ownedBy);
  const issuedBy =
    strField(parsed.issuedBy) ?? strField(parsed.merchantName) ?? strField(parsed.supplierName);

  const merchantNameRaw = strField(parsed.merchantName);
  const supplierNameRaw = strField(parsed.supplierName);

  const merchantName = issuedBy ?? merchantNameRaw ?? supplierNameRaw;

  let supplierName: string | undefined = supplierNameRaw;
  if (!supplierName || (merchantName && supplierName === merchantName)) {
    supplierName = undefined;
  }

  const ownedBy = issuedTo ?? strField(parsed.ownedBy);

  return {
    issuedBy,
    issuedTo,
    merchantName,
    merchantAddress: typeof parsed.merchantAddress === 'string' ? parsed.merchantAddress : undefined,
    merchantPhone: typeof parsed.merchantPhone === 'string' ? parsed.merchantPhone : undefined,
    merchantEmail: typeof parsed.merchantEmail === 'string' ? parsed.merchantEmail : undefined,
    merchantWebsite: typeof parsed.merchantWebsite === 'string' ? parsed.merchantWebsite : undefined,
    supplierName,
    vatAmount: typeof parsed.vatAmount === 'number' ? parsed.vatAmount : undefined,
    category: typeof parsed.category === 'string' ? parsed.category : undefined,
    currency: typeof parsed.currency === 'string' ? parsed.currency : undefined,
    amount: typeof parsed.amount === 'number' ? parsed.amount : 0,
    date: typeof parsed.date === 'string' ? parsed.date : new Date().toISOString().slice(0, 10),
    paymentType: typeof parsed.paymentType === 'string' ? parsed.paymentType : undefined,
    ownedBy,
    documentReference: typeof parsed.documentReference === 'string' ? parsed.documentReference : undefined,
    lineItems: lineItems.map((item: unknown, i: number) => {
      const o = item as Record<string, unknown>;
      return {
        id: uuidv4(),
        description: typeof o.description === 'string' ? o.description : `Item ${i + 1}`,
        quantity: typeof o.quantity === 'number' ? o.quantity : 1,
        unitPrice: typeof o.unitPrice === 'number' ? o.unitPrice : 0,
        totalPrice: typeof o.totalPrice === 'number' ? o.totalPrice : 0,
        taxRate: typeof o.taxRate === 'number' ? o.taxRate : undefined,
        taxAmount: typeof o.taxAmount === 'number' ? o.taxAmount : undefined,
        taxType: typeof o.taxType === 'string' ? o.taxType : undefined,
      } as LineItem;
    }),
  };
}

function mockExtraction(source: string): ExtractedInvoiceData {
  return {
    issuedBy: 'Sample Merchant',
    issuedTo: undefined,
    merchantName: 'Sample Merchant',
    merchantAddress: undefined,
    merchantPhone: undefined,
    merchantEmail: undefined,
    merchantWebsite: undefined,
    supplierName: undefined,
    vatAmount: undefined,
    category: undefined,
    currency: 'GBP',
    amount: 0,
    date: new Date().toISOString().slice(0, 10),
    paymentType: undefined,
    ownedBy: undefined,
    documentReference: undefined,
    lineItems: [{ id: uuidv4(), description: source || 'Manual entry', quantity: 1, unitPrice: 0, totalPrice: 0 }],
  };
}
