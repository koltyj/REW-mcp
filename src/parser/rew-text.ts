/**
 * REW Text Export Parser
 * 
 * Parses Room EQ Wizard frequency response and impulse response text exports.
 * Based on the specification in docs/file-formats.md
 */

import type {
  FrequencyResponseData,
  ImpulseResponseData,
  ParsedFileMetadata,
  DataQuality,
  DataQualityWarning,
  ConfidenceLevel
} from '../types/index.js';

export interface ParseResult {
  frequency_response: FrequencyResponseData;
  impulse_response?: ImpulseResponseData;
  parsed_metadata: ParsedFileMetadata;
  data_quality: DataQuality;
}

/**
 * Detect the format of a REW export file
 */
export function detectFormat(content: string): 'frequency_response' | 'impulse_response' | 'unknown' {
  const lines = content.split('\n').slice(0, 20);
  
  for (const line of lines) {
    const lower = line.toLowerCase();
    if (lower.includes('freq') && (lower.includes('spl') || lower.includes('db'))) {
      return 'frequency_response';
    }
    if (lower.includes('time') && lower.includes('value')) {
      return 'impulse_response';
    }
  }
  
  // Check data pattern - frequency response has increasing frequencies
  const dataLines = content.split('\n').filter(l => !l.startsWith('*') && l.trim());
  if (dataLines.length > 2) {
    const values = dataLines.slice(0, 3).map(l => parseFloat(l.split(/[\s,\t]+/)[0]));
    if (values.every(v => !isNaN(v)) && values[0] < values[1] && values[1] < values[2]) {
      if (values[0] > 1) return 'frequency_response'; // Frequencies are typically > 1 Hz
      if (values[0] < 0.1) return 'impulse_response'; // Time values typically start near 0
    }
  }
  
  return 'unknown';
}

/**
 * Parse metadata from comment lines
 */
