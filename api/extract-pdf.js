export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // Handle preflight request
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { base64Data } = req.body;

    if (!base64Data) {
      return res.status(400).json({ error: 'No PDF data provided' });
    }

    // Check if API key exists
    if (!process.env.ANTHROPIC_API_KEY) {
      console.error('ANTHROPIC_API_KEY environment variable is not set');
      return res.status(500).json({ 
        error: 'Server configuration error', 
        message: 'API key not configured' 
      });
    }

    console.log('API Key present:', process.env.ANTHROPIC_API_KEY ? 'Yes' : 'No');
    console.log('PDF data size:', base64Data.length);

    // Call Anthropic API
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'document',
              source: {
                type: 'base64',
                media_type: 'application/pdf',
                data: base64Data
              }
            },
            {
              type: 'text',
              text: `You are analyzing an AIA G703 Continuation Sheet (pay application). Look at pages 2-4 which contain a table with these columns:

Column A: Item Number
Column B: Description of Work
Column C: Scheduled Value (total contract amount)
Column D: Work Completed from Previous Application
Column E: This Period (WORK COMPLETED THIS BILLING PERIOD - THIS IS THE PAYMENT REQUEST)
Column F: Materials Presently Stored
Column G: Total Completed and Stored to Date (D + E + F)
Column H: % Complete (G/C)
Column I: Balance to Finish (C - G)

CRITICAL INSTRUCTIONS:
1. Extract ONLY rows where Column E "This Period" has a dollar value greater than $0
2. EXCLUDE any row where the description contains: "LABOR", "OH & FEE", "OVERHEAD", "PROFIT", "GENERAL CONDITIONS", "BOND", "INSURANCE", "PERMIT", "FEE", "SUPERVISION", "MOBILIZATION"
3. For each qualifying row, extract Column B (description), Column E (This Period), and Column G (Total Completed to Date)

Return a JSON object with this EXACT structure:
{
  "projectInfo": {
    "name": "project name from top of form",
    "payAppDate": "application date in YYYY-MM-DD format",
    "periodStart": "period start date in YYYY-MM-DD format",
    "periodEnd": "period end date in YYYY-MM-DD format"
  },
  "lineItems": [
    {
      "description": "exact text from Column B",
      "needsVerification": true,
      "workCompletedThisPeriod": "dollar amount from Column E without $ or commas",
      "valueRequested": "dollar amount from Column G without $ or commas"
    }
  ]
}

Return ONLY valid JSON with no markdown formatting, no explanation, no preamble.`
            }
          ]
        })
      })
    });

    console.log('Anthropic API response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Anthropic API error:', errorText);
      return res.status(response.status).json({ 
        error: 'API request failed', 
        details: errorText 
      });
    }

    const data = await response.json();
    console.log('Successfully received data from Anthropic');
    
    // Return the response from Anthropic
    return res.status(200).json(data);

  } catch (error) {
    console.error('Error in extract-pdf function:', error);
    console.error('Error stack:', error.stack);
    return res.status(500).json({ 
      error: 'Internal server error', 
      message: error.message,
      stack: error.stack
    });
  }
}
