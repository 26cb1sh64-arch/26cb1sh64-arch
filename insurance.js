
export default async function handler(req, res) {

    // Allow requests from your GitHub Pages website.
    const allowedOrigin = "https://26cb1sh64-arch.github.io";

    res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
        return res.status(204).end();
    }

    if (req.headers.origin !== allowedOrigin) {
        return res.status(403).json({
            error: "Origin not allowed"
        });
    }

    if (req.method !== "POST") {
        return res.status(405).json({
            error: "Method not allowed"
        });
    }

    try {

        const { category, age, coverage, details } = req.body || {};

        if (
            typeof category !== "string" ||
            typeof age !== "number" ||
            typeof coverage !== "number" ||
            !Number.isInteger(age) ||
            !Number.isSafeInteger(coverage) ||
            age < 18 || age > 100 ||
            coverage <= 0 ||
            coverage > 1000000000000 ||
            typeof details !== "string" ||
            details.length > 2000 ||
            !["Health Insurance", "Life Insurance",
              "Vehicle Insurance", "Travel Insurance", "Other"]
              .includes(category)
        ) {
            return res.status(400).json({
                error: "Invalid form information."
            });
        }

        if (!process.env.GEMINI_API_KEY) {
            return res.status(500).json({
                error: "Gemini API key is not configured."
            });
        }

        const prompt = `
You are InsureAI, an insurance information assistant.

Analyze the following user information:

Insurance Category: ${category}
Age: ${age}
Required Coverage: INR ${coverage}
Additional Information: ${details || "Not provided"}

Provide a structured response with these sections:

1. User Profile Summary
2. Understanding the Insurance Requirement
3. Important Coverage Considerations
4. Factors That May Affect Premium
5. Questions the User Should Consider
6. Recommendations and Next Steps

Rules:
- Explain everything in simple language.
- Do not invent insurance policy prices or premium amounts.
- Do not guarantee policy approval or claim settlement.
- Do not claim to know the user's medical or financial history.
- Clearly distinguish general information from verified policy facts.
- Do not present your response as professional financial advice.
`;

        const geminiResponse = await fetch(
            "https://generativelanguage.googleapis.com/v1beta/interactions",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-goog-api-key": process.env.GEMINI_API_KEY
                },
                body: JSON.stringify({
                    model: "gemini-3.8-flash",
                    input: prompt,
                    generation_config: {
                        thinking_level: "low"
                    }
                })
            }
        );

        const result = await geminiResponse.json();

        if (!geminiResponse.ok) {
            console.error("Gemini API error:", result);

            return res.status(502).json({
                error: "Gemini could not process the request."
            });
        }

        const reply = (result.steps || [])
            .filter(step => step.type === "model_output")
            .flatMap(step => step.content || [])
            .filter(part => part.type === "text")
            .map(part => part.text)
            .join("\n");

        if (!reply) {
            return res.status(502).json({
                error: "No text response received from Gemini."
            });
        }

        return res.status(200).json({
            reply: reply
        });

    } catch (error) {

        console.error("Server error:", error);

        return res.status(500).json({
            error: "Internal server error."
        });

    }
}
