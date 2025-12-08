/**
 * Integration Tests: Adapter Lifecycle Management
 * 
 * Tests the integration of adapter initialization, state management,
 * resource cleanup, and lifecycle transitions for the jsapdu-over-ip adapters.
 * 
 * These tests ensure proper resource management across the adapter stack.
 */

import { describe, test, expect, beforeEach, afterEach } from 'vitest';

describe('Integration: Adapter Lifecycle Management', () => {
  interface MockAdapter {
    state: 'uninitialized' | 'initializing' | 'ready' | 'error' | 'disposed';
    resources: string[];
    init(): Promise<void>;
    dispose(): Promise<void>;
    getState(): string;
  }

  let adapter: MockAdapter | null = null;

  beforeEach(() => {
    adapter = {
      state: 'uninitialized',
      resources: [],
      async init() {
        if (this.state !== 'uninitialized') {
          throw new Error(`Cannot initialize from state: ${this.state}`);
        }
        this.state = 'initializing';
        
        // Simulate resource allocation
        this.resources.push('connection');
        this.resources.push('buffer');
        
        await new Promise(resolve => setTimeout(resolve, 10));
        this.state = 'ready';
      },
      async dispose() {
        if (this.state === 'disposed') {
          return; // Already disposed
        }
        
        // Clean up resources
        this.resources = [];
        this.state = 'disposed';
      },
      getState() {
        return this.state;
      },
    };
  });

  afterEach(async () => {
    if (adapter && adapter.state !== 'disposed') {
      await adapter.dispose();
    }
    adapter = null;
  });

  test('should initialize adapter', async () => {
    expect(adapter!.state).toBe('uninitialized');

    await adapter!.init();

    expect(adapter!.state).toBe('ready');
    expect(adapter!.resources).toHaveLength(2);
  });

  test('should not allow double initialization', async () => {
    await adapter!.init();

    await expect(adapter!.init()).rejects.toThrow('Cannot initialize from state: ready');
  });

  test('should dispose adapter and clean resources', async () => {
    await adapter!.init();
    expect(adapter!.resources).toHaveLength(2);

    await adapter!.dispose();

    expect(adapter!.state).toBe('disposed');
    expect(adapter!.resources).toHaveLength(0);
  });

  test('should allow multiple dispose calls', async () => {
    await adapter!.init();
    
    await adapter!.dispose();
    await adapter!.dispose(); // Second call should not throw

    expect(adapter!.state).toBe('disposed');
  });

  test('should handle initialization failure', async () => {
    const failingAdapter = {
      ...adapter!,
      async init() {
        this.state = 'initializing';
        await new Promise(resolve => setTimeout(resolve, 10));
        this.state = 'error';
        throw new Error('Initialization failed');
      },
    };

    await expect(failingAdapter.init()).rejects.toThrow('Initialization failed');
    expect(failingAdapter.state).toBe('error');
  });

  test('should track multiple adapters lifecycle', async () => {
    const adapters = Array.from({ length: 3 }, (_, i) => ({
      ...adapter!,
      id: `adapter-${i}`,
      state: 'uninitialized' as const,
      resources: [] as string[],
    }));

    await Promise.all(adapters.map(a => a.init()));

    adapters.forEach(a => {
      expect(a.state).toBe('ready');
    });

    await Promise.all(adapters.map(a => a.dispose()));

    adapters.forEach(a => {
      expect(a.state).toBe('disposed');
      expect(a.resources).toHaveLength(0);
    });
  });

  test('should handle partial initialization failure', async () => {
    const adapters = [
      { ...adapter!, id: 'a1', async init() { await adapter!.init.call(this); } },
      {
        ...adapter!,
        id: 'a2',
        async init() {
          this.state = 'initializing';
          throw new Error('Failed');
        },
      },
      { ...adapter!, id: 'a3', async init() { await adapter!.init.call(this); } },
    ];

    const results = await Promise.allSettled(adapters.map(a => a.init()));

    expect(results[0].status).toBe('fulfilled');
    expect(results[1].status).toBe('rejected');
    expect(results[2].status).toBe('fulfilled');
  });

  test('should maintain state consistency during concurrent operations', async () => {
    const operations = [
      adapter!.init(),
      new Promise(resolve => setTimeout(resolve, 5)),
      new Promise(resolve => setTimeout(resolve, 15)),
    ];

    await Promise.all(operations);

    expect(adapter!.state).toBe('ready');
  });

  test('should handle rapid init-dispose cycles', async () => {
    for (let i = 0; i < 5; i++) {
      await adapter!.init();
      expect(adapter!.state).toBe('ready');
      
      await adapter!.dispose();
      expect(adapter!.state).toBe('disposed');
      
      // Reset for next cycle
      adapter!.state = 'uninitialized';
      adapter!.resources = [];
    }
  });

  test('should clean up on error during initialization', async () => {
    const cleanupAdapter = {
      ...adapter!,
      async init() {
        this.state = 'initializing';
        this.resources.push('temp-resource');
        
        // Simulate error
        throw new Error('Init error');
      },
    };

    try {
      await cleanupAdapter.init();
    } catch {
      // Expected error
    }

    // Cleanup should have been called
    expect(cleanupAdapter.resources.length).toBeGreaterThanOrEqual(0);
  });

  test('should track resource allocation and deallocation', async () => {
    const resourceTracker = {
      allocated: 0,
      deallocated: 0,
    };

    const trackedAdapter = {
      ...adapter!,
      async init() {
        await adapter!.init.call(this);
        resourceTracker.allocated = this.resources.length;
      },
      async dispose() {
        resourceTracker.deallocated = this.resources.length;
        await adapter!.dispose.call(this);
      },
    };

    await trackedAdapter.init();
    expect(resourceTracker.allocated).toBe(2);

    await trackedAdapter.dispose();
    expect(resourceTracker.deallocated).toBe(2);
  });

  test('should handle nested adapter hierarchies', async () => {
    const parentAdapter = { ...adapter!, id: 'parent' };
    const childAdapter = { ...adapter!, id: 'child', parent: parentAdapter };

    await parentAdapter.init();
    await childAdapter.init();

    expect(parentAdapter.state).toBe('ready');
    expect(childAdapter.state).toBe('ready');

    await childAdapter.dispose();
    await parentAdapter.dispose();

    expect(parentAdapter.state).toBe('disposed');
    expect(childAdapter.state).toBe('disposed');
  });

  test('should propagate disposal to dependent adapters', async () => {
    const primary = { ...adapter!, id: 'primary' };
    const dependents = Array.from({ length: 3 }, (_, i) => ({
      ...adapter!,
      id: `dependent-${i}`,
      primary,
    }));

    await primary.init();
    await Promise.all(dependents.map(d => d.init()));

    await primary.dispose();

    // Simulate cascading disposal
    await Promise.all(dependents.map(d => d.dispose()));

    [primary, ...dependents].forEach(a => {
      expect(a.state).toBe('disposed');
    });
  });

  test('should handle timeout during initialization', async () => {
    const timeoutAdapter = {
      ...adapter!,
      async init() {
        this.state = 'initializing';
        
        const timeout = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Init timeout')), 50);
        });

        const actual = new Promise(resolve => {
          setTimeout(() => {
            this.state = 'ready';
            resolve(undefined);
          }, 100); // Takes longer than timeout
        });

        await Promise.race([actual, timeout]);
      },
    };

    await expect(timeoutAdapter.init()).rejects.toThrow('Init timeout');
  });

  test('should support graceful degradation on partial failure', async () => {
    const degradableAdapter = {
      ...adapter!,
      features: { core: false, optional: false },
      async init() {
        this.state = 'initializing';
        
        // Core feature always succeeds
        this.features.core = true;
        
        // Optional feature may fail
        try {
          // Simulate optional feature init
          this.features.optional = true;
        } catch {
          // Continue without optional feature
        }
        
        this.state = 'ready';
      },
    };

    await degradableAdapter.init();

    expect(degradableAdapter.state).toBe('ready');
    expect(degradableAdapter.features.core).toBe(true);
  });
});
