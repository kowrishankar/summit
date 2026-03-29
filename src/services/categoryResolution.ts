import type { Category, ExtractedInvoiceData } from '../types';
import { getOpenAIClient } from './invoiceExtraction';

function normalizeKey(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Map an extracted or inferred label to an existing category when names align (exact, contains, word overlap). */
export function findBestCategoryMatch(label: string, categories: Category[]): Category | null {
  const n = normalizeKey(label);
  if (!n) return null;
  for (const c of categories) {
    if (normalizeKey(c.name) === n) return c;
  }
  for (const c of categories) {
    const cn = normalizeKey(c.name);
    if (cn.length < 3 || n.length < 3) continue;
    if (n.includes(cn) || cn.includes(n)) return c;
  }
  const words = new Set(n.split(/\s+/).filter((w) => w.length > 2));
  let best: Category | null = null;
  let bestScore = 0;
  for (const c of categories) {
    const cn = normalizeKey(c.name);
    const cw = cn.split(/\s+/).filter((w) => w.length > 2);
    let score = 0;
    for (const w of cw) {
      if (words.has(w)) score += 2;
    }
    for (const w of words) {
      if (cn.includes(w)) score += 1;
    }
    if (score > bestScore) {
      bestScore = score;
      best = c;
    }
  }
  if (best && bestScore >= 1) return best;
  return null;
}

const INVOICE_RULES: Array<{ re: RegExp; label: string }> = [
  { re: /petrol|diesel|fuel|filling station|\bshell\b|\besso\b|\bbp\b|texaco|motorway services/i, label: 'Motor fuel' },
  { re: /parking|ncp\b|ringgo|paybyphone/i, label: 'Travel' },
  { re: /train|national rail|tfl|oyster|eurostar|flight|airline|booking\.com|hotel|airbnb|uber|bolt|lyft|taxi|cab\b/i, label: 'Travel' },
  { re: /tesco|sainsbury|asda|aldi|lidl|waitrose|morrisons|iceland|co-?op|supermarket|grocery|food hall/i, label: 'Groceries' },
  { re: /amazon|ebay|argos|currys|john lewis|retail|shop|store|clothing|fashion/i, label: 'Retail' },
  { re: /restaurant|cafe|coffee|starbucks|costa|pret|mcdonald|kfc|deliveroo|just eat|uber eats|takeaway|pub\b|dining/i, label: 'Meals' },
  { re: /openai|github|microsoft 365|google workspace|slack|zoom|saas|subscription|software|hosting|cloud|adobe|notion/i, label: 'Software' },
  { re: /rent|landlord|letting|estate agent|housing/i, label: 'Rent' },
  { re: /electric|gas\b|water\b|utility|council tax|broadband|wifi|internet|ee\b|vodafone|o2\b|three\.|utility warehouse/i, label: 'Utilities' },
  { re: /insurance|aviva|direct line|admiral/i, label: 'Insurance' },
  { re: /accountant|solicitor|legal|law firm|consulting fee|professional fee/i, label: 'Professional fees' },
  { re: /stationery|office depot|staples|office supplies|paper|ink/i, label: 'Office supplies' },
  { re: /post office|royal mail|dhl|fedex|parcel|courier|shipping/i, label: 'Postage & delivery' },
  { re: /marketing|advertising|facebook ads|google ads/i, label: 'Marketing' },
  { re: /gym|fitness|sport|leisure/i, label: 'Entertainment' },
  { re: /pharmacy|boots|superdrug|chemist|medical|dental|optician/i, label: 'Medical' },
];

const SALE_RULES: Array<{ re: RegExp; label: string }> = [
  { re: /consult|advisory|professional service|legal service|accounting service/i, label: 'Consulting' },
  { re: /product|goods|merchandise|retail sale|inventory/i, label: 'Product sales' },
  { re: /subscription|recurring|membership|saas/i, label: 'Subscription income' },
  { re: /fee|commission|service charge/i, label: 'Fees' },
  { re: /training|course|workshop|education/i, label: 'Training' },
];

/** Rule-based category when the model omitted `category`. */
export function inferCategoryLabelFromExtracted(
  extracted: ExtractedInvoiceData,
  docKind: 'invoice' | 'sale'
): string | null {
  const parts = [
    extracted.merchantName,
    extracted.supplierName,
    ...extracted.lineItems.map((l) => l.description),
  ]
    .filter((x): x is string => Boolean(x && String(x).trim()))
    .join(' ');
  if (!parts.trim()) return null;
  const rules = docKind === 'sale' ? SALE_RULES : INVOICE_RULES;
  for (const { re, label } of rules) {
    if (re.test(parts)) return label;
  }
  return null;
}

async function suggestCategoryWithOpenAI(
  extracted: ExtractedInvoiceData,
  categoryNames: string[],
  docKind: 'invoice' | 'sale'
): Promise<string | null> {
  const openai = getOpenAIClient();
  if (!openai) return null;
  const payload = {
    merchant: extracted.merchantName ?? extracted.supplierName ?? null,
    lineDescriptions: extracted.lineItems.slice(0, 12).map((l) => l.description),
    existingCategoryNames: categoryNames,
  };
  const kindHint =
    docKind === 'sale'
      ? 'This is INCOME / sales. Pick an income category.'
      : 'This is an EXPENSE / purchase. Pick an expense category.';
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `UK bookkeeping helper. ${kindHint} Return a single JSON object: {"category":"..."}. 
The value must be EITHER exactly one string from existingCategoryNames (verbatim) OR a new short label (2–4 words, Title Case) if none fit.
If existingCategoryNames is empty, invent one sensible short label.`,
        },
        { role: 'user', content: JSON.stringify(payload) },
      ],
      response_format: { type: 'json_object' },
      max_tokens: 120,
    });
    const content = response.choices[0]?.message?.content;
    if (!content) return null;
    const parsed = JSON.parse(content) as { category?: string };
    const c = typeof parsed.category === 'string' ? parsed.category.trim() : '';
    return c || null;
  } catch {
    return null;
  }
}

