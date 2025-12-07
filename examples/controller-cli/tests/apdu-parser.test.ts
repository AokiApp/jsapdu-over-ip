/**
 * Unit Tests for APDU Parser
 * 
 * Tests all APDU cases as per ISO 7816-4:
 * - Case 1: CLA INS P1 P2
 * - Case 2: CLA INS P1 P2 Le
 * - Case 3: CLA INS P1 P2 Lc Data
 * - Case 4: CLA INS P1 P2 Lc Data Le
 */

import { describe, test, expect } from 'vitest';
import { parseApduHex, formatApduForDisplay } from '../src/apdu-parser.js';

describe('parseApduHex', () => {
  describe('正常系 (Normal Cases)', () => {
    test('Case 1: Simple APDU with no data or Le (4 bytes)', () => {
      const result = parseApduHex('00A40400');
      
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.cla).toBe(0x00);
        expect(result.ins).toBe(0xA4);
        expect(result.p1).toBe(0x04);
        expect(result.p2).toBe(0x00);
        expect(result.data).toBeNull();
        expect(result.le).toBeNull();
      }
    });

    test('Case 2: APDU with Le only (5 bytes)', () => {
      const result = parseApduHex('00A4040000');
      
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.cla).toBe(0x00);
        expect(result.ins).toBe(0xA4);
        expect(result.p1).toBe(0x04);
        expect(result.p2).toBe(0x00);
        expect(result.data).toBeNull();
        expect(result.le).toBe(0x00);
      }
    });

    test('Case 3: APDU with data but no Le', () => {
      // 00 A4 04 00 0C [12 bytes data]
      //               A0 00 00 06 3F 00 00 01 01 01 01 00
      const result = parseApduHex('00A404000CA00000063F00000101010100');
      
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.cla).toBe(0x00);
        expect(result.ins).toBe(0xA4);
        expect(result.p1).toBe(0x04);
        expect(result.p2).toBe(0x00);
        expect(result.data?.length).toBe(12);
        expect(result.le).toBeNull();
      }
    });

    test('Case 4: APDU with data and Le', () => {
      // 00 A4 04 00 0C [12 bytes data] 00
      //               A0 00 00 06 3F 00 00 01 01 01 01 00
      const result = parseApduHex('00A404000CA00000063F0000010101010000');
      
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.cla).toBe(0x00);
        expect(result.ins).toBe(0xA4);
        expect(result.p1).toBe(0x04);
        expect(result.p2).toBe(0x00);
        expect(result.data?.length).toBe(12);
        expect(result.le).toBe(0x00);
      }
    });

    test('Handles whitespace in hex string', () => {
      const result = parseApduHex('00 A4 04 00');
      
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.cla).toBe(0x00);
        expect(result.ins).toBe(0xA4);
      }
    });

    test('Handles lowercase hex', () => {
      const result = parseApduHex('00a40400');
      
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.ins).toBe(0xA4);
      }
    });
  });

  describe('異常系 (Error Cases)', () => {
    test('Rejects non-hex characters', () => {
      const result = parseApduHex('00G40400');
      
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('hex characters');
      }
    });

    test('Rejects odd length hex string', () => {
      const result = parseApduHex('00A40400A'); // 9 chars
      
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('even length');
      }
    });

    test('Rejects too short APDU (< 4 bytes)', () => {
      const result = parseApduHex('00A404');
      
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('at least 4 bytes');
      }
    });

    test('Rejects APDU with mismatched Lc', () => {
      const result = parseApduHex('00A404000CAA'); // Lc=12 but only 1 byte of data
      
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('Lc indicates');
      }
    });

    test('Rejects empty string', () => {
      const result = parseApduHex('');
      
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeDefined();
      }
    });
  });

  describe('エッジケース (Edge Cases)', () => {
    test('Maximum length data (255 bytes)', () => {
      const dataBytes = Array(255).fill(0xFF).map((v, i) => i.toString(16).padStart(2, '0')).join('');
      const apduHex = `00A40400FF${dataBytes}`;
      
      const result = parseApduHex(apduHex);
      
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data?.length).toBe(255);
      }
    });

    test('Data with all zeros', () => {
      const result = parseApduHex('00A4040003000000');
      
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(new Uint8Array([0x00, 0x00, 0x00]));
      }
    });

    test('Data with all FFs', () => {
      const result = parseApduHex('00A4040003FFFFFF');
      
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(new Uint8Array([0xFF, 0xFF, 0xFF]));
      }
    });

    test('Le = 0 means expecting 256 bytes', () => {
      const result = parseApduHex('00B0000000');
      
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.le).toBe(0x00);
      }
    });
  });
});

describe('formatApduForDisplay', () => {
  test('Formats Case 1 APDU correctly', () => {
    const result = parseApduHex('00A40400');
    expect(result.success).toBe(true);
    
    if (result.success) {
      const formatted = formatApduForDisplay(result);
      expect(formatted).toContain('CLA: 0x00');
      expect(formatted).toContain('INS: 0xa4');
      expect(formatted).toContain('P1:  0x04');
      expect(formatted).toContain('P2:  0x00');
      expect(formatted).not.toContain('Data:');
      expect(formatted).not.toContain('Le:');
    }
  });

  test('Formats Case 4 APDU with data and Le', () => {
    const result = parseApduHex('00A4040003AABBCC00');
    expect(result.success).toBe(true);
    
    if (result.success) {
      const formatted = formatApduForDisplay(result);
      expect(formatted).toContain('Data: aa bb cc');
      expect(formatted).toContain('Le:   0x00');
    }
  });
});
