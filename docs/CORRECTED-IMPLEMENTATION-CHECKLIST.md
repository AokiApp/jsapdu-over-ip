# CORRECTED Implementation Checklist

## ⚠️ CRITICAL CORRECTION

**Previous implementation was COMPLETELY WRONG.**

The cardhost and controller were reimplementing RPC instead of using the jsapdu-over-ip library. All that code must be DELETED and replaced with proper library usage.

## Correct Approach

### Cardhost Must:
1. ✅ Use `SmartCardPlatformAdapter` from `@aokiapp/jsapdu-over-ip/server`
2. ✅ Implement `ServerTransport` for router communication only
3. ✅ Wrap actual `SmartCardPlatform` (PC/SC or mock)
4. ❌ NOT implement RPC handling
5. ❌ NOT manually dispatch methods

### Controller Must:
1. ✅ Use `RemoteSmartCardPlatform` from `@aokiapp/jsapdu-over-ip/client`
2. ✅ Implement `ClientTransport` for router communication only  
3. ✅ Use `CommandApdu`/`ResponseApdu` from jsapdu-interface
4. ❌ NOT create custom RPC types
5. ❌ NOT manually handle APDU serialization

## Files to DELETE

### From Cardhost:
- ❌ `src/cardhost-service.ts` - WRONG, reimplements RPC
- ❌ `src/router-client.ts` - WRONG, should be ServerTransport
- Parts of `src/index.ts` - Must use adapter

### From Controller:
- ❌ `src/websocket-client.ts` - WRONG, should be ClientTransport
- ❌ `src/api-client.ts` - Partially OK (REST API is separate)
- Parts of `src/app.ts` - Must use RemoteSmartCardPlatform

## Correct Implementation Checklist

### Phase 1: Fix Shared Types ✅
- [x] Keep protocol.ts but note it's for router messages, NOT RPC
- [x] RPC types come from jsapdu-over-ip library

### Phase 2: Fix Cardhost 🔄

#### Keep These Files:
- [x] `src/config.ts` - Configuration management (OK)
- [x] `src/crypto.ts` - Authentication helpers (OK)
- [x] `src/mock-platform.ts` - Mock SmartCardPlatform implementation (OK)
- [x] `src/monitor/` - Monitoring UI (OK, separate concern)

#### DELETE and Replace:
- [ ] DELETE `src/cardhost-service.ts` completely
- [ ] DELETE `src/router-client.ts` completely

#### CREATE New Files:
- [ ] `src/router-transport.ts` - Implements ServerTransport
  ```typescript
  import type { ServerTransport, RpcRequest, RpcResponse } from '@aokiapp/jsapdu-over-ip';
  
  export class RouterServerTransport implements ServerTransport {
    private requestHandler?: (req: RpcRequest) => Promise<RpcResponse>;
    
    onRequest(handler: (req: RpcRequest) => Promise<RpcResponse>): void {
      this.requestHandler = handler;
    }
    
    emitEvent(event: RpcEvent): void {
      // Send to router
    }
    
    async start(): Promise<void> {
      // Connect to router, authenticate
    }
    
    async stop(): Promise<void> {
      // Disconnect
    }
  }
  ```

#### REWRITE index.ts:
- [ ] Import `SmartCardPlatformAdapter` from library
- [ ] Create `RouterServerTransport`
- [ ] Create adapter with actual platform + transport
- [ ] Start adapter - that's it!

```typescript
import { SmartCardPlatformAdapter } from '@aokiapp/jsapdu-over-ip/server';
import { MockPlatform } from './mock-platform.js';
import { RouterServerTransport } from './router-transport.js';

async function main() {
  const config = await loadConfig();
  
  // Actual platform
  const platform = new MockPlatform(); // or PcscPlatform
  
  // Custom transport
  const transport = new RouterServerTransport(config);
  
  // USE LIBRARY - IT HANDLES EVERYTHING
  const adapter = new SmartCardPlatformAdapter(platform, transport);
  await adapter.start();
  
  console.log('Cardhost running - adapter handles all RPC!');
}
```

### Phase 3: Fix Controller 🔄

#### Keep These Files:
- [x] `src/crypto.ts` - Authentication helpers (OK)
- [x] `public/index.html` - UI (OK)
- [x] `public/styles.css` - Styles (OK)
- [x] `vite.config.ts` - Build config (OK)

#### DELETE and Replace:
- [ ] DELETE `src/websocket-client.ts` completely
- [ ] Rewrite `src/api-client.ts` (REST API part OK, but separate from platform)

