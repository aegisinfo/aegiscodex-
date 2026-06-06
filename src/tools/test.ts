/**
 * 
 * 
 * 
 */

import { ToolRegistry, getBuiltinTools, ToolKind, createTool } from './index.js';
import { z } from 'zod';
import path from 'path';
import fs from 'fs/promises';
import os from 'os';

async function testToolSystem() {

  const registry = new ToolRegistry();
  const builtinTools = getBuiltinTools();
  registry.registerAll(builtinTools);

  const readTool = registry.get('Read');

  const readOnlyTools = registry.getReadOnlyTools();
  const writeTools = registry.getWriteTools();

  const declarations = registry.getFunctionDeclarations();
  for (const decl of declarations) {

  }

  const planDeclarations = registry.getFunctionDeclarationsByMode('plan');

  if (readTool) {
    const packageJsonPath = path.join(process.cwd(), 'package.json');
    const result = await readTool.execute({ file_path: packageJsonPath });

  }
  const editTool = registry.get('Edit');
  if (editTool) {
    const tmpDir = os.tmpdir();
    const testFile = path.join(tmpDir, `aegis-test-${Date.now()}.txt`);
    await fs.writeFile(testFile, 'Hello World\nFoo Bar\n', 'utf8');
    const result = await editTool.execute({
      file_path: testFile,
      old_string: 'World',
      new_string: 'AEGIS',
    });

    const content = await fs.readFile(testFile, 'utf8');
    await fs.writeFile(testFile, 'AAA BBB AAA', 'utf8');
    const multiResult = await editTool.execute({
      file_path: testFile,
      old_string: 'AAA',
      new_string: 'CCC',
    });
    await fs.unlink(testFile);
  }
  const writeTool = registry.get('Write');
  if (writeTool) {
    const tmpDir = os.tmpdir();
    const testFile = path.join(tmpDir, `aegis-write-${Date.now()}.txt`);
    
    const result = await writeTool.execute({
      file_path: testFile,
      contents: 'Test content\nLine 2\n',
    });

    const exists = await fs.access(testFile).then(() => true).catch(() => false);
    if (exists) await fs.unlink(testFile);
  }
  const bashTool = registry.get('Bash');
  if (bashTool) {
    const result = await bashTool.execute({
      command: 'echo "Hello from Bash"',
      description: ' echo ',
    });

    const failResult = await bashTool.execute({
      command: 'exit 1',
    });
  }
  const globTool = registry.get('Glob');
  if (globTool) {
    const result = await globTool.execute({ pattern: '*.ts', path: path.join(process.cwd(), 'src') });

    if (result.metadata?.count) {
    }
  }
  const grepTool = registry.get('Grep');
  if (grepTool) {
    const result = await grepTool.execute({ 
      pattern: 'export', 
      include: '*.ts',
      path: path.join(process.cwd(), 'src/tools'),
    });

    if (result.metadata?.matches) {
    }
  }
  const mockMcpTool = createTool({
    name: 'MockMcpTool',
    displayName: 'Mock MCP Tool',
    kind: ToolKind.ReadOnly,
    schema: z.object({ input: z.string() }),
    description: { short: 'A mock MCP tool for testing' },
    async execute(params) {
      return {
        success: true,
        llmContent: `Mock result for: ${params.input}`,
        displayContent: '✅ Mock MCP ',
      };
    },
  });
  
  registry.registerMcpTool(mockMcpTool);

  registry.unregisterMcpTool('MockMcpTool');

  if (readTool) {
    const invocation = readTool.build({ file_path: '/test/path.ts' });

  }
  if (readTool) {
    const invalidResult = await readTool.execute({ file_path: '' });

  }
}

testToolSystem().catch(console.error);
