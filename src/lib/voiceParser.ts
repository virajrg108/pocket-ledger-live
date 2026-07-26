export interface ParsedTransaction {
  amount?: number;
  type?: 'Debit' | 'Credit' | 'Transfer';
  category?: 'Need' | 'Want' | 'Other';
  source?: string;
  toSource?: string;
  title?: string;
  timestamp?: string; // ISO string representation of the parsed date
}

export function parseVoiceCommand(text: string, accountNames: string[]): ParsedTransaction {
  const result: ParsedTransaction = {};
  const lowerText = text.toLowerCase();

  // 1. Amount
  const amountMatches = Array.from(lowerText.matchAll(/amount\s*:?\s*(\d+(\.\d{1,2})?)/g));
  if (amountMatches.length > 0) {
    const amountMatch = amountMatches[amountMatches.length - 1];
    result.amount = parseFloat(amountMatch[1]);
  }

  // 2. Cash Flow
  const cashFlowMatches = Array.from(lowerText.matchAll(/cash flow\s*:?\s*(debit|credit|transfer)/g));
  if (cashFlowMatches.length > 0) {
    const cashFlowMatch = cashFlowMatches[cashFlowMatches.length - 1];
    result.type = cashFlowMatch[1].charAt(0).toUpperCase() + cashFlowMatch[1].slice(1) as any;
  }

  // 3. Category
  const categoryMatches = Array.from(lowerText.matchAll(/category\s*:?\s*(need|want|other)/g));
  if (categoryMatches.length > 0) {
    const categoryMatch = categoryMatches[categoryMatches.length - 1];
    result.category = categoryMatch[1].charAt(0).toUpperCase() + categoryMatch[1].slice(1) as any;
  }

  // 4. Description
  const descriptionMatches = Array.from(lowerText.matchAll(/description\s*:?\s*(.+?)(?=\s*(amount|date|source account|cash flow|category|description|$))/g));
  if (descriptionMatches.length > 0) {
    const descriptionMatch = descriptionMatches[descriptionMatches.length - 1];
    result.title = descriptionMatch[1].trim().replace(/\b\w/g, c => c.toUpperCase());
  }

  // 5. Source Account
  const sourceMatches = Array.from(lowerText.matchAll(/source account\s*:?\s*(.+?)(?=\s*(amount|date|description|cash flow|category|source account|$))/g));
  if (sourceMatches.length > 0) {
    const sourceMatch = sourceMatches[sourceMatches.length - 1];
    const rawSource = sourceMatch[1].trim();
    // Try to fuzzy match with available accounts
    const matchedAccount = accountNames.find(acc => acc.toLowerCase() === rawSource) || 
                           accountNames.find(acc => acc.toLowerCase().includes(rawSource) || rawSource.includes(acc.toLowerCase()));
    result.source = matchedAccount || rawSource.replace(/\b\w/g, c => c.toUpperCase());
  }

  // 6. Date
  const dateMatches = Array.from(lowerText.matchAll(/date\s*:?\s*(.+?)(?=\s*(amount|description|source account|cash flow|category|date|$))/g));
  if (dateMatches.length > 0) {
    const dateMatch = dateMatches[dateMatches.length - 1];
    const dateStr = dateMatch[1].trim();
    const today = new Date();
    
    if (dateStr.includes('today')) {
      result.timestamp = today.toISOString();
    } else if (dateStr.includes('yesterday')) {
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      result.timestamp = yesterday.toISOString();
    } else if (dateStr.includes('day before yesterday')) {
      const dby = new Date(today);
      dby.setDate(dby.getDate() - 2);
      result.timestamp = dby.toISOString();
    } else {
      // Very naive date parser for "5th July" -> JS Date handles "5 July <current year>"
      // Remove ordinal suffixes
      const cleanDateStr = dateStr.replace(/(st|nd|rd|th)\b/g, '');
      const parsedDate = new Date(`${cleanDateStr} ${today.getFullYear()}`);
      if (!isNaN(parsedDate.getTime())) {
        result.timestamp = parsedDate.toISOString();
      }
    }
  }

  return result;
}
