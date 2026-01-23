//Implementation in Supabase Edge Function
const { createClient } = require('@supabase/supabase-js');
const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

exports.handler = async (event) => {
    if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method Not Allowed" };

    try {
        const { userInput, sender_id } = JSON.parse(event.body);

        // 1. NLP Extraction via Gemini
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        const prompt = `
      Extract 3 details from: "${userInput}"
      - target_username: person receiving the money
      - final_amount: the number (numeric)
      - expense_description: what it was for
      
      Return ONLY a JSON object. No markdown.
      Example: {"target_username": "rahul", "final_amount": 500, "expense_description": "dinner"}
    `;

        const result = await model.generateContent(prompt);
        const rawText = result.response.text();

        try {
            // 1. THE LOGIC GOES HERE
            // This looks for anything between the first { and the last }
            const jsonMatch = rawText.match(/\{[\s\S]*\}/);

            if (!jsonMatch) {
                throw new Error("Gemini didn't return valid JSON formatting");
            }

            const extracted = JSON.parse(jsonMatch[0]);

            // 2. NOW CALL SUPABASE
            const { data, error } = await supabase.rpc('create_expense_automated', {
                sender_id: sender_id,
                target_username: extracted.target_username,
                final_amount: extracted.final_amount,
                expense_description: extracted.expense_description
            });

            // ... rest of your code
        } catch (parseError) {
            return { statusCode: 400, body: JSON.stringify({ error: "Failed to parse AI response" }) };
        }

        const text = result.response.text().trim();
        // Cleanup if Gemini adds markdown code blocks
        const cleanJson = text.replace(/```json|```/g, "");
        const { target_username, final_amount, expense_description } = JSON.parse(cleanJson);

        // 2. Database Execution
        const { data, error } = await supabase.rpc('create_expense_automated', {
            sender_id,
            target_username,
            final_amount,
            expense_description
        });

        if (error) throw error;

        return {
            statusCode: 200,
            body: JSON.stringify({ success: true, logged: { target_username, final_amount, expense_description } })
        };

    } catch (err) {
        return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
    }
};