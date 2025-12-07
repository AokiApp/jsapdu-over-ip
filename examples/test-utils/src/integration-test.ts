#!/usr/bin/env node
/**
 * Mock Platform Unit Test
 * 
 * ⚠️  WARNING: This is NOT a real integration test!
 * 
 * This only tests the mock platform in isolation and does NOT verify:
 * - jsapdu-over-ip library integration
 * - Router message routing
 * - Full system E2E communication
 * 
 * For real integration testing, use e2e-test.ts which tests:
 * CLI Controller → Router → Cardhost-mock → Mock Platform
 * 
 * This unit test verifies that MockSmartCardPlatform implements
 * the jsapdu-interface correctly, but that's all.
 */

import { MockSmartCardPlatform } from "./mock-platform.js";
import { CommandApdu } from "@aokiapp/jsapdu-interface";
import type { SmartCardDeviceInfo } from "@aokiapp/jsapdu-interface";

async function testMockPlatform() {
  console.log("=== Mock Platform Unit Test ===");
  console.log("⚠️  This is a UNIT test - not a real integration test\n");
  console.log("For E2E testing, use: npm run test:e2e\n");

  // 1. Initialize mock platform
  console.log("1️⃣  Initializing mock platform...");
  const platform = MockSmartCardPlatform.getInstance();
  await platform.init();
  console.log("✅ Platform initialized\n");

  // 2. Get devices
  console.log("2️⃣  Getting devices...");
  const devices = await platform.getDeviceInfo();
  console.log(`✅ Found ${devices.length} device(s):`);
  devices.forEach((dev: SmartCardDeviceInfo) => {
    console.log(`   - ${dev.friendlyName || dev.id}`);
    console.log(`     ID: ${dev.id}`);
    console.log(`     Supports APDU: ${dev.supportsApdu}`);
  });
  console.log();

  // 3. Acquire device
  console.log("3️⃣  Acquiring device...");
  const device = await platform.acquireDevice(devices[0].id);
  console.log("✅ Device acquired\n");

  // 4. Check card presence
  console.log("4️⃣  Checking card presence...");
  const present = await device.isCardPresent();
  console.log(`✅ Card present: ${present}\n`);

  // 5. Start card session
  console.log("5️⃣  Starting card session...");
  const card = await device.startSession();
  console.log("✅ Card session started\n");

  // 6. Get ATR
  console.log("6️⃣  Getting ATR...");
  const atr = await card.getAtr();
  const atrHex = Array.from(atr).map((b: number) => b.toString(16).padStart(2, '0')).join(' ');
  console.log(`✅ ATR: ${atrHex}\n`);

  // 7. Send SELECT APDU
  console.log("7️⃣  Sending SELECT APDU (00 A4 04 00)...");
  const selectApdu = new CommandApdu(0x00, 0xa4, 0x04, 0x00, null, null);
  const selectResponse = await card.transmit(selectApdu);
  console.log(`✅ Response:`);
  if (selectResponse.data.length > 0) {
    const dataHex = Array.from(selectResponse.data).map((b: number) => b.toString(16).padStart(2, '0')).join(' ');
    console.log(`   Data: ${dataHex}`);
  }
  console.log(`   SW: ${selectResponse.sw1.toString(16).padStart(2, '0')} ${selectResponse.sw2.toString(16).padStart(2, '0')}`);
  console.log(`   Status: ${selectResponse.sw1 === 0x90 && selectResponse.sw2 === 0x00 ? '✅ Success' : '⚠️  Error'}\n`);

  // 8. Send GET DATA APDU
  console.log("8️⃣  Sending GET DATA APDU (00 CA 00 00)...");
  const getDataApdu = new CommandApdu(0x00, 0xca, 0x00, 0x00, null, null);
  const getDataResponse = await card.transmit(getDataApdu);
  console.log(`✅ Response:`);
  if (getDataResponse.data.length > 0) {
    const dataHex = Array.from(getDataResponse.data).map((b: number) => b.toString(16).padStart(2, '0')).join(' ');
    console.log(`   Data: ${dataHex}`);
  }
  console.log(`   SW: ${getDataResponse.sw1.toString(16).padStart(2, '0')} ${getDataResponse.sw2.toString(16).padStart(2, '0')}`);
  console.log(`   Status: ${getDataResponse.sw1 === 0x90 && getDataResponse.sw2 === 0x00 ? '✅ Success' : '⚠️  Error'}\n`);

  // 9. Send READ BINARY APDU
  console.log("9️⃣  Sending READ BINARY APDU (00 B0 00 00)...");
  const readBinaryApdu = new CommandApdu(0x00, 0xb0, 0x00, 0x00, null, 0x0c);
  const readResponse = await card.transmit(readBinaryApdu);
  console.log(`✅ Response:`);
  if (readResponse.data.length > 0) {
    const dataHex = Array.from(readResponse.data).map((b: number) => b.toString(16).padStart(2, '0')).join(' ');
    const dataAscii = Array.from(readResponse.data).map((b: number) => b >= 32 && b <= 126 ? String.fromCharCode(b) : '.').join('');
    console.log(`   Data (hex): ${dataHex}`);
    console.log(`   Data (ascii): "${dataAscii}"`);
  }
  console.log(`   SW: ${readResponse.sw1.toString(16).padStart(2, '0')} ${readResponse.sw2.toString(16).padStart(2, '0')}`);
  console.log(`   Status: ${readResponse.sw1 === 0x90 && readResponse.sw2 === 0x00 ? '✅ Success' : '⚠️  Error'}\n`);

  // 10. Cleanup
  console.log("🔟 Cleaning up...");
  await card.release();
  console.log("✅ Card session released");
  await device.release();
  console.log("✅ Device released");
  await platform.release();
  console.log("✅ Platform released\n");

  console.log("=== Mock Platform Unit Test Complete ===");
  console.log("\n📊 Summary:");
  console.log("   ✅ Platform initialization");
  console.log("   ✅ Device enumeration");
  console.log("   ✅ Device acquisition");
  console.log("   ✅ Card session management");
  console.log("   ✅ ATR retrieval");
  console.log("   ✅ APDU transmission (SELECT)");
  console.log("   ✅ APDU transmission (GET DATA)");
  console.log("   ✅ APDU transmission (READ BINARY)");
  console.log("   ✅ Proper cleanup");
  console.log("\n✅ Mock platform unit test passed!");
  console.log("\n⚠️  NOTE: This only tests the mock platform itself.");
  console.log("   For real integration testing of the full system:");
  console.log("   npm run test:e2e");
}

// Run the test
testMockPlatform().catch(error => {
  console.error("\n❌ Test failed:", error);
  process.exit(1);
});
