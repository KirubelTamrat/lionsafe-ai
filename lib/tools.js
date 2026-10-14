// lib/lionSafeTools.js


// ----------------------------------------------------
// INCIDENT HELPERS
// ----------------------------------------------------

function compactIncident(incident) {
  return {
    id: incident.id,
    reported: incident.reported,
    occurred: incident.occurred,
    nature: incident.nature,
    offenses: incident.offenses || [],
    location: incident.location,
    disposition: incident.disposition,
  };
}


function cleanName(value = "") {
  return String(value)
    .toUpperCase()
    .replace(/&/g, " AND ")
    .replace(
      /\b(BUILDING|BLDG|HALL|CENTER|CENTRE|CTR)\b/g,
      " "
    )
    .replace(/[^A-Z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}


function textMatch(query, value) {
  return String(value || "")
    .toLowerCase()
    .includes(
      String(query || "")
        .toLowerCase()
        .trim()
    );
}


// ----------------------------------------------------
// TIME OF DAY
// ----------------------------------------------------

function getTimeBucket(reported = "") {
  const match = reported.match(
    /(\d{1,2}):(\d{2})\s*(AM|PM)/i
  );

  if (!match) {
    return "Unknown";
  }

  let hour =
    Number(match[1]);

  const period =
    match[3].toUpperCase();


  if (
    period === "AM" &&
    hour === 12
  ) {
    hour = 0;
  }

  if (
    period === "PM" &&
    hour !== 12
  ) {
    hour += 12;
  }


  if (
    hour >= 5 &&
    hour < 12
  ) {
    return "Morning";
  }

  if (
    hour >= 12 &&
    hour < 17
  ) {
    return "Afternoon";
  }

  if (
    hour >= 17 &&
    hour < 22
  ) {
    return "Evening";
  }

  return "Overnight";
}


// ----------------------------------------------------
// GIS NAME MATCHING
// ----------------------------------------------------

function nameScore(
  query,
  candidate
) {
  const q =
    cleanName(query);

  const c =
    cleanName(candidate);


  if (!q || !c) {
    return 0;
  }


  if (q === c) {
    return 100;
  }


  if (
    c.includes(q) ||
    q.includes(c)
  ) {
    return 80;
  }


  const queryWords =
    q.split(" ");

  const candidateWords =
    new Set(
      c.split(" ")
    );


  const matchingWords =
    queryWords.filter(
      (word) =>
        candidateWords.has(
          word
        )
    ).length;


  if (!matchingWords) {
    return 0;
  }


  return (
    matchingWords /
    queryWords.length
  ) * 60;
}


function getFeatureNames(feature) {
  const props =
    feature.properties || {};

  return [
    props.BLDG_NAME,
    props.BLDG_NAME_,
  ].filter(Boolean);
}


function findBestBuilding(
  query,
  features
) {
  let best = null;
  let bestScore = 0;


  for (const feature of features) {

    for (
      const name of
      getFeatureNames(feature)
    ) {

      const score =
        nameScore(
          query,
          name
        );


      if (
        score >
        bestScore
      ) {
        best = feature;
        bestScore =
          score;
      }
    }
  }


  if (
    !best ||
    bestScore < 40
  ) {
    return null;
  }


  return best;
}


// ----------------------------------------------------
// APPROXIMATE POLYGON CENTER
// ----------------------------------------------------

function getFeatureCenter(feature) {
  const coordinates =
    feature.geometry
      ?.coordinates;


  if (!coordinates) {
    return null;
  }


  const points = [];


  function collect(value) {
    if (
      Array.isArray(value) &&
      typeof value[0] ===
        "number" &&
      typeof value[1] ===
        "number"
    ) {
      points.push(value);
      return;
    }


    if (
      Array.isArray(value)
    ) {
      value.forEach(
        collect
      );
    }
  }


  collect(coordinates);


  if (!points.length) {
    return null;
  }


  const longitude =
    points.reduce(
      (sum, point) =>
        sum + point[0],
      0
    ) / points.length;


  const latitude =
    points.reduce(
      (sum, point) =>
        sum + point[1],
      0
    ) / points.length;


  return {
    latitude,
    longitude,
  };
}


// ----------------------------------------------------
// HAVERSINE DISTANCE
// ----------------------------------------------------

function distanceMiles(
  pointA,
  pointB
) {
  const earthRadiusMiles =
    3958.8;


  const toRadians = (
    degrees
  ) =>
    degrees *
    (Math.PI / 180);


  const lat1 =
    toRadians(
      pointA.latitude
    );

  const lat2 =
    toRadians(
      pointB.latitude
    );

  const deltaLat =
    toRadians(
      pointB.latitude -
        pointA.latitude
    );

  const deltaLon =
    toRadians(
      pointB.longitude -
        pointA.longitude
    );


  const a =
    Math.sin(
      deltaLat / 2
    ) ** 2 +
    Math.cos(lat1) *
      Math.cos(lat2) *
      Math.sin(
        deltaLon / 2
      ) ** 2;


  const c =
    2 *
    Math.atan2(
      Math.sqrt(a),
      Math.sqrt(1 - a)
    );


  return (
    earthRadiusMiles * c
  );
}


// ----------------------------------------------------
// LOAD GIS
//
// We reuse your existing /api/buildings endpoint.
// ----------------------------------------------------

async function getBuildings(
  origin
) {
  const response =
    await fetch(
      `${origin}/api/buildings`,
      {
        cache: "no-store",
      }
    );


  if (!response.ok) {
    throw new Error(
      "Campus GIS is unavailable."
    );
  }


  const data =
    await response.json();


  return (
    data.features || []
  );
}


// ----------------------------------------------------
// TOOL IMPLEMENTATIONS
// ----------------------------------------------------

function searchIncidents(
  incidents,
  args
) {
  const query =
    String(
      args.query || ""
    ).trim();


  const limit =
    Math.min(
      Number(
        args.limit || 10
      ),
      25
    );


  const results =
    incidents
      .filter(
        (incident) => {

          const searchable =
            [
              incident.id,
              incident.location,
              incident.nature,
              incident.disposition,
              ...(incident.offenses ||
                []),
            ]
              .filter(Boolean)
              .join(" ");


          return textMatch(
            query,
            searchable
          );
        }
      )
      .slice(0, limit)
      .map(
        compactIncident
      );


  return {
    query,
    count:
      results.length,
    incidents: results,
  };
}


function filterIncidents(
  incidents,
  args
) {
  const limit =
    Math.min(
      Number(
        args.limit || 20
      ),
      50
    );


  const results =
    incidents.filter(
      (incident) => {

        const categoryMatch =
          !args.category ||
          incident.offenses?.some(
            (offense) =>
              textMatch(
                args.category,
                offense
              )
          );


        const locationMatch =
          !args.location ||
          textMatch(
            args.location,
            incident.location
          );


        const statusMatch =
          !args.status ||
          textMatch(
            args.status,
            incident.disposition
          );


        const timeMatch =
          !args.time_of_day ||
          getTimeBucket(
            incident.reported
          ).toLowerCase() ===
            args.time_of_day
              .toLowerCase();


        return (
          categoryMatch &&
          locationMatch &&
          statusMatch &&
          timeMatch
        );
      }
    );


  return {
    count:
      results.length,

    incidents:
      results
        .slice(0, limit)
        .map(
          compactIncident
        ),
  };
}


function getIncidentDetails(
  incidents,
  args
) {
  const incident =
    incidents.find(
      (item) =>
        item.id
          ?.toLowerCase() ===
        args.incident_id
          ?.toLowerCase()
    );


  if (!incident) {
    return {
      found: false,
      incident: null,
    };
  }


  return {
    found: true,

    incident:
      compactIncident(
        incident
      ),
  };
}


function getDatasetSummary(
  stats,
  incidents
) {
  return {
    totalIncidents:
      stats.totalIncidents,

    openCases:
      stats.openCases,

    topOffenses:
      stats.topOffenses,

    topLocations:
      stats.topLocations,

    timeBuckets:
      stats.timeBuckets,

    firstLoadedReport:
      incidents.at(-1)
        ?.reported || null,

    latestLoadedReport:
      incidents[0]
        ?.reported || null,

    limitation:
      "This is the currently loaded University Park sample, not all historical Penn State incidents.",
  };
}


function compareLocations(
  incidents,
  args
) {
  function summarize(
    location
  ) {
    const matches =
      incidents.filter(
        (incident) =>
          textMatch(
            location,
            incident.location
          )
      );


    const categories = {};


    for (
      const incident of matches
    ) {
      for (
        const offense of
        incident.offenses ||
        []
      ) {
        categories[offense] =
          (
            categories[
              offense
            ] || 0
          ) + 1;
      }
    }


    return {
      location,
      count:
        matches.length,

      categories:
        Object.entries(
          categories
        )
          .map(
            ([name, count]) => ({
              name,
              count,
            })
          )
          .sort(
            (a, b) =>
              b.count -
              a.count
          ),

      incidents:
        matches.map(
          compactIncident
        ),
    };
  }


  return {
    first:
      summarize(
        args.location_a
      ),

    second:
      summarize(
        args.location_b
      ),

    warning:
      "Report volume alone does not measure how safe or dangerous a location is.",
  };
}


function getRecentReports(
  incidents,
  args
) {
  const location =
    String(
      args.location || ""
    ).trim();

  const limit =
    Math.min(
      Number(
        args.limit || 5
      ),
      25
    );

  const filtered =
    incidents.filter(
      (incident) =>
        !location ||
        textMatch(
          location,
          incident.location
        )
    );

  const sorted =
    [...filtered].sort(
      (a, b) => {
        const aTime =
          Date.parse(
            a.reported ||
              a.occurred ||
              ""
          );

        const bTime =
          Date.parse(
            b.reported ||
              b.occurred ||
              ""
          );

        if (
          Number.isNaN(
            aTime
          ) &&
          Number.isNaN(
            bTime
          )
        ) {
          return 0;
        }

        if (
          Number.isNaN(
            aTime
          )
        ) {
          return 1;
        }

        if (
          Number.isNaN(
            bTime
          )
        ) {
          return -1;
        }

        return bTime - aTime;
      }
    );

  return {
    location:
      location || "all",
    count:
      sorted.length,
    incidents:
      sorted
        .slice(0, limit)
        .map(
          compactIncident
        ),
  };
}


function getOpenCasesSummary(
  incidents,
  args
) {
  const location =
    String(
      args.location || ""
    ).trim();

  const category =
    String(
      args.category || ""
    ).trim();

  const limit =
    Math.min(
      Number(
        args.limit || 8
      ),
      25
    );

  const open =
    incidents.filter(
      (incident) => {
        const disposition = String(
          incident.disposition || ""
        );

        const matchesStatus =
          /open|pending|active|ongoing|investigating/i.test(
            disposition
          );

        const matchesLocation =
          !location ||
          textMatch(
            location,
            incident.location
          );

        const matchesCategory =
          !category ||
          (incident.offenses || []).some(
            (offense) =>
              textMatch(
                category,
                offense
              )
          );

        return (
          matchesStatus &&
          matchesLocation &&
          matchesCategory
        );
      }
    );

  const byLocation = {};
  const byCategory = {};

  for (const incident of open) {
    const loc = incident.location || "Unknown";
    byLocation[loc] = (byLocation[loc] || 0) + 1;

    for (const offense of incident.offenses || []) {
      byCategory[offense] = (byCategory[offense] || 0) + 1;
    }
  }

  return {
    count: open.length,
    byLocation: Object.entries(byLocation)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count })),
    byCategory: Object.entries(byCategory)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count })),
    incidents: open
      .slice(0, limit)
      .map(compactIncident),
  };
}


