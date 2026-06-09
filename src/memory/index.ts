/**
 * Memory module exports
 */

export { SharedMemory, sharedMemory, setOllamaBaseUrl, type MemoryEntry, type MemoryConfig } from './SharedMemory.js';
export { syncSessionToDrive } from './DriveSync.js';
export {
  AgentMemoryBus,
  agentMemoryBus,
  type AgentChannel,
  type AgentMemoryMessage,
  type AgentMemoryQuery,
} from './AgentMemoryBus.js';
