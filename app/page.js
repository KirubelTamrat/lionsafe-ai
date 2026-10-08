"use client";

import dynamic from "next/dynamic";
import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Activity,
  BarChart3,
  Clock3,
  Database,
  LayoutDashboard,
  Map as MapIcon,
  MapPin,
  Search,
  Shield,
  Sparkles,
} from "lucide-react";


const CampusMap = dynamic(
  () => import("@/components/CampusMap"),
  {
    ssr: false,
  }
);


const TABS = [
  {
    id: "overview",
    label: "Overview",
    icon: LayoutDashboard,
  },
  {
    id: "map",
    label: "Map",
    icon: MapIcon,
  },
  {
    id: "trends",
    label: "Trends",
    icon: BarChart3,
  },
  {
    id: "ai",
    label: "Ask AI",
    icon: Sparkles,
  },
  {
    id: "data",
    label: "Data",
    icon: Database,
  },
];


export default function Home() {
  const [data, setData] =
    useState(null);

  const [analysis, setAnalysis] =
    useState("");

  const [loading, setLoading] =
    useState(true);


  // Navigation
  const [activeTab, setActiveTab] =
    useState("overview");


  // AI chat
  const [question, setQuestion] =
    useState("");

  const [messages, setMessages] =
    useState([]);

  const [chatLoading, setChatLoading] =
    useState(false);


  // Data explorer
  const [searchTerm, setSearchTerm] =
    useState("");

  const [categoryFilter, setCategoryFilter] =
    useState("all");

  const [statusFilter, setStatusFilter] =
    useState("all");


  // ----------------------------------------
  // LOAD DASHBOARD
  // ----------------------------------------

  useEffect(() => {
    async function loadDashboard() {
      try {
        const response =
          await fetch("/api/incidents");

        if (!response.ok) {
          throw new Error(
            "Could not load incident data"
          );
        }

        const result =
          await response.json();

        setData(result);


        // Generate AI summary
        const aiResponse =
          await fetch("/api/analyze", {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              stats: result.stats,
            }),
          });


        if (aiResponse.ok) {
          const aiResult =
            await aiResponse.json();

          setAnalysis(
            aiResult.analysis
          );
        } else {
          setAnalysis(
            "AI analysis is currently unavailable."
          );
        }

      } catch (error) {
        console.error(error);

      } finally {
        setLoading(false);
      }
    }


    loadDashboard();

  }, []);


  // ----------------------------------------
  // AI CHAT
  // ----------------------------------------

  async function askLionSafe(
  suggestedQuestion = null
) {
  const text =
    suggestedQuestion ||
    question;

  if (
    !text.trim() ||
    !data
  ) {
    return;
  }


  // Clear input
  setQuestion("");


  // Add user's message to the screen
  setMessages(
    (previous) => [
      ...previous,
      {
        role: "user",
        text,
      },
    ]
  );


  setChatLoading(true);


  try {
    const response =
      await fetch(
        "/api/chat",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            question: text,

            stats:
              data.stats,

            incidents:
              data.incidents,

            // Give LionSafe recent conversation memory
            history:
              messages
                .slice(-8)
                .map(
                  (message) => ({
                    role:
                      message.role,

                    text:
                      message.text,
                  })
                ),
          }),
        }
      );


    const result =
      await response.json();


    if (!response.ok) {
      throw new Error(
        result.error ||
          "Chat failed"
      );
    }


    // Store AI answer + evidence
    setMessages(
      (previous) => [
        ...previous,
        {
          role:
            "assistant",

          text:
            result.answer,

          sources:
            result.sources ||
            [],

          toolsUsed:
            result.toolsUsed ||
            [],
        },
      ]
    );

  } catch (error) {
    console.error(
      error
    );


    setMessages(
      (previous) => [
        ...previous,
        {
          role:
            "assistant",

          text:
            "I couldn't analyze the dataset right now.",

          sources: [],

          toolsUsed: [],
        },
      ]
    );

  } finally {
    setChatLoading(
      false
    );
  }
}

  // ----------------------------------------
  // DATA EXPLORER HELPERS
  // ----------------------------------------

  const categories =
    useMemo(() => {
      if (!data) {
        return [];
      }


      const values =
        new Set();


      data.incidents.forEach(
        (incident) => {
          incident.offenses?.forEach(
            (offense) =>
              values.add(offense)
          );
        }
      );


      return Array.from(
        values
      ).sort();

    }, [data]);


  const filteredIncidents =
    useMemo(() => {
      if (!data) {
        return [];
      }


      const search =
        searchTerm
          .trim()
          .toLowerCase();


      return data.incidents.filter(
        (incident) => {

          const matchesSearch =
            !search ||
            [
              incident.id,
              incident.location,
              incident.nature,
              incident.reported,
              incident.disposition,
              ...(incident.offenses ||
                []),
            ]
              .filter(Boolean)
              .join(" ")
              .toLowerCase()
              .includes(search);


          const matchesCategory =
            categoryFilter ===
              "all" ||
            incident.offenses?.includes(
              categoryFilter
            );


          const isOpen =
            incident.disposition
              ?.toLowerCase()
              .includes("open");


          const matchesStatus =
            statusFilter === "all" ||
            (
              statusFilter ===
                "open" &&
              isOpen
            ) ||
            (
              statusFilter ===
                "other" &&
              !isOpen
            );


          return (
            matchesSearch &&
            matchesCategory &&
            matchesStatus
          );
        }
      );

    }, [
      data,
      searchTerm,
      categoryFilter,
      statusFilter,
    ]);


  // ----------------------------------------
  // LOADING / ERROR STATES
  // ----------------------------------------

  if (loading) {
    return (
      <main className="min-h-screen bg-[#050b14] text-white flex items-center justify-center">

        <div className="text-center">

          <div className="mx-auto mb-5 h-14 w-14 rounded-2xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-950">

            <Shield size={28} />

          </div>

          <div className="text-2xl font-semibold">
            LionSafe AI
          </div>

          <div className="text-slate-500 mt-2">
            Loading campus intelligence...
          </div>

        </div>

      </main>
    );
  }


  if (!data) {
    return (
      <main className="min-h-screen bg-[#050b14] text-white flex items-center justify-center">

        Unable to load campus data.

      </main>
    );
  }


  const stats = data.stats;


  const maxOffense =
    Math.max(
      ...stats.topOffenses.map(
        (item) =>
          item.count
      ),
      1
    );


  const maxTime =
    Math.max(
      ...stats.timeBuckets.map(
        (item) =>
          item.count
      ),
      1
    );


  const busiestPeriod =
    [...stats.timeBuckets]
      .sort(
        (a, b) =>
          b.count - a.count
      )[0];


  const recentIncidents =
    data.incidents.slice(
      0,
      5
    );


  return (
    <main className="min-h-screen bg-[#050b14] text-white">

      {/* SUBTLE BACKGROUND GLOW */}

      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(circle at 40% -10%, rgba(30,64,175,0.24), transparent 34%)",
        }}
      />


      {/* ==================================================
          HEADER
      ================================================== */}

      <header className="sticky top-0 z-[2000] border-b border-slate-800/80 bg-[#07111f]/95 backdrop-blur-xl">

        <div className="max-w-[1500px] mx-auto px-5 md:px-8">

          <div className="h-20 flex items-center justify-between">

            {/* BRAND */}

            <button
              onClick={() =>
                setActiveTab(
                  "overview"
                )
              }
              className="flex items-center gap-3"
            >

              <div className="h-11 w-11 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-950/50">

                <Shield
                  size={24}
                  className="text-white"
                />

              </div>


              <div className="text-left">

                <div className="flex items-center gap-2">

                  <span className="text-xl font-bold tracking-tight">
                    LionSafe
                  </span>

                  <span className="text-blue-400 font-semibold">
                    AI
                  </span>

                </div>

                <div className="text-[11px] text-slate-500">
                  Penn State University Park
                </div>

              </div>

            </button>


            {/* STATUS */}

            <div className="flex items-center gap-3">

              <div className="hidden sm:flex items-center gap-2 rounded-full border border-emerald-900/70 bg-emerald-950/40 px-3 py-1.5">

                <div className="h-2 w-2 rounded-full bg-emerald-400" />

                <span className="text-xs font-medium text-emerald-300">
                  Live data
                </span>

              </div>


              <div className="hidden lg:block text-xs text-slate-600">
                Independent student project
              </div>

            </div>

          </div>


          {/* NAVIGATION */}

          <nav className="flex items-center gap-1 overflow-x-auto">

            {TABS.map(
              (tab) => {

                const Icon =
                  tab.icon;

                const selected =
                  activeTab ===
                  tab.id;


                return (
                  <button
                    key={tab.id}
                    onClick={() =>
                      setActiveTab(
                        tab.id
                      )
                    }
                    className={`
                      flex shrink-0 items-center gap-2
                      px-4 py-3
                      text-sm font-medium
                      border-b-2
                      transition-all

                      ${
                        selected
                          ? "border-blue-400 text-white"
                          : "border-transparent text-slate-500 hover:text-slate-200"
                      }
                    `}
                  >

                    <Icon
                      size={17}
                    />

                    {tab.label}

                  </button>
                );
              }
            )}

          </nav>

        </div>

      </header>


      {/* ==================================================
          CONTENT
      ================================================== */}

      <div className="relative z-10 max-w-[1500px] mx-auto px-5 md:px-8 py-8 md:py-10">


        {/* ==================================================
            OVERVIEW
        ================================================== */}

        {activeTab ===
          "overview" && (

          <div className="space-y-7">

            {/* PAGE INTRO */}

            <section className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-5">

              <div>

                <Eyebrow>
                  CAMPUS INTELLIGENCE
                </Eyebrow>

                <h1 className="text-3xl md:text-4xl font-bold tracking-tight mt-2">
                  University Park at a glance
                </h1>

                <p className="text-slate-500 mt-2 max-w-2xl">
                  Recent public incident data translated into a cleaner, more understandable campus view.
                </p>

              </div>


              <button
                onClick={() =>
                  setActiveTab(
                    "ai"
                  )
                }
                className="self-start lg:self-auto flex items-center gap-2 px-4 py-2.5 rounded-xl border border-blue-900/70 bg-blue-950/40 text-blue-300 hover:bg-blue-950/70 transition"
              >

                <Sparkles
                  size={16}
                />

                Ask about the data

              </button>

            </section>


            {/* METRICS */}

            <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">

              <MetricCard
                icon={Activity}
                label="REPORTS ANALYZED"
                value={
                  stats.totalIncidents
                }
                detail="Current loaded sample"
              />

              <MetricCard
                icon={Shield}
                label="OPEN CASES"
                value={
                  stats.openCases
                }
                detail="In current dataset"
              />

              <MetricCard
                icon={BarChart3}
                label="TOP CATEGORY"
                value={
                  stats.topOffenses[
                    0
                  ]?.name ||
                  "N/A"
                }
                detail={
                  stats.topOffenses[
                    0
                  ]
                    ? `${stats.topOffenses[0].count} category listings`
                    : ""
                }
              />

              <MetricCard
                icon={Clock3}
                label="BUSIEST PERIOD"
                value={
                  busiestPeriod?.name ||
                  "N/A"
                }
                detail={
                  busiestPeriod
                    ? `${busiestPeriod.count} reports`
                    : ""
                }
              />

            </section>


            {/* AI BRIEF + TOP LOCATIONS */}

            <section className="grid grid-cols-1 xl:grid-cols-[1.3fr_0.7fr] gap-5">

              {/* AI BRIEF */}

              <div className="relative overflow-hidden rounded-2xl border border-blue-900/60 bg-gradient-to-br from-blue-950/70 via-[#0b1728] to-[#091320] p-6 md:p-7">

                <div className="absolute -top-20 -right-20 h-52 w-52 rounded-full bg-blue-500/10 blur-3xl" />


                <div className="relative">

                  <div className="flex items-center gap-2 text-blue-400 text-xs font-semibold tracking-[0.18em]">

                    <Sparkles
                      size={15}
                    />

                    AI CAMPUS BRIEF

                  </div>


                  <h2 className="text-2xl font-semibold mt-3">
                    What stands out right now?
                  </h2>


                  <p className="text-slate-300 leading-7 mt-5 whitespace-pre-line">
                    {analysis}
                  </p>


                  <button
                    onClick={() =>
                      setActiveTab(
                        "ai"
                      )
                    }
                    className="mt-6 text-sm font-medium text-blue-400 hover:text-blue-300"
                  >
                    Continue exploring with Ask LionSafe →
                  </button>

                </div>

              </div>


              {/* LOCATIONS */}

              <Panel
                title="Most reported locations"
                subtitle="Counts reflect reports, not individual risk."
              >

                <div className="space-y-1">

                  {stats.topLocations.map(
                    (
                      location,
                      index
                    ) => (

                    <div
                      key={
                        location.name
                      }
                      className="flex items-center justify-between py-3.5 border-b border-slate-800/80 last:border-none"
                    >

                      <div className="flex items-center min-w-0">

                        <div className="h-8 w-8 shrink-0 rounded-lg bg-slate-800 flex items-center justify-center text-xs text-slate-500 mr-3">
                          {index + 1}
                        </div>

                        <span className="font-medium text-slate-200 truncate">
                          {
                            location.name
                          }
                        </span>

                      </div>


                      <span className="ml-3 rounded-lg bg-blue-950/70 border border-blue-900/50 text-blue-300 px-2.5 py-1 text-sm font-semibold">
                        {
                          location.count
                        }
                      </span>

                    </div>

                  ))}

                </div>

              </Panel>

            </section>


            {/* RECENT ACTIVITY */}

            <Panel
              title="Recent activity"
              subtitle="Latest reports in the current University Park sample."
            >

              <div className="divide-y divide-slate-800/80">

                {recentIncidents.map(
                  (incident) => (

                  <button
                    key={
                      incident.id
                    }
                    onClick={() =>
                      setActiveTab(
                        "data"
                      )
                    }
                    className="w-full flex items-center justify-between gap-5 py-4 text-left hover:bg-slate-800/20 transition px-2 rounded-lg"
                  >

                    <div className="flex items-center gap-4 min-w-0">

                      <div className="h-10 w-10 shrink-0 rounded-xl bg-slate-800 flex items-center justify-center">

                        <MapPin
                          size={17}
                          className="text-blue-400"
                        />

                      </div>


                      <div className="min-w-0">

                        <div className="font-medium text-slate-200 truncate">
                          {
                            incident.location
                          }
                        </div>

                        <div className="text-sm text-slate-500 truncate mt-1">
                          {incident
                            .offenses?.[0] ||
                            "Other"}
                          {" · "}
                          {
                            incident.reported
                          }
                        </div>

                      </div>

                    </div>


                    <StatusBadge
                      status={
                        incident.disposition
                      }
                    />

                  </button>

                ))}

              </div>

            </Panel>

          </div>

        )}


        {/* ==================================================
            MAP
        ================================================== */}

        {activeTab ===
          "map" && (

          <div className="space-y-6">

            <section className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">

              <div>

                <Eyebrow>
                  GEOSPATIAL INTELLIGENCE
                </Eyebrow>

                <h1 className="text-3xl md:text-4xl font-bold mt-2">
                  Campus map
                </h1>

                <p className="text-slate-500 mt-2 max-w-2xl">
                  Explore recent reports matched against official University Park GIS building data.
                </p>

              </div>


              <div className="flex items-center gap-2 text-xs text-slate-500">

                <MapPin
                  size={15}
                />

                Click a mapped location for details

              </div>

            </section>


            <div className="rounded-2xl overflow-hidden border border-slate-800 bg-[#091320] shadow-2xl shadow-black/20">

              <CampusMap
                incidents={
                  data.incidents
                }
              />

            </div>


            <div className="grid md:grid-cols-3 gap-4">

              <InfoCard
                title="What you're seeing"
                text="Markers represent reports matched to campus building locations."
              />

              <InfoCard
                title="Why some are missing"
                text="Parking lots, roads, intersections and outdoor locations are not fully mapped yet."
              />

              <InfoCard
                title="Important context"
                text="Report density is not a safety score or personal-risk estimate."
              />

            </div>

          </div>

        )}


        {/* ==================================================
            TRENDS
        ================================================== */}

        {activeTab ===
          "trends" && (

          <div className="space-y-6">

            <div>

              <Eyebrow>
                DATA ANALYTICS
              </Eyebrow>

              <h1 className="text-3xl md:text-4xl font-bold mt-2">
                Trends
              </h1>

              <p className="text-slate-500 mt-2">
                Explore patterns across category, time and location.
              </p>

            </div>


            <section className="grid grid-cols-1 xl:grid-cols-2 gap-5">

              <Panel
                title="Reports by category"
                subtitle="Most frequently listed offense categories."
              >

                <div className="space-y-5">

                  {stats.topOffenses.map(
                    (item) => (

                    <Bar
                      key={
                        item.name
                      }
                      name={
                        item.name
                      }
                      count={
                        item.count
                      }
                      width={
                        (
                          item.count /
                          maxOffense
                        ) * 100
                      }
                    />

                  ))}

                </div>

              </Panel>


              <Panel
                title="Reports by time of day"
                subtitle="Grouped using the reported time."
              >

                <div className="space-y-5">

                  {stats.timeBuckets.map(
                    (item) => (

                    <Bar
                      key={
                        item.name
                      }
                      name={
                        item.name
                      }
                      count={
                        item.count
                      }
                      width={
                        (
                          item.count /
                          maxTime
                        ) * 100
                      }
                    />

                  ))}

                </div>

              </Panel>

            </section>


            <Panel
              title="Location distribution"
              subtitle="Locations with the most reports in the current loaded sample."
            >

              <div className="grid md:grid-cols-2 xl:grid-cols-5 gap-3">

                {stats.topLocations.map(
                  (
                    location,
                    index
                  ) => (

                  <div
                    key={
                      location.name
                    }
                    className="rounded-xl bg-slate-950/70 border border-slate-800 p-4"
                  >

                    <div className="text-xs text-slate-600">
                      #{index + 1}
                    </div>

                    <div className="font-medium mt-2 text-slate-200 min-h-[48px]">
                      {
                        location.name
                      }
                    </div>

                    <div className="text-2xl font-bold text-blue-400 mt-4">
                      {
                        location.count
                      }
                    </div>

                    <div className="text-xs text-slate-600 mt-1">
                      reports
                    </div>

                  </div>

                ))}

              </div>

            </Panel>


            <div className="rounded-2xl border border-amber-900/30 bg-amber-950/10 p-5 text-sm text-amber-200/70">

              These are descriptive patterns from reported incidents. They do not account for population, foot traffic, event attendance, exposure time, or reporting behavior.

            </div>

          </div>

        )}


        {/* ==================================================
            ASK AI
        ================================================== */}

        {activeTab ===
          "ai" && (

          <div className="max-w-5xl mx-auto">

            <div className="text-center mb-8">

              <div className="mx-auto h-14 w-14 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-700 flex items-center justify-center shadow-xl shadow-blue-950/40">

                <Sparkles
                  size={25}
                />

              </div>


              <h1 className="text-3xl md:text-4xl font-bold mt-5">
                Ask LionSafe
              </h1>

              <p className="text-slate-500 mt-2">
                Ask questions grounded in the currently loaded Penn State incident data.
              </p>

            </div>


            <section className="rounded-2xl border border-slate-800 bg-[#0a1524]/90 overflow-hidden shadow-2xl shadow-black/20">

              {/* EMPTY STATE / SUGGESTIONS */}

              {messages.length ===
                0 && (

                <div className="px-6 md:px-10 pt-10 pb-6">

                  <div className="text-center max-w-xl mx-auto">

                    <h2 className="text-xl font-semibold">
                      What would you like to understand?
                    </h2>

                    <p className="text-slate-500 text-sm mt-2">
                      LionSafe answers using the data currently loaded into the dashboard.
                    </p>

                  </div>


                  <div className="grid sm:grid-cols-2 gap-3 mt-8">

                    {[
                      "What time of day has the most reports?",
                      "What are the top incident categories?",
                      "Which locations appear most often?",
                      "What patterns stand out in this dataset?",
                    ].map(
                      (
                        suggestion
                      ) => (

                      <button
                        key={
                          suggestion
                        }
                        onClick={() =>
                          askLionSafe(
                            suggestion
                          )
                        }
                        className="text-left rounded-xl border border-slate-800 bg-slate-950/60 hover:border-blue-900 hover:bg-blue-950/20 p-4 text-sm text-slate-300 transition"
                      >
                        <Sparkles
                          size={15}
                          className="text-blue-400 mb-3"
                        />

                        {
                          suggestion
                        }

                      </button>

                    ))}

                  </div>

                </div>

              )}


              {/* MESSAGES */}

              <div className="px-5 md:px-8 py-6 max-h-[520px] overflow-y-auto space-y-5">

                {messages.map(
                  (
                    message,
                    index
                  ) => (

                  <div
                    key={index}
                    className={
                      message.role ===
                      "user"
                        ? "flex justify-end"
                        : "flex justify-start"
                    }
                  >

                    <div
                      className={
                        message.role ===
                        "user"
                          ? "max-w-[85%] md:max-w-[72%] bg-blue-600 text-white rounded-2xl rounded-br-md px-4 py-3 leading-6"
                          : "max-w-[92%] md:max-w-[78%] bg-slate-800/80 border border-slate-700/50 text-slate-200 rounded-2xl rounded-bl-md px-4 py-3 leading-6 whitespace-pre-line"
                      }
                    >
                      {
                        <div>

  {/* MESSAGE TEXT */}

  <div className="whitespace-pre-line">
    {message.text}
  </div>


  {/* TOOL INDICATOR */}

  {message.role === "assistant" &&
    message.toolsUsed?.length > 0 && (

      <div className="flex flex-wrap gap-2 mt-4">

        {message.toolsUsed.map((tool) => (

          <span
            key={tool}
            className="text-[10px] bg-blue-950/60 border border-blue-900/60 text-blue-300 px-2 py-1 rounded-full"
          >
            {tool
              .replaceAll("_", " ")
              .toUpperCase()}
          </span>

        ))}

      </div>

    )}


  {/* DATA SOURCES */}

  {message.role === "assistant" &&
    message.sources?.length > 0 && (

      <div className="mt-5 pt-4 border-t border-slate-700/60">

        <div className="text-[10px] font-semibold tracking-[0.18em] text-slate-500 mb-3">
          DATA USED
        </div>


        <div className="space-y-2">

          {message.sources.map((source) => (

            <button
              key={source.id}

              onClick={() => {

                // Search for the exact incident
                setSearchTerm(source.id);

                // Open Data tab
                setActiveTab("data");

              }}

              className="w-full text-left rounded-xl bg-slate-950/70 border border-slate-700/70 hover:border-blue-700 hover:bg-blue-950/20 p-3 transition"
            >

              <div className="flex items-start justify-between gap-3">

                <div>

                  <div className="text-sm font-medium text-white">
                    {source.location || "Unknown location"}
                  </div>


                  <div className="text-xs text-blue-300 mt-1">
                    {source.offenses?.[0] || "Incident"}
                  </div>

                </div>


                <div className="text-[10px] font-mono text-slate-500 shrink-0">
                  {source.id}
                </div>

              </div>


              {source.nature && (

                <div className="text-xs text-slate-400 mt-3 leading-5">
                  {source.nature}
                </div>

              )}


              <div className="flex items-center justify-between mt-3 text-[11px] text-slate-600">

                <span>
                  {source.reported}
                </span>

                {source.distance_miles !== undefined && (

                  <span className="text-blue-400">
                    {source.distance_miles} mi away
                  </span>

                )}

              </div>

            </button>

          ))}

        </div>

      </div>

    )}

</div>
                      }
                    </div>

                  </div>

                ))}


                {chatLoading && (

                  <div className="flex justify-start">

                    <div className="flex items-center gap-2 bg-slate-800 text-slate-400 rounded-2xl px-4 py-3 text-sm">

                      <div className="h-2 w-2 rounded-full bg-blue-400 animate-pulse" />

                      Analyzing campus data...

                    </div>

                  </div>

                )}

              </div>


              {/* INPUT */}

              <div className="border-t border-slate-800 p-4 md:p-5">

                <form
                  onSubmit={(
                    event
                  ) => {
                    event.preventDefault();
                    askLionSafe();
                  }}
                  className="flex gap-3"
                >

                  <input
                    value={
                      question
                    }
                    onChange={(
                      event
                    ) =>
                      setQuestion(
                        event.target
                          .value
                      )
                    }
                    placeholder="Ask about campus incident patterns..."
                    className="flex-1 bg-slate-950/80 border border-slate-700 rounded-xl px-4 py-3.5 text-sm text-white placeholder:text-slate-600 outline-none focus:border-blue-500"
                  />


                  <button
                    type="submit"
                    disabled={
                      chatLoading ||
                      !question.trim()
                    }
                    className="px-5 md:px-7 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-600 font-semibold transition"
                  >
                    Ask
                  </button>

                </form>

              </div>

            </section>


            <p className="text-center text-xs text-slate-600 mt-5">
              AI answers are constrained to the current dataset and should not be interpreted as personal safety predictions.
            </p>

          </div>

        )}


        {/* ==================================================
            DATA EXPLORER
        ================================================== */}

        {activeTab ===
          "data" && (

          <div className="space-y-6">

            <div>

              <Eyebrow>
                INCIDENT EXPLORER
              </Eyebrow>

              <h1 className="text-3xl md:text-4xl font-bold mt-2">
                Data
              </h1>

              <p className="text-slate-500 mt-2">
                Search and filter the current University Park incident sample.
              </p>

            </div>


            {/* FILTERS */}

            <section className="rounded-2xl border border-slate-800 bg-[#0a1524] p-4">

              <div className="grid lg:grid-cols-[1fr_260px_180px] gap-3">

                <div className="relative">

                  <Search
                    size={17}
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600"
                  />

                  <input
                    value={
                      searchTerm
                    }
                    onChange={(
                      event
                    ) =>
                      setSearchTerm(
                        event.target
                          .value
                      )
                    }
                    placeholder="Search location, category, incident ID..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-11 pr-4 py-3 text-sm outline-none focus:border-blue-500"
                  />

                </div>


                <select
                  value={
                    categoryFilter
                  }
                  onChange={(
                    event
                  ) =>
                    setCategoryFilter(
                      event.target
                        .value
                    )
                  }
                  className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-300 outline-none focus:border-blue-500"
                >

                  <option value="all">
                    All categories
                  </option>

                  {categories.map(
                    (
                      category
                    ) => (

                    <option
                      key={
                        category
                      }
                      value={
                        category
                      }
                    >
                      {
                        category
                      }
                    </option>

                  ))}

                </select>


                <select
                  value={
                    statusFilter
                  }
                  onChange={(
                    event
                  ) =>
                    setStatusFilter(
                      event.target
                        .value
                    )
                  }
                  className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-300 outline-none focus:border-blue-500"
                >

                  <option value="all">
                    All statuses
                  </option>

                  <option value="open">
                    Open
                  </option>

                  <option value="other">
                    Other
                  </option>

                </select>

              </div>

            </section>


            {/* RESULT COUNT */}

            <div className="flex items-center justify-between text-sm">

              <span className="text-slate-500">
                Showing{" "}
                <span className="text-white font-medium">
                  {
                    filteredIncidents.length
                  }
                </span>{" "}
                of{" "}
                {
                  data.incidents
                    .length
                }{" "}
                reports
              </span>

            </div>


            {/* TABLE */}

            <section className="rounded-2xl border border-slate-800 bg-[#0a1524] overflow-hidden">

              <div className="overflow-x-auto">

                <table className="w-full min-w-[900px]">

                  <thead className="bg-slate-950/70">

                    <tr className="text-left text-[11px] text-slate-500 tracking-[0.14em]">

                      <th className="px-5 py-4">
                        REPORTED
                      </th>

                      <th className="px-5 py-4">
                        LOCATION
                      </th>

                      <th className="px-5 py-4">
                        CATEGORY
                      </th>

                      <th className="px-5 py-4">
                        STATUS
                      </th>

                      <th className="px-5 py-4">
                        INCIDENT
                      </th>

                    </tr>

                  </thead>


                  <tbody>

                    {filteredIncidents.map(
                      (
                        incident
                      ) => (

                      <tr
                        key={
                          incident.id
                        }
                        className="border-t border-slate-800/80 hover:bg-slate-800/20 transition"
                      >

                        <td className="px-5 py-4 text-sm text-slate-500 whitespace-nowrap">
                          {
                            incident.reported
                          }
                        </td>


                        <td className="px-5 py-4">

                          <div className="flex items-center gap-2 font-medium">

                            <MapPin
                              size={15}
                              className="text-blue-400 shrink-0"
                            />

                            {
                              incident.location
                            }

                          </div>

                        </td>


                        <td className="px-5 py-4 text-sm text-slate-300">

                          {incident
                            .offenses?.[0] ||
                            "Other"}

                        </td>


                        <td className="px-5 py-4">

                          <StatusBadge
                            status={
                              incident.disposition
                            }
                          />

                        </td>


                        <td className="px-5 py-4 text-xs font-mono text-slate-600">
                          {
                            incident.id
                          }
                        </td>

                      </tr>

                    ))}


                    {filteredIncidents.length ===
                      0 && (

                      <tr>

                        <td
                          colSpan={5}
                          className="py-16 text-center text-slate-500"
                        >
                          No incidents match those filters.
                        </td>

                      </tr>

                    )}

                  </tbody>

                </table>

              </div>

            </section>

          </div>

        )}


        {/* FOOTER */}

        <footer className="mt-14 pt-6 border-t border-slate-900 flex flex-col md:flex-row gap-3 md:items-center md:justify-between text-xs text-slate-700">

          <div>
            LionSafe AI · Independent student project
          </div>

          <div>
            Public data · Educational and analytical use
          </div>

        </footer>

      </div>

    </main>
  );
}