async function tryResolveLabelToId(
  label: string,
  categories: Category[],
  addCategory: (name: string, color?: string) => Promise<Category>
): Promise<string | null> {
  const trimmed = label.trim();
  if (!trimmed) return null;
  const matched = findBestCategoryMatch(trimmed, categories);
  if (matched) return matched.id;
  try {
    const created = await addCategory(trimmed);
    return created.id;
  } catch {
    return null;
  }
}

/**
 * Resolves a category id for save: respects user picker, then extracted name (with fuzzy match),
 * then rule-based inference, then a small OpenAI pick. Avoids leaving records uncategorised when possible.
 */
export async function resolveCategoryIdForSave(options: {
  userSelectedCategoryId: string | null;
  extracted: ExtractedInvoiceData;
  categories: Category[];
  docKind: 'invoice' | 'sale';
  addCategory: (name: string, color?: string) => Promise<Category>;
}): Promise<string | null> {
  const { userSelectedCategoryId, extracted, categories, docKind, addCategory } = options;
  if (userSelectedCategoryId) return userSelectedCategoryId;

  const tried = new Set<string>();
  const tryLabel = async (label: string | null | undefined): Promise<string | null> => {
    const t = label?.trim();
    if (!t) return null;
    const key = t.toLowerCase();
    if (tried.has(key)) return null;
    tried.add(key);
    return tryResolveLabelToId(t, categories, addCategory);
  };

  let id = await tryLabel(extracted.category);
  if (id) return id;

  id = await tryLabel(inferCategoryLabelFromExtracted(extracted, docKind));
  if (id) return id;

  const aiLabel = await suggestCategoryWithOpenAI(
    extracted,
    categories.map((c) => c.name),
    docKind
  );
  id = await tryLabel(aiLabel);
  if (id) return id;

  const fallback =
    docKind === 'sale' ? 'General income' : 'General expenses';
  return tryResolveLabelToId(fallback, categories, addCategory);
}
