"use client";

import { useEffect, useState } from "react";

import {
  MapContainer,
  TileLayer,
  GeoJSON,
} from "react-leaflet";

export default function CampusMap() {
  const [buildings, setBuildings] =
    useState(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  useEffect(() => {
    async function loadBuildings() {
      try {
        const response = await fetch(
          "/api/buildings"
        );

        if (!response.ok) {
          throw new Error(
            "Unable to load PSU GIS"
          );
        }

        const result =
          await response.json();

        console.log(
          "BUILDINGS LOADED:",
          result.features?.length
        );

        setBuildings(result);
      } catch (error) {
        console.error(error);

        setError(error.message);
      } finally {
        setLoading(false);
      }
    }

    loadBuildings();
  }, []);

  if (loading) {
    return (
      <div className="h-[600px] flex items-center justify-center bg-slate-950 text-slate-400">
        Loading Penn State campus map...
      </div>
    );
  }

  if (error || !buildings) {
    return (
      <div className="h-[600px] flex items-center justify-center bg-slate-950 text-red-400">
        Map unavailable: {error}
      </div>
    );
  }

  function buildingStyle() {
    return {
      color: "#60a5fa",
      weight: 1,
      fillColor: "#1e40af",
      fillOpacity: 0.2,
    };
  }

  function onEachBuilding(
    feature,
    layer
  ) {
    const properties =
      feature.properties || {};

    const name =
      properties.BLDG_NAME ||
      properties.BLDG_NAME_ ||
      "Penn State Building";

    const buildingNumber =
      properties.BLDG_NUM ||
      "Unknown";

    layer.bindPopup(`
      <div style="min-width: 180px;">
        <strong>${name}</strong>

        <div style="margin-top: 6px;">
          Building:
          ${buildingNumber}
        </div>
      </div>
    `);

    layer.on({
      mouseover: () => {
        layer.setStyle({
          weight: 3,
          fillOpacity: 0.45,
        });
      },

      mouseout: () => {
        layer.setStyle(
          buildingStyle()
        );
      },
    });
  }

  return (
    <MapContainer
      center={[
        40.7982,
        -77.8599,
      ]}
      zoom={15}
      scrollWheelZoom={true}
      className="h-[600px] w-full"
    >
      <TileLayer
        attribution="&copy; OpenStreetMap contributors"
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      <GeoJSON
        data={buildings}
        style={buildingStyle}
        onEachFeature={
          onEachBuilding
        }
      />
    </MapContainer>
  );
}