// ======================================================
// UI COMPONENTS
// ======================================================

function Eyebrow({
  children,
}) {
  return (
    <div className="text-blue-400 text-xs font-semibold tracking-[0.2em]">
      {children}
    </div>
  );
}


function MetricCard({
  icon: Icon,
  label,
  value,
  detail,
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-[#0a1524]/90 p-5">

      <div className="absolute right-0 top-0 h-24 w-24 rounded-full bg-blue-500/[0.04] blur-2xl" />


      <div className="relative">

        <div className="flex items-center justify-between">

          <span className="text-[11px] text-slate-500 font-semibold tracking-[0.14em]">
            {label}
          </span>

          <div className="h-8 w-8 rounded-lg bg-slate-800 flex items-center justify-center">

            <Icon
              size={15}
              className="text-blue-400"
            />

          </div>

        </div>


        <div className="text-2xl font-bold mt-5 break-words">
          {value}
        </div>


        <div className="text-xs text-slate-600 mt-2">
          {detail}
        </div>

      </div>

    </div>
  );
}


function Panel({
  title,
  subtitle,
  children,
}) {
  return (
    <section className="rounded-2xl border border-slate-800 bg-[#0a1524]/90 p-6">

      <h2 className="text-lg font-semibold">
        {title}
      </h2>


      {subtitle && (
        <p className="text-sm text-slate-500 mt-1 mb-6">
          {subtitle}
        </p>
      )}


      {!subtitle && (
        <div className="mb-6" />
      )}


      {children}

    </section>
  );
}


function InfoCard({
  title,
  text,
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-[#0a1524] p-4">

      <div className="text-sm font-medium text-slate-200">
        {title}
      </div>

      <div className="text-xs leading-5 text-slate-500 mt-2">
        {text}
      </div>

    </div>
  );
}


function Bar({
  name,
  count,
  width,
}) {
  return (
    <div>

      <div className="flex items-center justify-between gap-4 mb-2">

        <span className="text-sm text-slate-300 truncate">
          {name}
        </span>

        <span className="text-sm text-blue-400 font-semibold">
          {count}
        </span>

      </div>


      <div className="h-2 bg-slate-800 rounded-full overflow-hidden">

        <div
          className="h-full bg-gradient-to-r from-blue-600 to-blue-400 rounded-full"
          style={{
            width: `${width}%`,
          }}
        />

      </div>

    </div>
  );
}


function StatusBadge({
  status,
}) {
  const open =
    status
      ?.toLowerCase()
      .includes("open");


  return (
    <span
      className={
        open
          ? "inline-flex bg-amber-950/70 border border-amber-900/50 text-amber-300 px-2.5 py-1 rounded-full text-xs"
          : "inline-flex bg-slate-800 text-slate-400 px-2.5 py-1 rounded-full text-xs"
      }
    >
      {status || "Unknown"}
    </span>
  );
}