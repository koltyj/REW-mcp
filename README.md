# REW-mcp
Below is a clean, copy-pasteable instruction / master prompt you can give to Copilot / Cursor / Claude Code / any agentic coder to build an MCP server around the REW API, explicitly optimized for speaker placement analysis + Genelec GLM workflows.

This is written as implementation instructions, not marketing copy.

⸻

MCP Server Specification: REW-Driven Room Calibration Assistant

Objective

Create an MCP (Model Context Protocol) server that exposes Room EQ Wizard (REW) measurement data and analysis tools to LLMs (Claude/Copilot), enabling AI-assisted speaker placement decisions and validation of Genelec GLM calibration.

The MCP server does not control REW in real time.
It ingests, parses, compares, and analyzes REW exports, then provides structured insights to an LLM.

Primary use cases:
	•	Speaker placement optimization
	•	Pre- vs post-GLM calibration comparison
	•	Identification of room modes, nulls, reflections
	•	Decision support (move speaker vs trust GLM vs treat room)

⸻

Non-Goals (Important)
	•	❌ No real-time audio control
	•	❌ No DSP or EQ application
	•	❌ No attempt to replace Genelec GLM
	•	❌ No automatic “magic fixes”

The system analyzes and advises only.
All physical changes remain human-executed.

⸻

High-Level Architecture

REW (manual measurements)
   ↓ (export)
Measurement Files (.txt / .mdat / .csv)
   ↓
MCP Server
   ↓
Structured Analysis API
   ↓
LLM (Claude / Copilot)
   ↓
Human decision


⸻

Supported Inputs (REW)

The MCP server must support offline REW exports:

Required
	•	Frequency response (SPL vs Frequency)
	•	Channel identification (L / R / Sub / Combined)
	•	Measurement label (user-defined)

Optional (but supported)
	•	Impulse response data
	•	ETC peak timings
	•	Waterfall / decay data
	•	Group delay

Supported Formats
	•	REW “Measurement as Text” export
	•	CSV exports
	•	(Optional) .mdat via parser if feasible

⸻

MCP Server Capabilities

1. Measurement Ingestion

Expose a tool:

rew.ingest_measurement

Input
	•	File contents
	•	Metadata:
	•	speaker_id (L, R, Sub, Combined)
	•	condition (e.g. “pre_glm”, “post_glm”, “placement_test_1”)
	•	mic_position_id
	•	notes (free text)

Output
	•	Normalized internal representation:
	•	frequency bins
	•	SPL values
	•	time-domain data (if present)

⸻

2. Measurement Comparison

Expose a tool:

rew.compare_measurements

Purpose
Compare two or more measurements to determine what improved, worsened, or stayed the same.

Supported comparisons
	•	Pre-GLM vs Post-GLM
	•	Placement A vs Placement B
	•	Left vs Right symmetry
	•	With vs without sub

Output (structured)
	•	Delta SPL by frequency band
	•	Identified improvements (e.g. peak reduction)
	•	Identified regressions
	•	Net assessment (better / worse / mixed)

⸻

3. Room Mode & Null Detection

Expose a tool:

rew.analyze_room_modes

Analysis rules
	•	Detect peaks > +5 dB over local average (modal buildup)
	•	Detect nulls < −6 dB with high Q (likely cancellations)
	•	Classify:
	•	likely axial mode
	•	likely boundary interference
	•	likely reflection cancellation

Output
	•	Frequency
	•	Severity
	•	Probable cause
	•	Confidence score

⸻

4. Decay & Waterfall Interpretation

Expose a tool:

rew.analyze_decay

Analysis
	•	Identify frequencies with long decay times
	•	Flag modal ringing
	•	Correlate decay issues with frequency peaks

Output
	•	Problem frequencies
	•	Estimated decay time
	•	Suggested mitigation class:
	•	placement
	•	treatment
	•	acceptable

⸻

5. Impulse / ETC Analysis (Optional but High Value)

Expose a tool:

rew.analyze_impulse

Analysis
	•	Detect early reflections (<20 ms)
	•	Identify asymmetry between L/R
	•	Estimate reflection path length

Output
	•	Reflection time
	•	Likely surface (floor / ceiling / side wall)
	•	Suggested action (move speaker, add treatment)

⸻

6. GLM-Aware Interpretation Layer

Expose a tool:

rew.interpret_with_glm_context

Purpose
Explain results through the lens of Genelec GLM behavior.

Rules
	•	Do not suggest EQ fixes GLM would intentionally avoid
	•	Recognize:
	•	GLM avoids boosting deep nulls
	•	GLM prioritizes LF and low-mid correction
	•	GLM defaults to flat in-room target unless tilted

Output
	•	Which issues GLM likely addressed correctly
	•	Which issues are better solved by placement
	•	Which residual issues are expected / acceptable

⸻

LLM Prompting Contract (Critical)

The MCP server must return structured, interpretable data, not prose.

The LLM is responsible for:
	•	Explaining results to the user
	•	Recommending next actions
	•	Asking clarifying questions

The MCP server must:
	•	Never hallucinate causes
	•	Always mark uncertainty
	•	Prefer “likely” over “certain”

⸻

Example LLM Usage Pattern

LLM prompt (example):

Compare pre-GLM and post-GLM measurements and tell me:
	1.	What GLM fixed well
	2.	What problems remain
	3.	Whether speaker placement changes are still justified

LLM then calls:
	1.	rew.compare_measurements
	2.	rew.analyze_room_modes
	3.	rew.interpret_with_glm_context

⸻

Guardrails
	•	If data quality is insufficient → return analysis_confidence: low
	•	Never recommend EQ values
	•	Never recommend filter Q or gain
	•	Always defer final judgment to human

⸻

Deliverables for Implementation

The agent should produce:
	1.	MCP server scaffold
	2.	Tool schemas (JSON)
	3.	REW parser module
	4.	Analysis engine (deterministic rules, not ML)
	5.	Example LLM conversation
	6.	README explaining workflow for studio users

⸻

Success Criteria

The system is successful if:
	•	It can clearly say “Placement B is objectively better than Placement A”
	•	It can explain why GLM did or did not fix an issue
	•	It reduces guesswork without pretending certainty
	•	It respects Genelec GLM’s design philosophy

⸻

Final Instruction to Copilot

Implement this MCP server exactly as specified.
Optimize for epistemic honesty, clarity, and human-in-the-loop decisions.
Do not invent data, filters, or certainty.

