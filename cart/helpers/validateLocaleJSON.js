import { parse } from "@formatjs/icu-messageformat-parser";
import defaultLocalization from "../locales/locale_en-US";

export default function validateLocaleJSON(userJSON) {
  let defaultJSON = defaultLocalization;
  let valid = {};
  let missing = "";

  if (!userJSON.locale) {
    console.error("Reflow: Localization - Missing locale in localization JSON");
    return {};
  }

  // Check for missing keys

  for (const key in defaultJSON) {
    if (!userJSON[key]) {
      missing += key + ", ";
    }
  }

  if (missing.length) {
    missing = missing.slice(0, -2);
    console.info(
      "Reflow: Localization - The following keys are missing form the provided localization JSON. English language version will be used for the respective phrases instead. [" +
        missing +
        "]"
    );
  }

  // Validate the keys and intl strings.

  for (const key in userJSON) {
    let parsed, userFormats;

    // Regions keys are validated differently since they do not follow a preset schema.

    if (key == "geo") {
      for (const [countryCode, config] of Object.entries(userJSON.geo)) {
        if (config.country_name) {
          try {
            parsed = parse(config.country_name);
          } catch (error) {
            console.error(
              `Reflow: Localization - Invalid ICU Message syntax for "geo.${countryCode}.country_name". English language version will be used instead.`
            );
            continue;
          }

          userFormats = parsed.filter((f) => f.type == 1).map((f) => f.value);
          if (userFormats.length) {
            console.error(
              `Reflow: Localization - Unsupported properties in ICU Message for "geo.${countryCode}.country_name". English language version will be used instead.`
            );
            continue;
          }

          valid["geo." + countryCode.toLowerCase() + ".country_name"] = config.country_name;
        }

        if (config.regions) {
          for (const [regionCode, translatedName] of Object.entries(config.regions)) {
            try {
              parsed = parse(translatedName);
            } catch (error) {
              console.error(
                `Reflow: Localization - Invalid ICU Message syntax for "geo.${countryCode}.regions.${regionCode}". English language version will be used instead.`
              );
              continue;
            }

            userFormats = parsed.filter((f) => f.type == 1).map((f) => f.value);
            if (userFormats.length) {
              console.error(
                `Reflow: Localization - Unsupported properties in ICU Message for "geo.${countryCode}.regions.${regionCode}". English language version will be used instead.`
              );
              continue;
            }

            valid["geo." + countryCode.toLowerCase() + ".regions." + regionCode.toLowerCase()] =
              translatedName;
          }
        }
      }

      continue;
    }

    // Unsupported key

    if (!defaultJSON[key] && !removedKeys.includes(key)) {
      console.error('Reflow: Localization - Unsupported key "' + key + '" in localization JSON');
      continue;
    }

    // Invalid ICU message

    try {
      parsed = parse(userJSON[key]);
    } catch (error) {
      console.error(
        `Reflow: Localization - Invalid ICU Message syntax for "${key}". English language version will be used instead.`
      );
      continue;
    }

    // Unsupported {formats}
    // Get all {formats} from the user string and compare them to the ones in the default.

    userFormats = parsed.filter((f) => f.type == 1).map((f) => f.value);
    if (userFormats.length) {
      let defaultFormats = parse(defaultJSON[key])
        .filter((f) => f.type == 1)
        .map((f) => f.value);
      let diff = userFormats.filter((item) => !defaultFormats.includes(item));

      if (diff.length) {
        console.error(
          `Reflow: Localization - Unsupported property {${diff[0]}} in "${key}". English language version will be used instead.`
        );
        continue;
      }
    }

    valid[key] = userJSON[key];
  }

  return valid;
}