function getLocationSnapshot(
  incidents,
  args
) {
  const location =
    String(
      args.location || ""
    ).trim();

  const limit =
    Math.min(
      Number(
        args.limit || 5
      ),
      25
    );

  const matches =
    incidents.filter(
      (incident) =>
        textMatch(
          location,
          incident.location
        )
    );

  const categories = {};

  for (const incident of matches) {
    for (const offense of incident.offenses || []) {
      categories[offense] = (categories[offense] || 0) + 1;
    }
  }

  return {
    location,
    count: matches.length,
    topCategories: Object.entries(categories)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5),
    recentIncidents: matches
      .slice(0, limit)
      .map(compactIncident),
  };
}


function getTimeTrends(
  incidents,
  args
) {
  const location =
    String(
      args.location || ""
    ).trim();

  const category =
    String(
      args.category || ""
    ).trim();

  const filtered =
    incidents.filter(
      (incident) => {
        const matchesLocation =
          !location ||
          textMatch(
            location,
            incident.location
          );

        const matchesCategory =
          !category ||
          (incident.offenses || []).some(
            (offense) =>
              textMatch(
                category,
                offense
              )
          );

        return (
          matchesLocation &&
          matchesCategory
        );
      }
    );

  const buckets = {
    Morning: 0,
    Afternoon: 0,
    Evening: 0,
    Overnight: 0,
  };

  for (const incident of filtered) {
    const bucket =
      getTimeBucket(
        incident.reported
      );

    if (bucket in buckets) {
      buckets[bucket] += 1;
    }
  }

  return {
    location: location || "all",
    category: category || "all",
    total: filtered.length,
    timeBuckets: Object.entries(buckets)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count),
  };
}