function parseMetadata(content: string): ParsedFileMetadata {
  const metadata: ParsedFileMetadata = {};
  const lines = content.split('\n');
  
  for (const line of lines) {
    if (!line.startsWith('*')) continue;
    
    const cleanLine = line.replace(/^\*\s*/, '').trim();
    
    // REW version (case insensitive for V/v)
    if (cleanLine.toLowerCase().includes('rew') && cleanLine.toLowerCase().includes('v')) {
      const match = cleanLine.match(/REW\s*[Vv]?([\d.]+)/i);
      if (match) metadata.rew_version = match[1];
    }
    
    // Measurement name
    if (cleanLine.toLowerCase().startsWith('measurement:') || 
        cleanLine.toLowerCase().startsWith('title:') ||
        cleanLine.toLowerCase().startsWith('name:')) {
      metadata.measurement_name = cleanLine.split(':').slice(1).join(':').trim();
    }
    
    // Date
    if (cleanLine.toLowerCase().includes('date:') || cleanLine.match(/\d{4}[-/]\d{2}[-/]\d{2}/)) {
      const dateMatch = cleanLine.match(/(\d{4}[-/]\d{2}[-/]\d{2})/);
      if (dateMatch) {
        metadata.export_date = dateMatch[1].replace(/\//g, '-');
      }
    }
    
    // Source description (typically the first comment line)
    if (!metadata.source_description && cleanLine.length > 5) {
      metadata.source_description = cleanLine;
    }
  }
  
  return metadata;
}

/**
 * Parse a number handling both period and comma decimal separators
 */
function parseNumber(value: string): number {
  // Handle both 1.234 and 1,234 (European) formats
  // Check if there's a comma that could be decimal separator
  const cleaned = value.trim();
  
  // If contains both . and ,, likely thousands separator situation
  if (cleaned.includes('.') && cleaned.includes(',')) {
    // Assume comma is decimal (European)
    return parseFloat(cleaned.replace(/\./g, '').replace(',', '.'));
  }
  
  // If only comma, assume it's decimal
  if (cleaned.includes(',') && !cleaned.includes('.')) {
    return parseFloat(cleaned.replace(',', '.'));
  }
  
  return parseFloat(cleaned);
}

/**
 * Parse frequency response text export
 */
export function parseFrequencyResponse(content: string): ParseResult {
  const warnings: DataQualityWarning[] = [];
  const frequencies: number[] = [];
  const spl: number[] = [];
  const phase: number[] = [];
  
  const lines = content.split('\n');
  let hasPhase = false;
  
  // Detect column structure from header
  for (const line of lines) {
    if (line.startsWith('*') && line.toLowerCase().includes('phase')) {
      hasPhase = true;
      break;
    }
  }
  
  // Parse data lines
  for (const line of lines) {
    // Skip comment lines and empty lines
    if (line.startsWith('*') || !line.trim()) continue;
    
    // Split by tab first, otherwise by whitespace
    const trimmed = line.trim();
    const parts = trimmed.includes('\t') 
      ? trimmed.split(/\t+/) 
      : trimmed.split(/\s+/);
    
    if (parts.length >= 2) {
      const freq = parseNumber(parts[0]);
      const splVal = parseNumber(parts[1]);
      const phaseVal = parts.length >= 3 ? parseNumber(parts[2]) : 0;
      
      // Validate values
      if (isNaN(freq) || isNaN(splVal)) continue;
      
      // Basic sanity checks
      if (freq < 0.1 || freq > 100000) continue;
      if (splVal < -100 || splVal > 200) continue;
      
      frequencies.push(freq);
      spl.push(splVal);
      phase.push(isNaN(phaseVal) ? 0 : phaseVal);
    }
  }
  
  // Validate data quality
  let confidence: ConfidenceLevel = 'high';
  
  if (frequencies.length < 10) {
    warnings.push({
      type: 'insufficient_data',
      message: `Only ${frequencies.length} data points found`,
      severity: 'error'
    });
    confidence = 'low';
  } else if (frequencies.length < 100) {
    warnings.push({
      type: 'low_resolution',
      message: `Only ${frequencies.length} data points - consider higher resolution export`,
      severity: 'warning'
    });
    confidence = 'medium';
  }
  
  // Check frequency range
  if (frequencies.length > 0) {
    const minFreq = frequencies[0];
    const maxFreq = frequencies[frequencies.length - 1];
    
    if (minFreq > 50) {
      warnings.push({
        type: 'limited_bass_range',
        message: `Data starts at ${minFreq.toFixed(1)} Hz - bass analysis may be limited`,
        severity: 'warning'
      });
    }
    
    if (maxFreq < 10000) {
      warnings.push({
        type: 'limited_treble_range',
        message: `Data ends at ${maxFreq.toFixed(1)} Hz - treble analysis may be limited`,
        severity: 'info'
      });
    }
  }
  
  // Check for monotonic frequencies
  for (let i = 1; i < frequencies.length; i++) {
    if (frequencies[i] <= frequencies[i - 1]) {
      warnings.push({
        type: 'non_monotonic',
        message: 'Frequency values are not strictly increasing',
        severity: 'error'
      });
      confidence = 'low';
      break;
    }
  }
  
  // Check phase data quality
  if (hasPhase && phase.every(p => p === 0)) {
    warnings.push({
      type: 'missing_phase',
      message: 'Phase data appears to be missing or zero',
      severity: 'info'
    });
  }
  
  return {
    frequency_response: {
      frequencies_hz: frequencies,
      spl_db: spl,
      phase_degrees: phase
    },
    parsed_metadata: parseMetadata(content),
    data_quality: {
      confidence,
      warnings
    }
  };
}

/**
 * Parse impulse response text export
 */
export function parseImpulseResponse(content: string): {
  impulse_response: ImpulseResponseData;
  parsed_metadata: ParsedFileMetadata;
  data_quality: DataQuality;
} {
  const warnings: DataQualityWarning[] = [];
  const times: number[] = [];
  const samples: number[] = [];
  
  const lines = content.split('\n');
  
  // Parse data lines
  for (const line of lines) {
    if (line.startsWith('*') || !line.trim()) continue;
    
    const parts = line.trim().split(/[\s,\t]+/);
    
    if (parts.length >= 2) {
      const time = parseNumber(parts[0]);
      const value = parseNumber(parts[1]);
      
      if (isNaN(time) || isNaN(value)) continue;
      
      times.push(time);
      samples.push(value);
    }
  }
  
  // Calculate sample rate from time values
  let sample_rate_hz = 48000; // Default
  if (times.length >= 2) {
    const timeDiff = times[1] - times[0];
    if (timeDiff > 0) {
      sample_rate_hz = Math.round(1 / timeDiff);
    }
  }
  
  // Find peak
  let peak_index = 0;
  let maxAbs = 0;
  for (let i = 0; i < samples.length; i++) {
    const abs = Math.abs(samples[i]);
    if (abs > maxAbs) {
      maxAbs = abs;
      peak_index = i;
    }
  }
  
  // Normalize samples
  const normalizedSamples = maxAbs > 0 
    ? samples.map(s => s / maxAbs)
    : samples;
  
  let confidence: ConfidenceLevel = 'high';
  
  if (samples.length < 1000) {
    warnings.push({
      type: 'short_ir',
      message: `Impulse response is short (${samples.length} samples)`,
      severity: 'warning'
    });
    confidence = 'medium';
  }
  
  return {
    impulse_response: {
      samples: normalizedSamples,
      sample_rate_hz,
      peak_index,
      start_time_s: times[0] || 0,
      duration_s: times.length > 0 ? times[times.length - 1] - times[0] : 0
    },
    parsed_metadata: parseMetadata(content),
    data_quality: {
      confidence,
      warnings
    }
  };
}

/**
 * Main parse function - auto-detects format
 */
export function parseREWExport(content: string): ParseResult {
  const format = detectFormat(content);
  
  if (format === 'frequency_response') {
    return parseFrequencyResponse(content);
  }
  
  if (format === 'impulse_response') {
    const irResult = parseImpulseResponse(content);
    
    // For IR-only exports, we don't have frequency response
    // Return empty FR with the IR data
    return {
      frequency_response: {
        frequencies_hz: [],
        spl_db: [],
        phase_degrees: []
      },
      impulse_response: irResult.impulse_response,
      parsed_metadata: irResult.parsed_metadata,
      data_quality: irResult.data_quality
    };
  }
  
  // Unknown format - try frequency response parsing as fallback
  const result = parseFrequencyResponse(content);
  result.data_quality.warnings.push({
    type: 'unknown_format',
    message: 'Could not detect file format - parsed as frequency response',
    severity: 'warning'
  });
  result.data_quality.confidence = 'low';
  
  return result;
}
