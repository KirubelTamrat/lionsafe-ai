"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

const CampusMap = dynamic(
  () => import("@/components/CampusMap"),
  {
    ssr: false,
  }
);

export default function Home() {
  const [data, setData] = useState(null);
  const [analysis, setAnalysis] = useState("");
  const [loading, setLoading] = useState(true);

  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState([]);
  const [chatLoading, setChatLoading] = useState(false);

  // Load Penn State incident data + AI summary
  useEffect(() => {
    async function loadDashboard() {
      try {
        const response = await fetch("/api/incidents");

        if (!response.ok) {
          throw new Error("Could not load incident data");
        }

        const result = await response.json();
        setData(result);

        const aiResponse = await fetch("/api/analyze", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            stats: result.stats,
          }),
        });

        if (aiResponse.ok) {
          const aiResult = await aiResponse.json();
          setAnalysis(aiResult.analysis);
        } else {
          setAnalysis("AI analysis is currently unavailable.");
        }
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    }

    loadDashboard();
  }, []);

  async function askLionSafe() {
    if (!question.trim() || !data) return;

    const userQuestion = question;
    setQuestion("");

    setMessages((previous) => [
      ...previous,
      {
        role: "user",
        text: userQuestion,
      },
    ]);

    setChatLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          question: userQuestion,
          stats: data.stats,
          incidents: data.incidents,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Chat failed");
      }

      setMessages((previous) => [
        ...previous,
        {
          role: "assistant",
          text: result.answer,
        },
      ]);
    } catch (error) {
      console.error(error);

      setMessages((previous) => [
        ...previous,
        {
          role: "assistant",
          text: "I couldn't analyze the dataset right now.",
        },
      ]);
    } finally {
      setChatLoading(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="text-3xl font-bold mb-3">
            LionSafe AI
          </div>
          <div className="text-slate-500">
            Loading Penn State incident data...
          </div>
        </div>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        Unable to load data.
      </main>
    );
  }

  const stats = data.stats;

  const maxOffense = Math.max(
    ...stats.topOffenses.map((item) => item.count),
    1
  );

  const maxTime = Math.max(
    ...stats.timeBuckets.map((item) => item.count),
    1
  );

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="max-w-7xl mx-auto px-6 py-10">

        {/* HEADER */}

        <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 mb-10">
          <div>
            <div className="text-blue-400 text-sm font-semibold tracking-[0.2em] mb-2">
              PENN STATE UNIVERSITY PARK
            </div>

            <h1 className="text-5xl font-bold">
              LionSafe
              <span className="text-blue-400"> AI</span>
            </h1>

            <p className="text-slate-400 mt-3 max-w-2xl">
              Turning Penn State&apos;s public incident reports
              into interactive campus intelligence.
            </p>
          </div>

          <div className="border border-emerald-800 bg-emerald-950/50 text-emerald-400 px-4 py-2 rounded-full text-sm">
            ● LIVE DATA
          </div>
        </header>

        {/* STAT CARDS */}


        <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
          <StatCard
            label="REPORTS ANALYZED"
            value={stats.totalIncidents}
          />

          <StatCard
            label="OPEN CASES"
            value={stats.openCases}
          />

          <StatCard
            label="TOP CATEGORY"
            value={stats.topOffenses[0]?.name || "N/A"}
          />

          <StatCard
            label="TOP REPORTED LOCATION"
            value={stats.topLocations[0]?.name || "N/A"}
          />
        </section>

        {/* INTERACTIVE CAMPUS MAP */}

        <section className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden mb-8">

          <div className="p-6 border-b border-slate-800">

            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">

              <div>
                <div className="text-blue-400 text-xs font-semibold tracking-[0.2em] mb-2">
                  GEOSPATIAL INTELLIGENCE
                </div>

                <h2 className="text-2xl font-semibold">
                  Penn State Campus Map
                </h2>

                <p className="text-slate-500 mt-2">
                  Explore official University Park building GIS data.
                </p>
              </div>

              <div className="text-sm text-slate-500">
                1,287 GIS features loaded
              </div>

            </div>

          </div>

          <CampusMap incidents={data.incidents}/>

        </section>

        {/* CHARTS */}

        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">

          <Panel
            title="Reports by Category"
            subtitle="Most frequently listed offense categories"
          >
            <div className="space-y-5">
              {stats.topOffenses.map((item) => (
                <Bar
                  key={item.name}
                  name={item.name}
                  count={item.count}
                  width={(item.count / maxOffense) * 100}
                />
              ))}
            </div>
          </Panel>

          <Panel
            title="Reports by Time of Day"
            subtitle="Grouped using reported time"
          >
            <div className="space-y-5">
              {stats.timeBuckets.map((item) => (
                <Bar
                  key={item.name}
                  name={item.name}
                  count={item.count}
                  width={(item.count / maxTime) * 100}
                />
              ))}
            </div>
          </Panel>

        </section>

        {/* AI BRIEF + LOCATIONS */}

        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">

          <div className="rounded-2xl border border-blue-900 bg-gradient-to-br from-blue-950/70 to-slate-900 p-6">
            <div className="text-blue-400 text-sm font-semibold mb-2">
              ✦ AI DATA ANALYST
            </div>

            <h2 className="text-2xl font-semibold mb-5">
              LionSafe Brief
            </h2>

            <p className="text-slate-300 leading-7 whitespace-pre-line">
              {analysis}
            </p>
          </div>

          <Panel
            title="Most Reported Locations"
            subtitle="Report volume does not measure individual danger"
          >
            <div>
              {stats.topLocations.map((location, index) => (
                <div
                  key={location.name}
                  className="flex justify-between items-center py-4 border-b border-slate-800 last:border-none"
                >
                  <div>
                    <span className="text-slate-600 mr-4">
                      {index + 1}
                    </span>

                    <span className="font-medium">
                      {location.name}
                    </span>
                  </div>

                  <span className="bg-slate-800 text-blue-400 px-3 py-1 rounded-lg font-semibold">
                    {location.count}
                  </span>
                </div>
              ))}
            </div>
          </Panel>

        </section>

        {/* CHAT */}

        <section className="bg-slate-900 border border-slate-800 rounded-2xl mb-6 overflow-hidden">

          <div className="border-b border-slate-800 p-6">
            <div className="text-blue-400 text-sm font-semibold mb-2">
              ✦ INTERACTIVE AI
            </div>

            <h2 className="text-2xl font-semibold">
              Ask LionSafe
            </h2>

            <p className="text-slate-500 mt-2">
              Ask questions about the currently loaded Penn State incident dataset.
            </p>
          </div>

          <div className="p-6">

            {/* SAMPLE QUESTIONS */}

            {messages.length === 0 && (
              <div className="mb-6">
                <p className="text-xs text-slate-500 tracking-wider mb-3">
                  TRY ASKING
                </p>

                <div className="flex flex-wrap gap-2">
                  {[
                    "What time has the most reports?",
                    "What are the top incident categories?",
                    "How many cases are open?",
                    "What patterns stand out?",
                  ].map((suggestion) => (
                    <button
                      key={suggestion}
                      onClick={() => setQuestion(suggestion)}
                      className="bg-slate-800 hover:bg-slate-700 border border-slate-700 px-4 py-2 rounded-full text-sm text-slate-300 transition"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* CHAT MESSAGES */}

            <div className="space-y-4 mb-6 max-h-[400px] overflow-y-auto">
              {messages.map((message, index) => (
                <div
                  key={index}
                  className={
                    message.role === "user"
                      ? "flex justify-end"
                      : "flex justify-start"
                  }
                >
                  <div
                    className={
                      message.role === "user"
                        ? "max-w-[80%] bg-blue-600 rounded-2xl rounded-br-md px-4 py-3"
                        : "max-w-[80%] bg-slate-800 rounded-2xl rounded-bl-md px-4 py-3 text-slate-200"
                    }
                  >
                    {message.text}
                  </div>
                </div>
              ))}

              {chatLoading && (
                <div className="flex justify-start">
                  <div className="bg-slate-800 text-slate-400 px-4 py-3 rounded-2xl">
                    Analyzing Penn State data...
                  </div>
                </div>
              )}
            </div>

            {/* INPUT */}

            <form
              onSubmit={(event) => {
                event.preventDefault();
                askLionSafe();
              }}
              className="flex gap-3"
            >
              <input
                value={question}
                onChange={(event) =>
                  setQuestion(event.target.value)
                }
                placeholder="Ask about incident patterns..."
                className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 outline-none focus:border-blue-500"
              />

              <button
                type="submit"
                disabled={chatLoading || !question.trim()}
                className="bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 px-6 py-3 rounded-xl font-semibold transition"
              >
                Ask
              </button>
            </form>

          </div>
        </section>

        {/* INCIDENT TABLE */}

        <Panel
          title="Recent University Park Reports"
          subtitle="Public Penn State University Police data"
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px]">

              <thead>
                <tr className="text-left text-xs text-slate-500 tracking-wider">
                  <th className="pb-4">REPORTED</th>
                  <th className="pb-4">LOCATION</th>
                  <th className="pb-4">CATEGORY</th>
                  <th className="pb-4">STATUS</th>
                </tr>
              </thead>

              <tbody>
                {data.incidents.slice(0, 10).map((incident) => (
                  <tr
                    key={incident.id}
                    className="border-t border-slate-800"
                  >
                    <td className="py-4 pr-6 text-sm text-slate-400">
                      {incident.reported}
                    </td>

                    <td className="py-4 pr-6 font-medium">
                      {incident.location}
                    </td>

                    <td className="py-4 pr-6 text-slate-300">
                      {incident.offenses?.[0] || "Other"}
                    </td>

                    <td className="py-4">
                      <StatusBadge status={incident.disposition} />
                    </td>
                  </tr>
                ))}
              </tbody>

            </table>
          </div>
        </Panel>

        <footer className="text-center text-xs text-slate-600 mt-8 max-w-3xl mx-auto leading-5">
          LionSafe AI analyzes publicly reported Penn State Police
          information for educational purposes. Report frequency does
          not determine the safety of a location or an individual&apos;s
          probability of experiencing harm.
        </footer>

      </div>
    </main>
  );
}

function StatCard({ label, value }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
      <div className="text-xs text-slate-500 font-semibold tracking-wider mb-3">
        {label}
      </div>

      <div className="text-2xl font-bold break-words">
        {value}
      </div>
    </div>
  );
}

function Panel({ title, subtitle, children }) {
  return (
    <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
      <h2 className="text-xl font-semibold">
        {title}
      </h2>

      {subtitle && (
        <p className="text-sm text-slate-500 mt-1 mb-6">
          {subtitle}
        </p>
      )}

      {!subtitle && <div className="mb-6" />}

      {children}
    </section>
  );
}

function Bar({ name, count, width }) {
  return (
    <div>
      <div className="flex justify-between gap-4 mb-2">
        <span className="text-sm text-slate-300">
          {name}
        </span>

        <span className="text-blue-400 font-semibold">
          {count}
        </span>
      </div>

      <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
        <div
          className="h-full bg-blue-500 rounded-full"
          style={{
            width: `${width}%`,
          }}
        />
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  const open =
    status?.toLowerCase().includes("open");

  return (
    <span
      className={
        open
          ? "bg-amber-950 text-amber-400 px-3 py-1 rounded-full text-xs"
          : "bg-slate-800 text-slate-400 px-3 py-1 rounded-full text-xs"
      }
    >
      {status || "Unknown"}
    </span>
  );
}