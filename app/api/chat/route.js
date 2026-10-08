import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request) {
  try {
    const body = await request.json();

    const {
      question,
      stats,
      incidents,
    } = body;

    if (!question) {
      return Response.json(
        {
          error: "Question is required",
        },
        {
          status: 400,
        }
      );
    }

    /*
      We deliberately give the model only
      structured public information needed
      to answer questions.

      We are NOT asking it to predict crime.
    */

    const compactIncidents =
      (incidents || [])
        .slice(0, 100)
        .map((incident) => ({
          id: incident.id,
          reported: incident.reported,
          offenses: incident.offenses,
          location: incident.location,
          disposition: incident.disposition,
        }));

    const prompt = `
You are LionSafe AI, an assistant for a
student-built Penn State University Park
incident intelligence dashboard.

Answer the user's question ONLY using the
dataset provided below.

IMPORTANT RULES:

- Do not invent information.
- If the data cannot answer the question,
  clearly say so.
- Do not predict future crimes.
- Do not call a location "safe" or "unsafe."
- Do not calculate someone's personal chance
  of becoming a victim.
- Report counts may reflect population,
  events, activity, or reporting volume.
- When possible, cite the exact count from
  the supplied data.
- Make it clear that this represents the
  currently loaded sample, not every Penn
  State incident ever recorded.
- Keep answers concise and useful for students.

CURRENT SUMMARY:

${JSON.stringify(stats, null, 2)}

CURRENT INCIDENT RECORDS:

${JSON.stringify(compactIncidents, null, 2)}

USER QUESTION:

${question}
`;

    const response =
      await client.responses.create({
        model: "gpt-6-luna",
        input: prompt,
      });

    return Response.json({
      answer: response.output_text,
    });
  } catch (error) {
    console.error(
      "CHAT ERROR:",
      error
    );

    return Response.json(
      {
        error:
          "Unable to answer question",
        details:
          error?.message ||
          "Unknown error",
      },
      {
        status: 500,
      }
    );
  }
}