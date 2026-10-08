# LionSafe AI 

LionSafe AI is an interactive campus intelligence dashboard built for Penn State University Park.

The project started with a simple question:

> Penn State already publishes public safety data, but how can we make that data easier for students to actually understand and explore?

LionSafe takes publicly available Penn State incident data, cleans and analyzes it, visualizes patterns, and uses AI to help users ask questions about what the data shows.

The project is still actively being developed.

---

## What LionSafe Does

LionSafe currently combines Penn State public safety data with an interactive web dashboard.

Users can:

- View recent University Park police incident reports
- See the most common incident categories
- Compare reports by time of day
- View locations with the most reported incidents
- See how many cases are currently open
- Read an AI-generated summary of recent patterns
- Ask questions about the loaded incident data using an interactive AI chat
- Explore Penn State University Park through an interactive GIS map
- View official Penn State building polygons using public PASDA GIS data

The goal is not to label parts of campus as "safe" or "unsafe."

Instead, LionSafe focuses on helping users explore and understand publicly reported campus activity.

---

## Current Dashboard

The dashboard currently includes:

### Incident Overview

LionSafe automatically pulls recent records from the Penn State University Police Daily Crime Log.

Each incident can contain information such as:

- Incident number
- Reported time
- Occurrence time
- Incident description
- Offense category
- Location
- Case disposition

The application currently analyzes recent University Park records rather than the entire historical crime log.

---

### Data Analysis

The backend turns the raw police log into structured data and calculates statistics including:

- Total incidents analyzed
- Open cases
- Most common offense categories
- Most frequently reported locations
- Reports by time of day

Reported times are currently grouped into:

- Morning
- Afternoon
- Evening
- Overnight

One incident may contain multiple offense classifications, so offense counts should not necessarily be interpreted as unique incident counts.

---

## Ask LionSafe

LionSafe includes an AI assistant that can answer questions about the currently loaded dataset.

Example questions:

- What time of day has the most reports?
- What are the most common incident categories?
- How many cases are currently open?
- What patterns stand out?
- Does the location with the most reports mean it is dangerous?

The AI is instructed to answer using the supplied dataset rather than inventing information.

It is also instructed not to:

- Predict future crimes
- Label locations as safe or unsafe
- Estimate an individual's chance of becoming a victim
- Make assumptions about victims or suspects

The AI receives structured statistics and public incident information from the application.

---

## Interactive Campus Map

LionSafe also integrates official Penn State GIS data from PASDA.

The current map loads more than 1,000 University Park building polygons and allows users to:

- Pan around campus
- Zoom in and out
- Hover over buildings
- Click buildings
- Explore official Penn State geographic data

The GIS data is retrieved from Penn State/PASDA's ArcGIS services and converted into GeoJSON before being displayed with Leaflet.

Work is currently underway to match police incident locations with their corresponding campus buildings and display incidents directly on the map.

Future map layers may include:

- Parking lots and garages
- Roads
- Sidewalks
- Crosswalks
- Emergency phones
- Bus stops
- Campus alerts
