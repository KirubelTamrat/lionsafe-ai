import { arcgisToGeoJSON } from "@terraformer/arcgis";

const PSU_BUILDINGS_URL =
  "https://mapservices.pasda.psu.edu/server/rest/services/pasda/PSU_Campus/MapServer/1/query";

function chunks(array, size) {
  const result = [];

  for (let i = 0; i < array.length; i += size) {
    result.push(array.slice(i, i + size));
  }

  return result;
}

async function getObjectIds() {
  const params = new URLSearchParams({
    where: "1=1",
    returnIdsOnly: "true",
    f: "json",
  });

  const response = await fetch(
    `${PSU_BUILDINGS_URL}?${params.toString()}`,
    {
      cache: "no-store",
    }
  );

  const text = await response.text();

  console.log(
    "ID QUERY STATUS:",
    response.status
  );

  if (!response.ok) {
    console.error(
      "ID QUERY RESPONSE:",
      text
    );

    throw new Error(
      `PSU GIS ID query returned ${response.status}`
    );
  }

  const data = JSON.parse(text);

  if (data.error) {
    console.error(
      "ID QUERY ARCGIS ERROR:",
      data.error
    );

    throw new Error(
      data.error.message ||
        "Unable to retrieve PSU building IDs"
    );
  }

  return data.objectIds || [];
}

async function getBuildingBatch(objectIds) {
  const params = new URLSearchParams({
    objectIds: objectIds.join(","),

    outFields:
      "OBJECTID,BLDG_NUM,BLDG_NAME_,BLDG_NAME",

    returnGeometry: "true",

    // Keep Penn State's native coordinate system.
    // It is geographic latitude/longitude data.
    returnZ: "false",
    returnM: "false",

    f: "json",
  });

  const response = await fetch(
    `${PSU_BUILDINGS_URL}?${params.toString()}`,
    {
      cache: "no-store",
    }
  );

  const text = await response.text();

  console.log(
    `BUILDING BATCH (${objectIds.length}) STATUS:`,
    response.status
  );

  if (!response.ok) {
    console.error(
      "BUILDING BATCH RESPONSE:",
      text
    );

    throw new Error(
      `PSU GIS batch returned ${response.status}`
    );
  }

  const data = JSON.parse(text);

  if (data.error) {
    console.error(
      "BUILDING BATCH ARCGIS ERROR:",
      data.error
    );

    throw new Error(
      data.error.message ||
        "PSU GIS batch query failed"
    );
  }

  return data;
}

export async function GET() {
  try {
    /*
      STEP 1:
      Get only building IDs.

      This request is tiny because it contains
      no geometry.
    */

    const objectIds =
      await getObjectIds();

    console.log(
      "PSU BUILDING IDS:",
      objectIds.length
    );

    if (!objectIds.length) {
      throw new Error(
        "Penn State GIS returned no building IDs"
      );
    }

    /*
      STEP 2:
      Download geometry in small groups.

      75 is deliberately conservative.
    */

    const batches =
      chunks(objectIds, 75);

    const responses = [];

    for (const batch of batches) {
      const result =
        await getBuildingBatch(batch);

      responses.push(result);
    }

    /*
      STEP 3:
      Merge all ArcGIS features.
    */

    const arcgisFeatures =
      responses.flatMap(
        (response) =>
          response.features || []
      );

    console.log(
      "PSU BUILDINGS RECEIVED:",
      arcgisFeatures.length
    );

    /*
      STEP 4:
      Convert ArcGIS features individually
      into GeoJSON.

      Doing it feature-by-feature also makes
      this easier to debug.
    */

    const geojsonFeatures =
      arcgisFeatures.map(
        (feature) =>
          arcgisToGeoJSON(
            feature,
            "OBJECTID"
          )
      );

    return Response.json({
      type: "FeatureCollection",
      features: geojsonFeatures,
      metadata: {
        source:
          "Penn State / PASDA",
        featureCount:
          geojsonFeatures.length,
      },
    });

  } catch (error) {
    console.error(
      "BUILDING GIS ERROR:",
      error
    );

    return Response.json(
      {
        error:
          "Unable to load Penn State building data",

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