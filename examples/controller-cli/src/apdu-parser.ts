/**
 * APDU Parser - Extract and parse hex APDU strings
 * 
 * Separated from REPL logic for:
 * - Better testability
 * - Clearer separation of concerns
 * - Reusability
 */

import { CommandApdu } from "@aokiapp/jsapdu-interface";

export interface ApduParseResult {
  success: true;
  apdu: CommandApdu;
  cla: number;
  ins: number;
  p1: number;
  p2: number;
  data: Uint8Array | null;
  le: number | null;
}

export interface ApduParseError {
  success: false;
  error: string;
}

export type ApduParseOutput = ApduParseResult | ApduParseError;

/**
 * Parse a hex string into a CommandApdu
 * 
 * Supports all ISO 7816-4 APDU cases:
 * - Case 1: CLA INS P1 P2 (4 bytes)
 * - Case 2: CLA INS P1 P2 Le (5 bytes)
 * - Case 3: CLA INS P1 P2 Lc Data (5+ bytes)
 * - Case 4: CLA INS P1 P2 Lc Data Le (6+ bytes)
 * 
 * @param hexStr - Hex string (e.g., "00A4040000" or "00 A4 04 00 00")
 * @returns Parse result or error
 */
export function parseApduHex(hexStr: string): ApduParseOutput {
  // Remove whitespace and validate
  const cleanHex = hexStr.replace(/\s+/g, "");
  
  if (!/^[0-9a-fA-F]+$/.test(cleanHex)) {
    return {
      success: false,
      error: "Invalid hex string: must contain only hex characters (0-9, a-f, A-F)",
    };
  }
  
  if (cleanHex.length % 2 !== 0) {
    return {
      success: false,
      error: "Invalid hex string: must have even length (pairs of hex digits)",
    };
  }
  
  if (cleanHex.length < 8) {
    return {
      success: false,
      error: "Invalid APDU: must be at least 4 bytes (8 hex chars) for CLA INS P1 P2",
    };
  }

  // Parse hex string to bytes
  const matches = cleanHex.match(/.{1,2}/g);
  if (!matches) {
    return {
      success: false,
      error: "Failed to parse hex string into bytes",
    };
  }
  
  const bytes = new Uint8Array(matches.map(b => parseInt(b, 16)));
  
  // Parse APDU header (always 4 bytes)
  const cla = bytes[0];
  const ins = bytes[1];
  const p1 = bytes[2];
  const p2 = bytes[3];
  
  // Determine APDU case based on remaining bytes
  let data: Uint8Array | null = null;
  let le: number | null = null;
  
  if (bytes.length === 4) {
    // Case 1: No Lc, no Le
    data = null;
    le = null;
  } else if (bytes.length === 5) {
    // Case 2: Le only (expecting response)
    le = bytes[4];
    data = null;
  } else {
    // Case 3 or 4: Lc + data (+ optional Le)
    const lc = bytes[4];
    const expectedDataEnd = 5 + lc;
    
    if (bytes.length < expectedDataEnd) {
      return {
        success: false,
        error: `Invalid APDU: Lc indicates ${lc} bytes of data, but only ${bytes.length - 5} bytes available`,
      };
    }
    
    data = bytes.slice(5, expectedDataEnd);
    
    if (bytes.length > expectedDataEnd) {
      // Case 4: Has Le after data
      le = bytes[expectedDataEnd];
    }
  }

  try {
    const apdu = new CommandApdu(
      cla,
      ins,
      p1,
      p2,
      data as Uint8Array<ArrayBuffer> | null,
      le
    );
    
    return {
      success: true,
      apdu,
      cla,
      ins,
      p1,
      p2,
      data,
      le,
    };
  } catch (error) {
    const err = error as Error;
    return {
      success: false,
      error: `Failed to create CommandApdu: ${err.message}`,
    };
  }
}

/**
 * Format APDU components for display
 */
export function formatApduForDisplay(result: ApduParseResult): string {
  const lines: string[] = [];
  
  lines.push(`CLA: 0x${result.cla.toString(16).padStart(2, '0')}`);
  lines.push(`INS: 0x${result.ins.toString(16).padStart(2, '0')}`);
  lines.push(`P1:  0x${result.p1.toString(16).padStart(2, '0')}`);
  lines.push(`P2:  0x${result.p2.toString(16).padStart(2, '0')}`);
  
  if (result.data && result.data.length > 0) {
    const dataHex = Array.from(result.data)
      .map(b => b.toString(16).padStart(2, '0'))
      .join(' ');
    lines.push(`Data: ${dataHex}`);
  }
  
  if (result.le !== null) {
    lines.push(`Le:   0x${result.le.toString(16).padStart(2, '0')}`);
  }
  
  return lines.join('\n');
}
