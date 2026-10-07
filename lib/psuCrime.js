import { convert } from "html-to-text";

const FIELD_LABELS = {
  Reported: "reported",
  Occurred: "occurred",
  "Nature of Incident": "nature",
  Offenses: "offenses",
  Location: "location",
  "Case Disposition": "disposition",
};

// Labels we don't need but may appear after an incident.
const STOP_LABELS = new Set([
  "Arrestee Name",
  "Arrestee Address",
  "Arrestee Charges",
  "Arrest Date",
]);

export function parseCrimePage(html) {
  // Convert Penn State HTML into clean readable text.
  const text = convert(html, {
    wordwrap: false,
    selectors: [
      {
        selector: "a",
        options: {
          ignoreHref: true,
        },
      },
    ],
  });

  // Turn the page into individual non-empty lines.
  const lines = text
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  const incidents = [];

  let current = null;
  let currentField = null;

  for (const line of lines) {
    // We found the beginning of a new incident.
    if (line.startsWith("INCIDENT #:")) {
      if (current) {
        incidents.push(current);
      }

      current = {
        id: line.replace("INCIDENT #:", "").trim(),
        reported: "",
        occurred: "",
        nature: "",
        offenses: [],
        location: "",
        disposition: "",
      };

      currentField = null;
      continue;
    }

    // Ignore everything before the first incident.
    if (!current) {
      continue;
    }

    // Check whether this line is one of Penn State's field labels.
    if (FIELD_LABELS[line]) {
      currentField = FIELD_LABELS[line];
      continue;
    }

    // Stop collecting fields that we don't care about.
    if (STOP_LABELS.has(line)) {
      currentField = null;
      continue;
    }

    if (!currentField) {
      continue;
    }

    // Offenses can contain multiple entries.
    if (currentField === "offenses") {
      current.offenses.push(line);
    } else {
      // Some fields may wrap onto multiple lines.
      current[currentField] = current[currentField]
        ? `${current[currentField]} ${line}`
        : line;
    }
  }

  // Don't forget the final incident.
  if (current) {
    incidents.push(current);
  }

  return incidents;
}