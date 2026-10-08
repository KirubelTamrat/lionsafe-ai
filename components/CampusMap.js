"use client";

import { useEffect, useMemo, useState } from "react";

import {
  MapContainer,
  TileLayer,
  GeoJSON,
  CircleMarker,
  Popup,
  Tooltip,
} from "react-leaflet";


// ----------------------------------------------------
// Clean location names so PSU Police and GIS names
// can be compared.
//
// "MOORE BLDG" -> "MOORE"
// "Moore Building" -> "MOORE"
// "Cross Hall" -> "CROSS"
// ----------------------------------------------------

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


// ----------------------------------------------------
// Some police locations are not buildings.
//
// We don't want to accidentally match roads,
// parking lots, etc. to a building.
// ----------------------------------------------------

function looksLikeNonBuilding(location = "") {
  const value = location.toUpperCase();

  return (
    value.startsWith("LOT ") ||
    value.includes(" PARKING") ||
    value.includes(" DECK") ||
    value.includes(" AVE") ||
    value.includes(" AVENUE") ||
    value.includes(" ROAD") ||
    value.includes(" RD ") ||
    value.includes(" STREET") ||
    value.includes(" ST ") ||
    value.includes("INTERSECTION") ||
    value.includes(" & ")
  );
}


// ----------------------------------------------------
// Get possible names from the PSU building feature.
// ----------------------------------------------------

function getBuildingNames(feature) {
  const props = feature.properties || {};

  return [
    props.BLDG_NAME,
    props.BLDG_NAME_,
  ]
    .filter(Boolean)
    .map(cleanName)
    .filter((name) => name.length >= 3);
}


// ----------------------------------------------------
// Pretty building name for popup.
// ----------------------------------------------------

function getBuildingName(feature) {
  const props = feature.properties || {};

  return (
    props.BLDG_NAME ||
    props.BLDG_NAME_ ||
    "Penn State Building"
  );
}


// ----------------------------------------------------
// Does one police incident match one GIS building?
// ----------------------------------------------------

function incidentMatchesBuilding(incident, feature) {
  if (!incident?.location) {
    return false;
  }

  if (looksLikeNonBuilding(incident.location)) {
    return false;
  }

  const incidentName = cleanName(incident.location);

  if (incidentName.length < 3) {
    return false;
  }

  const buildingNames = getBuildingNames(feature);

  return buildingNames.some((buildingName) => {
    // Best case:
    // "CROSS" === "CROSS"
    if (buildingName === incidentName) {
      return true;
    }

    // Handle:
    // "MOORE"
    // vs
    // "MOORE LABORATORY"
    if (
      buildingName.length >= 5 &&
      incidentName.length >= 5
    ) {
      return (
        buildingName.includes(incidentName) ||
        incidentName.includes(buildingName)
      );
    }

    return false;
  });
}


// ----------------------------------------------------
// Get an approximate center of a building polygon.
//
// We'll put our incident-count circle here.
// ----------------------------------------------------

function getFeatureCenter(feature) {
  const coordinates = feature.geometry?.coordinates;

  if (!coordinates) {
    return null;
  }

  const points = [];

  function collect(value) {
    if (
      Array.isArray(value) &&
      typeof value[0] === "number" &&
      typeof value[1] === "number"
    ) {
      points.push(value);
      return;
    }

    if (Array.isArray(value)) {
      value.forEach(collect);
    }
  }

  collect(coordinates);

  if (!points.length) {
    return null;
  }

  let longitudeTotal = 0;
  let latitudeTotal = 0;

  for (const point of points) {
    longitudeTotal += point[0];
    latitudeTotal += point[1];
  }

  return [
    latitudeTotal / points.length,
    longitudeTotal / points.length,
  ];
}


