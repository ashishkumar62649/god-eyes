# WO-032-UX-RESEARCH — Airport Public Profile UX and Source Research Review

## 1. Is English Wikipedia summary safe/useful for airport Object Intel?
Yes. The English Wikipedia summary (via the Wikimedia REST API) provides a concise plain-text extract and short description that gives a high-level overview of the airport. It avoids the clutter of full HTML/wikitext. It is useful for background context as it provides encyclopedic facts rather than operational status.

## 2. What Wikidata fields are most valuable?
The most valuable Wikidata properties for the airport Object Intel are:
*   **P571**: Inception / opened date
*   **P137**: Operator
*   **P127**: Owned by
*   **P856**: Official website
*   **P18**: Image (thumbnail)

## 3. How should we display attribution clearly?
Attribution must be rendered visibly in the UI to comply with CC BY-SA 4.0 licensing requirements. The standard attribution line should be:
`Source: Wikipedia (CC BY-SA 4.0) · Wikidata (CC0)`
Both "Wikipedia" and "Wikidata" must be hyperlinked to the source article and entity, respectively.

## 4. How should we communicate low-confidence/no-profile cases?
When there is a low-confidence match or no profile found, the UI should not display an error state. Instead, it should show a calm, normal fallback message:
> "No public profile is available for this airport."
This sets the expectation that missing data is normal, especially for small airfields and heliports.

## 5. What should we avoid showing so users do not think this is live aviation data?
We must explicitly avoid showing:
*   Live flight schedules or departure/arrival boards
*   Real-time passenger counts or throughput statistics
*   NOTAM, METAR, TAF, or any operational aviation status
*   Paid commercial data (e.g., from FlightAware, FlightRadar24)
The focus must strictly remain on static, public facts.

## 6. What UI copy should the Object Intel panel use?
The panel should use the following field labels:
*   Section Header: **Public Profile**
*   **Public Summary**: (Truncated paragraph text with "Read more" link)
*   **Interesting Facts**: (Bulleted list)
*   **Opened / Built**: (If available)
*   **Operator**: (If available)
*   **Owner**: (If available and operator is shown)
*   **Official Website**: (Clickable link)
*   **Last updated**: (Relative time, e.g., "3 days ago")
*   **Source**: (The required attribution links)

## 7. What are the top risks with Wikipedia/Wikidata matching?
The primary risk is associating an airport with the wrong Wikipedia article or Wikidata entity ("a wrong match is worse than no match"). To mitigate this, a strict priority chain must be used:
1.  **High Confidence**: OurAirports `wikipedia_link`.
2.  **High Confidence**: Wikidata ICAO code lookup (P239).
3.  **High Confidence**: Wikidata IATA code lookup (P238).
4.  **Medium/Low Confidence**: Wikipedia title search or coordinate proximity + name similarity.
For medium/low confidence methods, a **50 km coordinate sanity check** is mandatory (using Wikidata P625) to prevent drastically incorrect associations. Matches that fail this check must be downgraded and not displayed to the user.