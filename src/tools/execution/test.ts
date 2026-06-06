/**
 * 
 * 
 * 
 */

import { ExecutionPipeline, PermissionMode, type PipelineExecutionContext } from './index.js';
import { ToolRegistry, createToolRegistry, getBuiltinTools } from '../index.js';
import { PermissionChecker } from '../validation/PermissionChecker.js';
import { SensitiveFileDetector, SensitivityLevel } from '../validation/SensitiveFileDetector.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

let testDir: string;

async function setup() {
  testDir = path.join(os.tmpdir(), `pipeline-test-${Date.now()}`);
  await fs.mkdir(testDir, { recursive: true });
  await fs.writeFile(path.join(testDir, 'test.txt'), 'Hello, World!');
  await fs.writeFile(path.join(testDir, 'config.json'), '{"key": "value"}');
}

async function cleanup() {
  try {
    await fs.rm(testDir, { recursive: true, force: true });
  } catch {
    // Ignore cleanup errors
  }
}

function createTestContext(mode: PermissionMode = PermissionMode.DEFAULT): PipelineExecutionContext {
  return {
    sessionId: 'test-session',
    workspaceRoot: testDir,
    permissionMode: mode,
  };
}

async function testPermissionChecker() {
  
  const checker = new PermissionChecker({
    allow: ['Bash(npm:*)'],
    deny: ['Bash(rm -rf:*)'],
  });
  const allowResult = checker.check({
    toolName: 'Bash',
    params: { command: 'npm test' },
  });
  const denyResult = checker.check({
    toolName: 'Bash',
    params: { command: 'rm -rf /' },
  });
  const askResult = checker.check({
    toolName: 'Write',
    params: { file_path: '/tmp/test.txt' },
  });
}

async function testSensitiveFileDetector() {
  const envResult = SensitiveFileDetector.check('.env');
  const logResult = SensitiveFileDetector.check('app.log');
  const configResult = SensitiveFileDetector.check('config.json');
  const normalResult = SensitiveFileDetector.check('main.ts');
  const dangerous = SensitiveFileDetector.isDangerousPath('/etc/passwd');
}

async function testPipelineReadOnly() {
  
  const registry = createToolRegistry();
  const builtinTools = getBuiltinTools();
  for (const tool of builtinTools) {
    registry.register(tool);
  }
  
  const pipeline = new ExecutionPipeline(registry);
  const context = createTestContext();
  const testFile = path.join(testDir, 'test.txt');
  const readResult = await pipeline.execute('Read', { file_path: testFile }, context);
  const globResult = await pipeline.execute('Glob', { pattern: '*.txt', path: testDir }, context);
}

async function testPermissionModes() {
  
  const registry = createToolRegistry();
  const builtinTools = getBuiltinTools();
  for (const tool of builtinTools) {
    registry.register(tool);
  }
  
  const pipeline = new ExecutionPipeline(registry);
  const testFile = path.join(testDir, 'write-test.txt');
  const planContext = createTestContext(PermissionMode.PLAN);
  const planResult = await pipeline.execute(
    'Write',
    { file_path: testFile, contents: 'test' },
    planContext
  );
  const yoloContext = createTestContext(PermissionMode.YOLO);
  const yoloResult = await pipeline.execute(
    'Write',
    { file_path: testFile, contents: 'YOLO test' },
    yoloContext
  );
  const content = await fs.readFile(testFile, 'utf8');
}

async function testPipelineStages() {
  
  const registry = createToolRegistry();
  const builtinTools = getBuiltinTools();
  for (const tool of builtinTools) {
    registry.register(tool);
  }
  
  const pipeline = new ExecutionPipeline(registry);
  const context = createTestContext(PermissionMode.YOLO);
  
  const stagesExecuted: string[] = [];
  
  // Note: ExecutionPipeline doesn't expose on() - stages run automatically
  // This test verifies the pipeline processes through all stages
  
  const testFile = path.join(testDir, 'test.txt');
  await pipeline.execute('Read', { file_path: testFile }, context);

}

async function testExecutionHistory() {
  
  const registry = createToolRegistry();
  const builtinTools = getBuiltinTools();
  for (const tool of builtinTools) {
    registry.register(tool);
  }
  
  const pipeline = new ExecutionPipeline(registry);
  const context = createTestContext(PermissionMode.YOLO);
  const testFile = path.join(testDir, 'test.txt');
  await pipeline.execute('Read', { file_path: testFile }, context);
  await pipeline.execute('Glob', { pattern: '*', path: testDir }, context);
  
  const history = pipeline.getHistory();

}

async function testSessionApprovals() {
  
  const registry = createToolRegistry();
  const builtinTools = getBuiltinTools();
  for (const tool of builtinTools) {
    registry.register(tool);
  }
  
  const pipeline = new ExecutionPipeline(registry);
  pipeline.addSessionApproval('Write(/tmp/approved.txt)');

  pipeline.clearSessionApprovals();
}

async function testBashTool() {
  
  const registry = createToolRegistry();
  const builtinTools = getBuiltinTools();
  for (const tool of builtinTools) {
    registry.register(tool);
  }
  
  const pipeline = new ExecutionPipeline(registry);
  const context = createTestContext(PermissionMode.YOLO);
  const echoResult = await pipeline.execute(
    'Bash',
    { command: 'echo "Pipeline Test"' },
    context
  );
}

async function main() {
  
  try {
    await setup();
    
    await testPermissionChecker();
    await testSensitiveFileDetector();
    await testPipelineReadOnly();
    await testPermissionModes();
    await testPipelineStages();
    await testExecutionHistory();
    await testSessionApprovals();
    await testBashTool();
  } finally {
    await cleanup();
  }
}

main().catch(console.error);