export default function CampusMap({
  incidents = [],
}) {
  const [buildings, setBuildings] = useState(null);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState("");


  // --------------------------------------------------
  // Load PSU building GIS
  // --------------------------------------------------

  useEffect(() => {
    async function loadBuildings() {
      try {
        const response = await fetch("/api/buildings");

        if (!response.ok) {
          throw new Error(
            "Unable to load Penn State GIS data"
          );
        }

        const result = await response.json();

        console.log(
          "PSU buildings loaded:",
          result.features?.length
        );

        setBuildings(result);
      } catch (err) {
        console.error("MAP ERROR:", err);

        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    loadBuildings();
  }, []);


  // --------------------------------------------------
  // Join police incident data to building GIS.
  // --------------------------------------------------

  const mappedBuildings = useMemo(() => {
    if (!buildings?.features) {
      return null;
    }

    const features = buildings.features.map(
      (feature) => {
        const matchedIncidents = incidents.filter(
          (incident) =>
            incidentMatchesBuilding(
              incident,
              feature
            )
        );

        return {
          ...feature,

          properties: {
            ...feature.properties,

            incidentCount:
              matchedIncidents.length,

            matchedIncidents,
          },
        };
      }
    );

    return {
      ...buildings,
      features,
    };
  }, [buildings, incidents]);


  // --------------------------------------------------
  // Keep only buildings containing reports.
  // --------------------------------------------------

  const incidentBuildings = useMemo(() => {
    if (!mappedBuildings?.features) {
      return [];
    }

    return mappedBuildings.features
      .filter(
        (feature) =>
          (feature.properties?.incidentCount || 0) > 0
      )
      .map((feature) => ({
        feature,

        center: getFeatureCenter(feature),

        count:
          feature.properties.incidentCount,

        incidents:
          feature.properties.matchedIncidents,
      }))
      .filter((item) => item.center);
  }, [mappedBuildings]);


  // --------------------------------------------------
  // Count unique incidents that successfully mapped.
  // --------------------------------------------------

  const mappedIncidentIds = useMemo(() => {
    const ids = new Set();

    for (const building of incidentBuildings) {
      for (const incident of building.incidents) {
        ids.add(incident.id);
      }
    }

    return ids;
  }, [incidentBuildings]);


  if (loading) {
    return (
      <div className="h-[650px] flex items-center justify-center bg-slate-950 text-slate-400">
        Loading Penn State campus map...
      </div>
    );
  }


  if (error || !mappedBuildings) {
    return (
      <div className="h-[650px] flex items-center justify-center bg-slate-950 text-red-400">
        Map unavailable: {error}
      </div>
    );
  }


  // --------------------------------------------------
  // Buildings get more visible based on report count.
  //
  // THIS IS NOT A SAFETY SCORE.
  // --------------------------------------------------

  function buildingStyle(feature) {
    const count =
      feature.properties?.incidentCount || 0;

    if (count >= 4) {
      return {
        color: "#60a5fa",
        weight: 3,
        fillColor: "#2563eb",
        fillOpacity: 0.75,
      };
    }

    if (count >= 2) {
      return {
        color: "#60a5fa",
        weight: 2.5,
        fillColor: "#3b82f6",
        fillOpacity: 0.55,
      };
    }

    if (count === 1) {
      return {
        color: "#60a5fa",
        weight: 2,
        fillColor: "#60a5fa",
        fillOpacity: 0.35,
      };
    }

    return {
      color: "#475569",
      weight: 0.8,
      fillColor: "#1e293b",
      fillOpacity: 0.08,
    };
  }


  function onEachBuilding(feature, layer) {
    const count =
      feature.properties?.incidentCount || 0;

    const name =
      getBuildingName(feature);

    if (count > 0) {
      layer.bindTooltip(
        `${name}: ${count} ${
          count === 1
            ? "report"
            : "reports"
        }`
      );
    }

    layer.on({
      mouseover: () => {
        layer.setStyle({
          weight: 3,
        });
      },

      mouseout: () => {
        layer.setStyle(
          buildingStyle(feature)
        );
      },
    });
  }


  return (
    <div className="relative">

      <MapContainer
        center={[40.7982, -77.8599]}
        zoom={15}
        scrollWheelZoom={true}
        className="h-[650px] w-full"
      >

        <TileLayer
          attribution="&copy; OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />


        {/* PSU BUILDING POLYGONS */}

        <GeoJSON
          data={mappedBuildings}
          style={buildingStyle}
          onEachFeature={onEachBuilding}
        />


        {/* REPORT MARKERS */}

        {incidentBuildings.map(
          (building, index) => {
            const name =
              getBuildingName(
                building.feature
              );

            return (
              <CircleMarker
                key={`${name}-${index}`}
                center={building.center}
                radius={Math.min(
                  7 + building.count * 2,
                  18
                )}
                pathOptions={{
                  color: "#ffffff",
                  weight: 2,
                  fillColor: "#2563eb",
                  fillOpacity: 0.95,
                }}
              >

                <Tooltip>
                  {name}
                  {" — "}
                  {building.count}
                  {" "}
                  {building.count === 1
                    ? "report"
                    : "reports"}
                </Tooltip>


                <Popup>

                  <div
                    style={{
                      minWidth: "250px",
                    }}
                  >

                    <strong
                      style={{
                        fontSize: "16px",
                      }}
                    >
                      {name}
                    </strong>


                    <div
                      style={{
                        marginTop: "6px",
                        marginBottom: "12px",
                      }}
                    >
                      {building.count} recent matched{" "}
                      {building.count === 1
                        ? "report"
                        : "reports"}
                    </div>


                    {building.incidents
                      .slice(0, 5)
                      .map((incident) => (

                        <div
                          key={incident.id}
                          style={{
                            borderTop:
                              "1px solid #ddd",
                            paddingTop: "8px",
                            marginTop: "8px",
                          }}
                        >

                          <strong>
                            {incident.offenses?.[0] ||
                              "Incident"}
                          </strong>

                          <div>
                            {incident.reported}
                          </div>

                          <div>
                            Status:{" "}
                            {incident.disposition}
                          </div>

                        </div>

                      ))}

                  </div>

                </Popup>

              </CircleMarker>
            );
          }
        )}

      </MapContainer>


      {/* MAPPING STATUS */}

      <div className="absolute top-4 right-4 z-[1000] bg-slate-950/95 border border-slate-700 rounded-xl px-4 py-3 shadow-xl">

        <div className="text-white font-semibold">
          {mappedIncidentIds.size}
          {" / "}
          {incidents.length}
          {" reports mapped"}
        </div>

        <div className="text-xs text-slate-400 mt-1">
          Building locations only
        </div>

      </div>


      {/* LEGEND */}

      <div className="absolute bottom-6 left-5 z-[1000] bg-slate-950/95 border border-slate-700 rounded-xl p-4 shadow-xl">

        <div className="text-white font-semibold mb-3">
          Recent report count
        </div>

        <Legend
          opacity={0.35}
          label="1 report"
        />

        <Legend
          opacity={0.55}
          label="2–3 reports"
        />

        <Legend
          opacity={0.75}
          label="4+ reports"
        />

        <div className="text-xs text-slate-500 mt-3 max-w-[200px]">
          Shading represents matched report
          counts, not a safety or risk score.
        </div>

      </div>

    </div>
  );
}


function Legend({
  opacity,
  label,
}) {
  return (
    <div className="flex items-center gap-2 mb-2">

      <div
        className="w-4 h-4 bg-blue-500 border border-blue-300"
        style={{
          opacity,
        }}
      />

      <span className="text-slate-300 text-sm">
        {label}
      </span>

    </div>
  );
}