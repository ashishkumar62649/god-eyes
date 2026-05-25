# Survey of India — Digital Vector Boundary Data Licensing Request Template

**Layer:** `layer_02_borders_boundaries`
**Work order:** WO-078A-BORDERS-SOURCE-LICENSE-CLEARANCE-KIT
**Purpose:** Template for human to send to Survey of India to request licensing information
for official digital vector boundary data.

---

## WARNING

**Agents must not fabricate, guess, or assume Survey of India approval.**
This template is for human use only. Only a human may send this request and receive
a response. The response must be saved as evidence before any India boundary ingestion
work begins.

---

## 1. Contact Information

Survey of India official contact channels:

- **Website:** https://surveyofindia.gov.in
- **Geospatial Guidelines:** https://onlinemaps.surveyofindia.gov.in/GeospatialGuidelines.aspx
- **Political Map page:** https://surveyofindia.gov.in/pages/political-map-of-india
- **General enquiry:** Use the contact form or email listed on the official website.
- **Geodata Sales / Licensing:** Contact the Map Sales and Publication Division,
  Survey of India, Hathibarkala Estate, Dehradun — 248001, Uttarakhand, India.

Before sending, check the current contact details on the official website, as they
may have been updated.

---

## 2. Email / Message Template

---

**Subject:** Request for Licensing Information — Official Digital Vector Boundary Data
for Private Web Mapping Application

Dear Survey of India / Map Sales and Publication Division,

I am writing to request information about licensing official digital vector boundary
data from Survey of India for use in a private web mapping application.

Our application is a geospatial intelligence platform that displays geographic data
on a 3D globe. We require official boundary data that accurately reflects the
Government of India's official depiction of India's national boundary, including
Jammu & Kashmir, Ladakh, and all areas under Indian claim.

We have reviewed the Survey of India Geospatial Guidelines at:
https://onlinemaps.surveyofindia.gov.in/GeospatialGuidelines.aspx

We would like to ask the following questions:

**1. Data availability**
Is official digital vector boundary data available for licensing to private software
or web mapping applications?

**2. National boundary coverage**
Does the available dataset include India's complete national boundary as per the
Government of India's official depiction?

**3. State and UT boundary coverage**
Does the dataset include state and Union Territory boundaries, including the boundaries
of Jammu & Kashmir (UT) and Ladakh (UT) as constituted after the Jammu and Kashmir
Reorganisation Act, 2019?

**4. Coverage of disputed and claimed areas**
Does the dataset include India's official depiction of:
- Pakistan-occupied Jammu & Kashmir (PoK)?
- Chinese-occupied areas including Aksai Chin?
- All other areas under Indian claim?

**5. Data format**
What formats are available? (e.g., Shapefile, GeoJSON, GML, KML, or other)

**6. License terms**
What are the license terms for use in a private web mapping application?
Specifically:
- Is use in a private software application permitted?
- Is commercial use permitted or restricted?
- What attribution is required in the application?
- Are derivative works permitted (e.g., simplification for display at different zoom levels)?
- Are there restrictions on redistribution of the data or derived products?
- Are there display restrictions (e.g., required disclaimers, prohibited depictions)?

**7. Licensing process**
What is the official process to obtain a license?
Is there a fee? If so, what is the fee structure?

**8. Contact for follow-up**
Who should we contact for follow-up questions about licensing?

We are committed to displaying India's boundaries in full compliance with the
Government of India's official depiction and Survey of India standards.

Thank you for your assistance.

Sincerely,
[Your name]
[Your organisation / project name]
[Your contact email]
[Your contact phone, if applicable]

---

## 3. After Receiving a Response

When Survey of India responds, the human must:

- [ ] Save the full response text (email body, letter scan, or web confirmation) as a
  plain text or markdown file.
- [ ] Name the file: `SOI_RESPONSE_[YYYYMMDD].md` (e.g., `SOI_RESPONSE_20260601.md`)
- [ ] Save it in: `docs/data/layer_02_borders_boundaries/`
- [ ] Commit the file to the repository.
- [ ] Update `docs/control/BORDERS_BOUNDARIES_SOURCE_REVIEW_TRACKER.md`:
  - Set Survey of India status to `license_received` or `approved` or `rejected`
  - Record license terms, format, coverage confirmation, and attribution requirements
  - Record the evidence file path
- [ ] Notify Kiro that the response has been saved so a review and WO-078B can proceed.

---

## 4. If Survey of India Data Is Not Available

If Survey of India confirms that digital vector boundary data is not available for
licensing to private applications, or if the license terms are incompatible:

- Document the response in `docs/data/layer_02_borders_boundaries/`.
- Update the source review tracker with status `rejected` and the reason.
- India boundary ingestion remains permanently blocked until an alternative official
  source is identified and approved by Kiro in a new work order.
- Do not use Natural Earth, OSM, or any other source as a substitute for India
  boundaries without a new Kiro-approved work order.

---

## 5. Warning: Do Not Fabricate Approval

**No agent may:**
- Fabricate a Survey of India response.
- Guess or assume license terms.
- Mark the India source as `approved` without a real response saved in the repository.
- Start India boundary ingestion without evidence of approval.

Any attempt to bypass this process is a stop condition per
`docs/control/BORDERS_BOUNDARIES_POLICY_SOURCE_PLAN.md` Section 13.
