# REW Format & API Compliance Audit

**Date:** January 20, 2026
**Auditor:** Gemini CLI
**Version Audited:** Source as of Jan 20, 2026

## 1. Executive Summary

| Component | Status | Description |
|-----------|--------|-------------|
| **Text Parser (Freq)** | **PASS** | Implementation matches REW text export specifications. |
| **Text Parser (Impulse)** | **PARTIAL** | Code expects 2-column format, but internal docs show 1-column. |
| **API Client** | **PARTIAL** | Most endpoints match, but `waterfall` endpoint is likely invalid. |
| **Data Decoding** | **PASS** | Base64 Big-Endian float decoding is correct. |

---

## 2. Detailed Findings

### 2.1 Frequency Response Parser
*   **File:** `src/parser/rew-text.ts`
*   **Spec:** REW Text Export (Freq, SPL, Phase).
*   **Implementation:**
    *   Correctly identifies comment lines starting with `*`.
    *   Correctly parses 2 or 3 columns (Freq, SPL, optional Phase).
    *   Correctly handles European number formats (commas).
*   **Verdict:** **COMPLIANT**

### 2.2 Impulse Response Parser
*   **File:** `src/parser/rew-text.ts`
*   **Spec:** REW Impulse Response Text Export.
*   **Discrepancy:**
    *   **Code:** Expects 2 columns (`time`, `value`) via `parts.length >= 2`.
    *   **Internal Docs (`docs/file-formats.md`):** Shows a format with a header and a single column of samples.
    *   **External Search:** Indicates REW typically exports "Time, Amplitude" (2 columns).
*   **Risk:** If a user uses an export setting that produces the 1-column format (as seen in the internal doc), the current parser will fail to extract data.
*   **Verdict:** **AMBIGUOUS / PARTIAL**

### 2.3 API Client Compliance
*   **File:** `src/api/rew-client.ts`
*   **Spec:** REW REST API (`localhost:4735`).
*   **Endpoints Verified:**
    *   ✅ `GET /measurements/:id/frequency-response`
    *   ✅ `GET /measurements/:id/impulse-response`
    *   ✅ `GET /measurements/:id/rt60` (Confirmed via external search)
    *   ❌ `GET /measurements/:id/waterfall`
        *   **Finding:** No evidence found in official documentation or search results for a direct *data retrieval* endpoint for waterfall data. The API supports *generating* waterfall graphs via commands, but likely does not stream the raw waterfall matrix via a GET endpoint.
*   **Verdict:** **NON-COMPLIANT (Waterfall endpoint)**

### 2.4 Data Decoding
*   **File:** `src/api/base64-decoder.ts`
*   **Spec:** Base64-encoded strings of Big-Endian 32-bit floats.
*   **Implementation:** Uses `buffer.readFloatBE(i)`.
*   **Verdict:** **COMPLIANT**

---

## 3. Recommendations

1.  **Remove or Verify Waterfall Endpoint:**
    *   Remove `getWaterfallData` from `src/api/rew-client.ts` unless a custom API extension is being used.
    *   If waterfall data is needed, investigate if it can be derived from the Impulse Response or if `process-measurements` commands are required.

2.  **Harmonize Impulse Response Parsing:**
    *   Update `src/parser/rew-text.ts` to support **both** 2-column (Time, Value) and 1-column (Header + Value) formats.
    *   Update `docs/file-formats.md` to accurately reflect the supported formats and priority.

3.  **Update Internal Documentation:**
    *   Correct the `docs/file-formats.md` to show the 2-column IR example if that is the preferred/default export format.

---

## 4. Evidence References

*   **REW API Docs:** https://www.roomeqwizard.com/help/help_en-GB/html/api.html
*   **REW File Docs:** https://www.roomeqwizard.com/help/help_en-GB/html/file.html
*   **Search Confirmation:** Confirmed `rt60` endpoint exists; failed to verify `waterfall` endpoint.
