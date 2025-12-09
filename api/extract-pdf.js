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

PART 1 - PROJECT INFORMATION (Page 1):
- Project Name from "PROJECT:" field
- Application Date from "APPLICATION DATE:"
- Period Start/End from "PERIOD FROM:" and "PERIOD TO:"
Convert dates to YYYY-MM-DD format.

PART 2 - LINE ITEMS (Pages 2-4):
Extract from Schedule of Values table:
- Budget Code → CSI division
- Column B → Description
- Column C → Scheduled Value
- Column E → Work Completed This Period
- Column G → Total Completed to Date
- Column H → Balance to Finish
- % Complete column

Extract ALL line items including $0 values. Skip subtotals and headers.

Return ONLY this JSON format:
{
  "projectInfo": {
    "name": "project name",
    "payAppDate": "YYYY-MM-DD",
    "periodStart": "YYYY-MM-DD",
    "periodEnd": "YYYY-MM-DD"
  },
  "lineItems": [{
    "budgetCode": "division",
    "description": "description",
    "scheduledValue": "number",
    "workCompleted": "number",
    "totalCompletedToDate": "number",
    "balanceToFinish": "number",
    "percentComplete": "number"
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