async function findNearbyIncidents(
  incidents,
  args,
  origin
) {
  const radius =
    Math.min(
      Math.max(
        Number(
          args.radius_miles ||
            0.5
        ),
        0.1
      ),
      2
    );


  const limit =
    Math.min(
      Number(
        args.limit || 10
      ),
      25
    );


  const features =
    await getBuildings(
      origin
    );


  const targetBuilding =
    findBestBuilding(
      args.location,
      features
    );


  if (!targetBuilding) {
    return {
      foundLocation:
        false,

      query:
        args.location,

      incidents: [],

      message:
        "The requested campus building could not be resolved in the current GIS layer.",
    };
  }


  const targetCenter =
    getFeatureCenter(
      targetBuilding
    );


  if (!targetCenter) {
    return {
      foundLocation:
        false,

      query:
        args.location,

      incidents: [],

      message:
        "The requested building did not have usable geometry.",
    };
  }


  const nearby = [];


  for (
    const incident of
    incidents
  ) {

    if (
      !incident.location
    ) {
      continue;
    }


    const incidentBuilding =
      findBestBuilding(
        incident.location,
        features
      );


    if (
      !incidentBuilding
    ) {
      continue;
    }


    const incidentCenter =
      getFeatureCenter(
        incidentBuilding
      );


    if (!incidentCenter) {
      continue;
    }


    const distance =
      distanceMiles(
        targetCenter,
        incidentCenter
      );


    if (
      distance <= radius
    ) {
      nearby.push({
        ...compactIncident(
          incident
        ),

        distance_miles:
          Number(
            distance.toFixed(
              2
            )
          ),
      });
    }
  }


  nearby.sort(
    (a, b) =>
      a.distance_miles -
      b.distance_miles
  );


  const targetName =
    targetBuilding
      .properties
      ?.BLDG_NAME ||
    targetBuilding
      .properties
      ?.BLDG_NAME_ ||
    args.location;


  return {
    foundLocation: true,

    target: {
      requested:
        args.location,

      matchedBuilding:
        targetName,

      latitude:
        targetCenter.latitude,

      longitude:
        targetCenter.longitude,
    },

    radius_miles:
      radius,

    count:
      nearby.length,

    incidents:
      nearby.slice(
        0,
        limit
      ),

    limitation:
      "Nearby results currently include incidents that can be matched to PSU building polygons. Roads, parking areas, and some outdoor locations may be missing.",
  };
}


// ----------------------------------------------------
// MAIN TOOL ROUTER
// ----------------------------------------------------

export async function executeLionSafeTool(
  name,
  args,
  context
) {
  const {
    incidents,
    stats,
    origin,
  } = context;


  switch (name) {

    case "search_incidents":
      return searchIncidents(
        incidents,
        args
      );


    case "filter_incidents":
      return filterIncidents(
        incidents,
        args
      );


    case "get_incident_details":
      return getIncidentDetails(
        incidents,
        args
      );


    case "get_dataset_summary":
      return getDatasetSummary(
        stats,
        incidents
      );


    case "compare_locations":
      return compareLocations(
        incidents,
        args
      );


    case "find_nearby_incidents":
      return findNearbyIncidents(
        incidents,
        args,
        origin
      );

    case "get_recent_reports":
      return getRecentReports(
        incidents,
        args
      );

    case "get_open_cases_summary":
      return getOpenCasesSummary(
        incidents,
        args
      );

    case "get_location_snapshot":
      return getLocationSnapshot(
        incidents,
        args
      );

    case "get_time_trends":
      return getTimeTrends(
        incidents,
        args
      );

    default:
      throw new Error(
        `Unknown LionSafe tool: ${name}`
      );
  }
}