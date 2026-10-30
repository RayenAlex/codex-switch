import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveVisualStudioGenerator } from './resolve-visual-studio-generator.mjs';

function options(versions, generators = ['Visual Studio 18 2026', 'Visual Studio 17 2022']) {
  return { run: (command, args, settings) => {
    assert.equal(settings.windowsHide, true);
    if (command.endsWith('vswhere.exe')) {
      assert.ok(args.includes('Microsoft.VisualStudio.Component.VC.Tools.x86.x64'));
      return { status: 0, stdout: versions.join('\r\n') };
    }
    assert.deepEqual(args, ['-E', 'capabilities']);
    return { status: 0, stdout: JSON.stringify({ generators: generators.map(name => ({ name })) }) };
  } };
}

test('uses VS 2026 when it is the only installed C++ toolchain', () => {
  assert.equal(resolveVisualStudioGenerator('cmake', options(['18.4.11605.240'])), 'Visual Studio 18 2026');
});
test('preserves VS 2022 when both supported toolchains are installed', () => {
  assert.equal(resolveVisualStudioGenerator('cmake', options(['18.4.0', '17.14.0'])), 'Visual Studio 17 2022');
});
test('does not select an installed toolchain unsupported by this CMake', () => {
  assert.throws(() => resolveVisualStudioGenerator('cmake', options(['18.4.0'], ['Visual Studio 17 2022'])),
    /update CMake/);
});
test('rejects missing C++ installations and failed discovery', () => {
  assert.throws(() => resolveVisualStudioGenerator('cmake', options([])), /Install C\+\+ Build Tools/);
  assert.throws(() => resolveVisualStudioGenerator('cmake', { run: () => ({ status: 1 }) }), /Cannot detect/);
});