#### CREATE New Files:
- [ ] `src/router-transport.ts` - Implements ClientTransport
  ```typescript
  import type { ClientTransport, RpcRequest, RpcResponse } from '@aokiapp/jsapdu-over-ip';
  
  export class RouterClientTransport implements ClientTransport {
    async call(request: RpcRequest): Promise<RpcResponse> {
      // Send to router, wait for response
    }
    
    onEvent?(callback: (event: RpcEvent) => void): () => void {
      // Subscribe to events
    }
    
    async close?(): Promise<void> {
      // Disconnect
    }
  }
  ```

#### REWRITE app.ts:
- [ ] Import `RemoteSmartCardPlatform` from library
- [ ] Import `CommandApdu`, `ResponseApdu` from jsapdu-interface
- [ ] Create `RouterClientTransport`
- [ ] Create `RemoteSmartCardPlatform` with transport
- [ ] Use jsapdu-interface methods only!

```typescript
import { RemoteSmartCardPlatform } from '@aokiapp/jsapdu-over-ip/client';
import { CommandApdu, ResponseApdu } from '@aokiapp/jsapdu-interface';
import { RouterClientTransport } from './router-transport.js';

export class ControllerApp {
  private platform: RemoteSmartCardPlatform | null = null;
  
  async connect(cardhostUuid: string) {
    // Custom transport
    const transport = new RouterClientTransport({
      routerUrl: this.routerUrl,
      targetCardhostUuid: cardhostUuid,
    });
    
    // USE LIBRARY - IT HANDLES EVERYTHING
    this.platform = new RemoteSmartCardPlatform(transport);
    await this.platform.init();
    
    console.log('Connected - platform handles all RPC!');
  }
  
  async sendApdu(cla: number, ins: number, p1: number, p2: number, data: Uint8Array) {
    // Use jsapdu-interface types!
    const command = new CommandApdu(cla, ins, p1, p2, data);
    
    // Get device and card (jsapdu-interface methods)
    const devices = await this.platform!.getDeviceInfo();
    const device = await this.platform!.getDevice(devices[0].id);
    const card = await device.connect();
    
    // Transmit (jsapdu-interface method)
    const response = await card.transmit(command);
    
    // response is ResponseApdu from jsapdu-interface
    return {
      sw1: response.sw1,
      sw2: response.sw2,
      data: Array.from(response.data)
    };
  }
}
```

### Phase 4: Router Implementation (No Change Needed)

Router is message broker only:
- [ ] Routes RpcRequest/RpcResponse between endpoints
- [ ] Handles authentication
- [ ] Does NOT parse jsapdu methods
- [ ] Does NOT depend on jsapdu libraries

### Phase 5: Documentation Updates

- [x] Architecture document rewritten
- [x] Cardhost document rewritten  
- [x] Controller document rewritten
- [ ] Update implementation checklist (this file)
- [ ] Update examples README
- [ ] Create new session notes explaining the correction

### Phase 6: Testing

- [ ] Test cardhost with mock platform
- [ ] Verify adapter receives RPC correctly
- [ ] Test controller with RemoteSmartCardPlatform
- [ ] Verify CommandApdu/ResponseApdu work correctly
- [ ] Test end-to-end with router

## Critical Success Factors

### Cardhost Success Criteria:
✅ Uses `SmartCardPlatformAdapter` from library
✅ Implements `ServerTransport` only
✅ Does NOT have RPC dispatch code
✅ Does NOT manually handle jsapdu methods

### Controller Success Criteria:
✅ Uses `RemoteSmartCardPlatform` from library
✅ Uses `CommandApdu`/`ResponseApdu` from jsapdu-interface
✅ Implements `ClientTransport` only
✅ Does NOT have custom RPC types
✅ Does NOT manually serialize APDU

## Next Session Priority

1. **DELETE wrong code** (30 min)
2. **Implement RouterServerTransport** (30 min)
3. **Implement RouterClientTransport** (30 min)
4. **Rewrite cardhost index.ts** (15 min)
5. **Rewrite controller app.ts** (30 min)
6. **Test with mock platform** (30 min)
7. **Implement router** (90 min)
8. **End-to-end testing** (30 min)

**Total: 4-5 hours**

## Apology

I completely misunderstood the requirements and reimplemented what the library already provides. This was a waste of time. The correct approach is to USE the library, not reimplement it. I apologize for this error.
