# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-01-22

### Added

- **MCP Tools**
  - `rew.api_connect` - Connect to REW API
  - `rew.api_check_levels` - Mic input level checking with clipping detection
  - `rew.api_calibrate_spl` - Monitor level calibration to target SPL
  - `rew.api_measurement_session` - Guided L/R/Sub measurement sequence
  - `rew.analyze_room` - Full room analysis with prioritized recommendations
  - `rew.api_parse_text` - REW text export parsing
  - `rew.optimize_room` - Placement recommendations and validation

- **MCP Prompts**
  - `rew_calibration_full` - Complete calibration workflow
  - `rew_gain_staging` - Standalone level calibration
  - `rew_measurement_workflow` - Session-aware L/R/Sub sequence
  - `rew_optimization_workflow` - Iterative placement optimization

- **MCP Resources**
  - `session://{id}` - Session state and measurements
  - `measurement://{id}` - Full frequency response data
  - `recommendations://{id}` - Active recommendations
  - `history://{id}` - Measurement history

- **Analysis Capabilities**
  - Room mode detection and identification
  - SBIR (Speaker Boundary Interference Response) analysis
  - Stereo symmetry evaluation
  - GLM correction transparency (before/after comparison)
  - Target curve adherence scoring

- **Documentation**
  - Architecture guide
  - GLM context explanation
  - Analysis rules documentation
  - File format specifications

### Technical

- TypeScript strict mode with full type coverage
- 864 passing tests (74.85% coverage)
- Zod schema validation throughout
- CI/CD with multi-version Node.js testing (18, 20, 22)
- Automated npm publishing with provenance

[1.0.0]: https://github.com/koltyj/rew-mcp/releases/tag/v1.0.0
