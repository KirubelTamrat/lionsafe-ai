import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return Response.json(
        {
          error: "OPENAI_API_KEY is missing",
        },
        {
          status: 500,
        }
      );
    }
    const body = await request.json();
    const { stats } = body;

    if (!stats) {
      return Response.json(
        { error: "Stats are required" },
        { status: 400 }
      );
    }

    const prompt = `
You are the AI data analyst for LionSafe AI,
a student-built Penn State University Park
campus incident dashboard.

Analyze ONLY the statistics below.

Rules:
- Identify 2 to 3 interesting patterns.
- Explain them clearly for college students.
- Keep the response under 130 words.
- Do not call any location safe or unsafe.
- Do not predict future crime.
- Do not invent numbers.
- Do not infer anything about victims or suspects.
- Mention that higher report counts can reflect
  population, events, activity, or reporting volume
  and do not directly represent individual danger.

DATA:
${JSON.stringify(stats, null, 2)}
`;

    const response = await client.responses.create({
      model: "gpt-6-luna",
      input: prompt,
    });

    return Response.json({
      analysis: response.output_text,
    });
  } catch (error) {
  console.error("AI ERROR:", error);

  return Response.json(
    {
      error: "Unable to generate AI analysis",
      details: error?.message || "Unknown error",
    },
    {
      status: 500,
    }
  );
}
}