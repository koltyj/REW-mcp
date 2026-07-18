/**
 * Tool Registration
 * 
 * Registers all REW MCP tools with the server.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { zodToJsonSchema } from 'zod-to-json-schema';

import { executeIngest, IngestInputSchema } from './ingest.js';
import { executeCompare, CompareInputSchema } from './compare.js';
import { executeRoomModes, RoomModesInputSchema } from './room-modes.js';
import { executeDecay, DecayInputSchema } from './decay.js';
import { executeImpulse, ImpulseInputSchema } from './impulse.js';
import { executeGLMInterpret, GLMInterpretInputSchema } from './glm-interpret.js';
import { executeAveraging, AveragingInputSchema } from './averaging.js';
import { executeApiConnect, ApiConnectInputSchema } from './api-connect.js';
import { executeApiListMeasurements, ApiListMeasurementsInputSchema } from './api-list-measurements.js';
import { executeApiGetMeasurement, ApiGetMeasurementInputSchema } from './api-get-measurement.js';
import { executeTargetCompare, TargetCompareInputSchema } from './target-compare.js';
import { executeApiMeasure, ApiMeasureInputSchema } from './api-measure.js';
import { executeApiAudio, ApiAudioInputSchema } from './api-audio.js';
import { executeApiGenerator, ApiGeneratorInputSchema } from './api-generator.js';
import { executeApiSPLMeter, ApiSPLMeterInputSchema } from './api-spl-meter.js';
import { executeApiMeasureWorkflow, ApiMeasureWorkflowInputSchema } from './api-measure-workflow.js';
import { executeApiCalibrateSPL, ApiCalibrateSPLInputSchema } from './api-calibrate-spl.js';
import { executeApiCheckLevels, ApiCheckLevelsInputSchema } from './api-check-levels.js';
import { executeApiMeasurementSession, ApiMeasurementSessionInputSchema } from './api-measurement-session.js';
import { executeAnalyzeRoom, AnalyzeRoomInputSchema } from './analyze-room.js';
import { executeOptimizeRoom, OptimizeRoomInputSchema } from './optimize-room.js';
import { executeApiMeasurementCommands, ApiMeasurementCommandsInputSchema } from './api-measurement-commands.js';
import { executeApiMeasurementEQ, ApiMeasurementEQInputSchema } from './api-measurement-eq.js';
import { executeApiImport, ApiImportInputSchema } from './api-import.js';
import { executeApiEQ, ApiEQInputSchema } from './api-eq.js';
import { executeApiGroups, ApiGroupsInputSchema } from './api-groups.js';
import { executeApiRTA, ApiRTAInputSchema } from './api-rta.js';

/**
 * Register all tools with the MCP server
 */
