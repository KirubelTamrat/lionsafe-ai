import { parseCrimePage } from "@/lib/psuCrime";

const PSU_CRIME_URL =
  "https://www.police.psu.edu/daily-crime-log";

async function downloadPage(pageNumber) {
  const url = `${PSU_CRIME_URL}?page=${pageNumber}`;

  try {
    const response = await fetch(url, {
      cache: "no-store",
      headers: {
        "User-Agent":
          "LionSafeAI-Hackathon/1.0 educational project",
      },
    });

    if (!response.ok) {
      console.error(
        `Penn State page ${pageNumber} returned ${response.status}`
      );

      return [];
    }

    const html = await response.text();

    return parseCrimePage(html);
  } catch (error) {
    console.error(
      `Could not download Penn State page ${pageNumber}`,
      error
    );

    return [];
  }
}

function getReportedHour(reported) {
  if (!reported) {
    return null;
  }

  const match = reported.match(
    /(\d{1,2}):(\d{2})\s*(AM|PM)/i
  );

  if (!match) {
    return null;
  }

  let hour = Number(match[1]);
  const period = match[3].toUpperCase();

  if (period === "AM" && hour === 12) {
    hour = 0;
  }

  if (period === "PM" && hour !== 12) {
    hour += 12;
  }

  return hour;
}

function getTimeBucket(reported) {
  const hour = getReportedHour(reported);

  if (hour === null) {
    return "Unknown";
  }

  if (hour >= 6 && hour < 12) {
    return "Morning";
  }

  if (hour >= 12 && hour < 18) {
    return "Afternoon";
  }

  if (hour >= 18 && hour < 24) {
    return "Evening";
  }

  return "Overnight";
}

function increment(object, key) {
  if (!key) {
    return;
  }

  object[key] = (object[key] || 0) + 1;
}

function topValues(object, amount = 6) {
  return Object.entries(object)
    .sort((a, b) => b[1] - a[1])
    .slice(0, amount)
    .map(([name, count]) => ({
      name,
      count,
    }));
}

function calculateStats(incidents) {
  const offenseCounts = {};
  const locationCounts = {};

  const timeCounts = {
    Morning: 0,
    Afternoon: 0,
    Evening: 0,
    Overnight: 0,
  };

  let openCases = 0;

  for (const incident of incidents) {
    // Count every offense attached to an incident.
    for (const offense of incident.offenses) {
      increment(offenseCounts, offense);
    }

    increment(locationCounts, incident.location);

    const timeBucket = getTimeBucket(
      incident.reported
    );

    if (timeCounts[timeBucket] !== undefined) {
      timeCounts[timeBucket]++;
    }

    if (
      incident.disposition
        .toLowerCase()
        .includes("open")
    ) {
      openCases++;
    }
  }

  return {
    totalIncidents: incidents.length,

    openCases,

    topOffenses: topValues(
      offenseCounts,
      6
    ),

    topLocations: topValues(
      locationCounts,
      5
    ),

    timeBuckets: Object.entries(
      timeCounts
    ).map(([name, count]) => ({
      name,
      count,
    })),
  };
}

export async function GET() {
  try {
    /*
      Grab the first 6 pages.

      This is deliberately small because we are
      building a one-hour hackathon project.

      Later, you could increase this.
    */
    const pageNumbers = [0, 1, 2, 3, 4, 5];

    const pages = await Promise.all(
      pageNumbers.map(downloadPage)
    );

    const allIncidents = pages.flat();

    /*
      University Park incident IDs currently follow
      patterns like 26UP04632.

      Filter to those UP records.
    */
    const universityPark = allIncidents.filter(
      (incident) =>
        /^\d{2}UP\d+$/i.test(incident.id)
    );

    /*
      Remove duplicates just in case pagination
      changes while we load the pages.
    */
    const unique = Array.from(
      new Map(
        universityPark.map((incident) => [
          incident.id,
          incident,
        ])
      ).values()
    );

    const stats = calculateStats(unique);

    return Response.json({
      campus: "Penn State University Park",

      source:
        "Penn State University Police Daily Crime Log",

      retrievedAt:
        new Date().toISOString(),

      stats,

      incidents: unique,
    });
  } catch (error) {
    console.error(error);

    return Response.json(
      {
        error:
          "Unable to load Penn State crime data",
      },
      {
        status: 500,
      }
    );
  }
}