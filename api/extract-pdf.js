export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { base64Data } = req.body;
    
    if (!base64Data) {
      return res.status(400).json({ error: 'No PDF data provided' });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ 
        error: 'API key not configured. Add ANTHROPIC_API_KEY in Vercel environment variables.' 
      });
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01',
        'x-api-key': apiKey
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 8000,
        messages: [{
          role: 'user',
          content: [
            { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64Data } },
            { type: 'text', text: `You are analyzing an AIA G702/G703 pay application PDF.

PAGE 1 - G702 APPLICATION AND CERTIFICATE FOR PAYMENT:
Extract project information and summary totals from the numbered lines:
- PROJECT: field → project name
- PERIOD: field → period start and end dates (format as YYYY-MM-DD)
- Line 1: Original Contract Sum
- Line 3: Contract Sum to date (Line 1 + 2)
- Line 4: Total completed and stored to date (Column G on detail sheet)
- Line 8: Current payment due

PAGES 2+ - G703 CONTINUATION SHEET:
This is a table with columns A through I:
- Column A: Item No.
- Column B: Budget Code (like "17-200.O", "01-000.O", etc.)
- Column C: Description of Work
- Column D: Scheduled Value
- Column E: Work Completed This Period
- Column G: Total Completed and Stored to Date (D + E + F)
- Column H: Balance to Finish (C - G)
- Column G/C: % complete

Extract ALL line items from the table. Include items with $0.00 values.
Skip rows that say "TOTALS:" or "GRAND TOTALS:" or "Change Orders" section headers.

Return ONLY this JSON (no markdown, no extra text):
{
  "projectInfo": {
    "name": "project name from PAGE 1",
    "payAppDate": "YYYY-MM-DD from PAGE 1",
    "periodStart": "YYYY-MM-DD from PERIOD field",
    "periodEnd": "YYYY-MM-DD from PERIOD field"
  },
  "g702Totals": {
    "originalContractSum": "Line 1 value",
    "contractSumToDate": "Line 3 value",
    "totalCompletedToDate": "Line 4 value",
    "currentPaymentDue": "Line 8 value"
  },
  "lineItems": [{
    "budgetCode": "Column B value",
    "description": "Column C value",
    "scheduledValue": "Column D value as number",
    "workCompleted": "Column E value as number",
    "totalCompletedToDate": "Column G value as number",
    "balanceToFinish": "Column H value as number",
    "percentComplete": "% column as number"
  }]
}`}
          ]
        }]
      })
    });

    const data = await response.json();
    return res.status(200).json(data);

  } catch (error) {
    console.error('Function error:', error);
    return res.status(500).json({ error: error.message });
  }
}