export function registerTools(server: Server): void {
  // List tools handler
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: 'rew_ingest_measurement',
          title: 'REW Measurement Ingestion',
          description: 'Parse and store a REW measurement export for analysis. Accepts frequency response or impulse response data in REW text export format.',
          inputSchema: zodToJsonSchema(IngestInputSchema)
        },
        {
          name: 'rew_compare_measurements',
          title: 'Compare REW Measurements',
          description: 'Compare two or more REW measurements to determine what improved, worsened, or stayed the same. Supports pre/post GLM comparison, placement comparisons, and L/R symmetry analysis.',
          inputSchema: zodToJsonSchema(CompareInputSchema)
        },
        {
          name: 'rew_analyze_room_modes',
          title: 'Analyze Room Modes',
          description: 'Analyze a measurement for room modes, peaks, and nulls. Optionally correlates detected issues with theoretical room modes based on room dimensions.',
          inputSchema: zodToJsonSchema(RoomModesInputSchema)
        },
        {
          name: 'rew_analyze_decay',
          title: 'Analyze Decay Times',
          description: 'Analyze decay characteristics from impulse response data to identify frequencies with excessive ringing or resonance. Implements ISO 3382 compliant T20/T30/EDT calculations.',
          inputSchema: zodToJsonSchema(DecayInputSchema)
        },
        {
          name: 'rew_analyze_impulse',
          title: 'Analyze Impulse Response',
          description: 'Analyze impulse response data to detect early reflections, estimate reflection paths, and assess their impact on sound quality.',
          inputSchema: zodToJsonSchema(ImpulseInputSchema)
        },
        {
          name: 'rew_interpret_with_glm_context',
          title: 'GLM-Aware Interpretation',
          description: 'Interpret measurement analysis results considering Genelec GLM\'s capabilities and limitations. Explains what GLM can address, what requires physical solutions, and provides calibration-aware recommendations.',
          inputSchema: zodToJsonSchema(GLMInterpretInputSchema)
        },
        {
          name: 'rew_average_measurements',
          title: 'Average Measurements',
          description: 'Create a spatial average from multiple measurement positions. Implements REW\'s averaging methods: RMS (incoherent, recommended for spatial averaging), Vector (coherent, requires phase data), or hybrid methods. Useful for multi-position room calibration.',
          inputSchema: zodToJsonSchema(AveragingInputSchema)
        },
        {
          name: 'rew_analyze_room',
          title: 'Unified Room Analysis',
          description: 'Comprehensive room analysis combining peaks/nulls, room modes, sub integration, and L/R symmetry. Returns top 5 prioritized recommendations based on fixability-first scoring (60% fixability + 40% severity). Automatically handles missing optional inputs.',
          inputSchema: zodToJsonSchema(AnalyzeRoomInputSchema)
        },
        {
          name: 'rew_api_connect',
          title: 'Connect to REW API',
          description: 'Connect to a running REW instance\'s REST API. REW must be launched with -api flag or have API enabled in preferences. Default port is 4735. Returns the REW application version (rew_version, e.g. "5.40 Beta 130"), the REST API version (api_version, e.g. "0.9.5"), a compatibility flag (api_version_supported) with an optional compatibility_warning when the REW API version differs from the one this client was verified against, the number of available measurements, and capability flags.',
          inputSchema: zodToJsonSchema(ApiConnectInputSchema)
        },
        {
          name: 'rew_api_list_measurements',
          title: 'List REW Measurements',
          description: 'List all measurements available in the connected REW instance. Requires prior connection via rew_api_connect.',
          inputSchema: zodToJsonSchema(ApiListMeasurementsInputSchema)
        },
        {
          name: 'rew_api_get_measurement',
          title: 'Get REW Measurement',
          description: 'Fetch a measurement directly from REW via API. Use UUID (not index) to identify measurements, as indices shift when measurements are added/removed.',
          inputSchema: zodToJsonSchema(ApiGetMeasurementInputSchema)
        },
        {
          name: 'rew_compare_to_target',
          title: 'Compare to Target Curve',
          description: 'Compare a measurement against a target response curve. Supports flat, REW room curve (LF rise + HF fall), Harman curve, or custom curves. Provides deviation statistics and recommendations.',
          inputSchema: zodToJsonSchema(TargetCompareInputSchema)
        },
        // Remote measurement tools
        {
          name: 'rew_api_measure',
          title: 'Control REW Measurements',
          description: 'Control REW measurements via API. Actions: status (get config), sweep (trigger measurement), spl (SPL measurement), cancel, configure. status reports level_db (dBFS) and sweep_start_hz/sweep_end_hz plus sweep_length as a REW length string ("64k".."4M"); configure accepts the same. IMPORTANT: API-triggered measurements (sweep, spl) require a REW Pro licence. Without Pro, REW returns HTTP 401 and these actions return pro_license_required:true with a message instructing the user to run the measurement manually in REW\'s Measure dialog and then tell the assistant to continue — relay that guidance and resume once the new measurement exists.',
          inputSchema: zodToJsonSchema(ApiMeasureInputSchema)
        },
        {
          name: 'rew_api_audio',
          title: 'Configure REW Audio',
          description: 'Configure REW audio devices via API. Actions: status, list_devices, set_input, set_output, set_sample_rate. Use to select measurement mic and output device.',
          inputSchema: zodToJsonSchema(ApiAudioInputSchema)
        },
        {
          name: 'rew_api_generator',
          title: 'Control REW Signal Generator',
          description: 'Control REW signal generator via API. Generate test tones, pink noise, sweeps. Actions: status, start, stop, set_signal, set_level, set_frequency, list_signals. set_signal expects a valid REW signal name from list_signals (e.g. "pinknoise", "logsweep", "sine") — not a display string like "Pink noise".',
          inputSchema: zodToJsonSchema(ApiGeneratorInputSchema)
        },
        {
          name: 'rew_api_spl_meter',
          title: 'Control REW SPL Meter',
          description: 'Control REW SPL meter via API for live level monitoring. Supports A/C/Z frequency weighting and Fast/Slow time weighting. Actions: start, stop, read, configure, list_meters. read returns spl/leq/sel plus the meter\'s splWeighting and filter; list_meters discovers meters by probing (REW has no meter-list endpoint).',
          inputSchema: zodToJsonSchema(ApiSPLMeterInputSchema)
        },
        {
          name: 'rew_api_measure_workflow',
          title: 'REW Measurement Workflow',
          description: 'Complete measurement workflow orchestration. Actions: setup (auto-configure devices), check_levels (verify signal chain), calibrate_level (target SPL), measure (single sweep), measure_sequence (L/R or multi-position). Handles device selection, blocking mode, and result retrieval automatically. Note: Sweep measurements require REW Pro license.',
          inputSchema: zodToJsonSchema(ApiMeasureWorkflowInputSchema)
        },
        {
          name: 'rew_api_calibrate_spl',
          title: 'Calibrate Monitor SPL',
          description: 'Semi-automated monitor level calibration workflow. Actions: start (play pink noise + start SPL meter), check (read current SPL + get adjustment guidance), stop (end calibration). Guides user to target SPL (default: 85 dB broadcast reference) with configurable tolerance.',
          inputSchema: zodToJsonSchema(ApiCalibrateSPLInputSchema)
        },
        {
          name: 'rew_api_check_levels',
          title: 'Check REW Input Levels',
          description: 'Check input levels for mic gain calibration. Reads RMS/peak dBFS and provides zone-based feedback (Clipping, Hot, Optimal, Low, Very Low) with adjustment guidance. Blocks measurement for clipping or very low conditions.',
          inputSchema: zodToJsonSchema(ApiCheckLevelsInputSchema)
        },
        {
          name: 'rew_api_measurement_session',
          title: 'Measurement Session Workflow',
          description: 'Guided L/R/Sub measurement workflow with session state. Actions: start_session (create new), measure (trigger measurement), get_status (check progress), stop_session (end). Sessions persist across tool calls and can be resumed. REW Pro license required for automated measurements.',
          inputSchema: zodToJsonSchema(ApiMeasurementSessionInputSchema)
        },
        {
          name: 'rew_optimize_room',
          title: 'Room Optimization Guidance',
          description: 'Get placement recommendations, validate adjustments, and track optimization progress. Actions: get_recommendation (next issue to fix), validate_adjustment (check if change helped), check_progress (overall status toward +-3dB target). One recommendation at a time for scientific approach.',
          inputSchema: zodToJsonSchema(OptimizeRoomInputSchema)
        },
        {
          name: 'rew_api_measurement_commands',
          title: 'Measurement Commands',
          description: 'Execute per-measurement commands via API. Actions: list_commands (get available commands for a measurement), execute (run a command on a measurement).',
          inputSchema: zodToJsonSchema(ApiMeasurementCommandsInputSchema)
        },
        {
          name: 'rew_api_measurement_eq',
          title: 'Measurement EQ',
          description: 'Manage per-measurement EQ settings via API. Actions: get_equaliser, set_equaliser, get_filters, set_filters, get_target, set_target, predicted_response, filter_response, match_target.',
          inputSchema: zodToJsonSchema(ApiMeasurementEQInputSchema)
        },
        {
          name: 'rew_api_import',
          title: 'Import Measurements',
          description: 'Import measurement data into REW via API. Actions: frequency_response_file, frequency_response_data, impulse_response_file, impulse_response_data, rta_file, sweep_recording.',
          inputSchema: zodToJsonSchema(ApiImportInputSchema)
        },
        {
          name: 'rew_api_eq',
          title: 'EQ Management',
          description: 'Manage global EQ defaults and settings via API. Actions: list_equalisers, list_manufacturers, get_defaults, set_defaults, get_house_curve, set_house_curve. get_defaults returns a composite object { equaliser {manufacturer, model}, targetSettings, targetLevel (dB SPL), roomCurveSettings } aggregated from the four REW default-* endpoints; set_defaults accepts the same object and only updates the keys you provide.',
          inputSchema: zodToJsonSchema(ApiEQInputSchema)
        },
        {
          name: 'rew_api_groups',
          title: 'Measurement Groups',
          description: 'Manage measurement groups via API. Actions: list, create, get, update, delete, list_measurements, add_measurement, remove_measurement. add_measurement moves a measurement into a group (membership is singular, so it leaves any previous group). remove_measurement leaves the measurement ungrouped; REW has no direct remove endpoint, so it is emulated by moving the measurement into a throwaway group and deleting that group.',
          inputSchema: zodToJsonSchema(ApiGroupsInputSchema)
        },
        {
          name: 'rew_api_rta',
          title: 'Real-Time Analyzer',
          description: 'Control REW Real-Time Analyzer via API. Actions: start, stop, capture, reset, configure, read_levels, read_captured, read_captured_peak, read_distortion. read_captured/read_captured_peak return decoded arrays { frequencies_hz, magnitude_db, phase_degrees?, unit, smoothing } (base64 float32 decoded); when RTA has no snapshot the response carries a message and empty arrays.',
          inputSchema: zodToJsonSchema(ApiRTAInputSchema)
        }
      ]
    };
  });

  // Call tool handler
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    
    try {
      let result;
      
      switch (name) {
        case 'rew_ingest_measurement':
          result = await executeIngest(args as any);
          break;
          
        case 'rew_compare_measurements':
          result = await executeCompare(args as any);
          break;
          
        case 'rew_analyze_room_modes':
          result = await executeRoomModes(args as any);
          break;
          
        case 'rew_analyze_decay':
          result = await executeDecay(args as any);
          break;
          
        case 'rew_analyze_impulse':
          result = await executeImpulse(args as any);
          break;
          
        case 'rew_interpret_with_glm_context':
          result = await executeGLMInterpret(args as any);
          break;
          
        case 'rew_average_measurements':
          result = await executeAveraging(args as any);
          break;
          
        case 'rew_api_connect':
          result = await executeApiConnect(args as any);
          break;
          
        case 'rew_api_list_measurements':
          result = await executeApiListMeasurements(args as any);
          break;
          
        case 'rew_api_get_measurement':
          result = await executeApiGetMeasurement(args as any);
          break;
          
        case 'rew_compare_to_target':
          result = await executeTargetCompare(args as any);
          break;
          
        case 'rew_api_measure':
          result = await executeApiMeasure(args as any);
          break;
          
        case 'rew_api_audio':
          result = await executeApiAudio(args as any);
          break;
          
        case 'rew_api_generator':
          result = await executeApiGenerator(args as any);
          break;
          
        case 'rew_api_spl_meter':
          result = await executeApiSPLMeter(args as any);
          break;
          
        case 'rew_api_measure_workflow':
          result = await executeApiMeasureWorkflow(args as any);
          break;

        case 'rew_api_calibrate_spl':
          result = await executeApiCalibrateSPL(args as any);
          break;

        case 'rew_api_check_levels':
          result = await executeApiCheckLevels(args as any);
          break;

        case 'rew_api_measurement_session':
          result = await executeApiMeasurementSession(args as any);
          break;

        case 'rew_analyze_room':
          result = await executeAnalyzeRoom(args as any);
          break;

        case 'rew_optimize_room':
          result = await executeOptimizeRoom(args as any);
          break;

        case 'rew_api_measurement_commands':
          result = await executeApiMeasurementCommands(args as any);
          break;

        case 'rew_api_measurement_eq':
          result = await executeApiMeasurementEQ(args as any);
          break;

        case 'rew_api_import':
          result = await executeApiImport(args as any);
          break;

        case 'rew_api_eq':
          result = await executeApiEQ(args as any);
          break;

        case 'rew_api_groups':
          result = await executeApiGroups(args as any);
          break;

        case 'rew_api_rta':
          result = await executeApiRTA(args as any);
          break;

        default:
          // Per MCP spec: Protocol errors (unknown tool) should throw Error
          // to be handled as JSON-RPC error, not tool execution error
          throw new Error(`Unknown tool: ${name}`)
      }
      
      // Format response per MCP specification
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(result.status === 'success' ? result.data : result)
        }],
        isError: result.status === 'error'
      };
      
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            status: 'error',
            error_type: 'internal_error',
            message: error instanceof Error ? error.message : 'Unknown error occurred'
          })
        }],
        isError: true
      };
    }
  });
}
