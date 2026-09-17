// test.js - Unit tests for Intel 8080 CPU and Assembler
const Intel8080 = require('./cpu.js');
const Assembler8080 = require('./assembler.js');
const FPU = require('./fpu.js');
const assert = require('assert');

console.log('--- Running Intel 8080 Emulator & Assembler Tests ---');

// Helper to run a test block and report status
function runTest(name, fn) {
    try {
        fn();
        console.log(`[PASS] ${name}`);
    } catch (e) {
        console.error(`[FAIL] ${name}`);
        console.error(e);
        process.exit(1);
    }
}

runTest('CPU Reset & Initial Values', () => {
    const cpu = new Intel8080();
    assert.strictEqual(cpu.registers.a, 0);
    assert.strictEqual(cpu.registers.b, 0);
    assert.strictEqual(cpu.registers.sp, 0xFFFF);
    assert.strictEqual(cpu.registers.pc, 0);
    assert.strictEqual(cpu.flags.z, false);
    assert.strictEqual(cpu.flags.cy, false);
    assert.strictEqual(cpu.halted, false);
});

runTest('INR / DCR AC Flag Behavior', () => {
    const cpu = new Intel8080();

    // INR 0x0F -> should set AC
    cpu.registers.a = 0x0F;
    cpu.execute(0x3C); // INR A
    assert.strictEqual(cpu.registers.a, 0x10);
    assert.strictEqual(cpu.flags.ac, true, 'INR 0x0F should set AC flag');

    // DCR 0x10 -> should clear AC (as there is a borrow out of low order nibble, complement of borrow is 0)
    cpu.registers.a = 0x10;
    cpu.execute(0x3D); // DCR A
    assert.strictEqual(cpu.registers.a, 0x0F);
    assert.strictEqual(cpu.flags.ac, false, 'DCR 0x10 should clear AC flag');

    // DCR 0x0F -> should set AC (as there is no borrow out of low order nibble, complement of borrow is 1)
    cpu.registers.a = 0x0F;
    cpu.execute(0x3D); // DCR A
    assert.strictEqual(cpu.registers.a, 0x0E);
    assert.strictEqual(cpu.flags.ac, true, 'DCR 0x0F should set AC flag');
});

runTest('Subtraction AC and Carry Flag Logic', () => {
    const cpu = new Intel8080();

    // Test: 0x3E - 0x05 (no borrow)
    cpu.registers.a = 0x3E;
    cpu.executeALU(2, 0x05); // SUB 0x05 (ALU op 2 is SUB)
    assert.strictEqual(cpu.registers.a, 0x39);
    assert.strictEqual(cpu.flags.cy, false);
    // (0x0E & 0x0F) - (0x05 & 0x0F) = 0x0E - 0x05 = 0x09 >= 0, so AC flag calculation should match physical 8080
    // In physical 8080, SUB does: A + ~B + 1.
    // Let's check AC logic: 0x3E + ~0x05 + 1 = 0x3E + 0xFA + 1. Low nibbles: 0x0E + 0x0A + 1 = 0x19 (carry out is 1)
    // Physical 8080 does not invert AC after subtraction, so AC = 1.
    assert.strictEqual(cpu.flags.ac, true, 'SUB 0x3E - 0x05 should result in AC = 1 (since 0x0E + 0x0A + 1 = 0x19)');

    // Test: 0x00 - 0x01
    cpu.reset();
    cpu.registers.a = 0x00;
    cpu.executeALU(2, 0x01); // SUB 0x01
    assert.strictEqual(cpu.registers.a, 0xFF);
    assert.strictEqual(cpu.flags.cy, true, '0x00 - 0x01 should set carry (borrow)');
    // Low nibbles: 0x00 + ~0x01 + 1 = 0x00 + 0x0E + 1 = 0x0F (carry out is 0). Thus AC = 0.
    assert.strictEqual(cpu.flags.ac, false, '0x00 - 0x01 should result in AC = 0');
});

runTest('Rotate Masking (RLC / RAL accumulator 8-bit safety)', () => {
    const cpu = new Intel8080();

    // RLC with MSB set: 0x80 -> should rotate to 0x01, CY = true
    cpu.registers.a = 0x80;
    cpu.execute(0x07); // RLC
    assert.strictEqual(cpu.registers.a, 0x01);
    assert.strictEqual(cpu.flags.cy, true);

    // RAL with MSB set and CY = false: 0x80 -> should rotate to 0x00, CY = true
    cpu.reset();
    cpu.registers.a = 0x80;
    cpu.flags.cy = false;
    cpu.execute(0x17); // RAL
    assert.strictEqual(cpu.registers.a, 0x00);
    assert.strictEqual(cpu.flags.cy, true);
});

runTest('Assembler Supports Pair Names (BC, DE, HL)', () => {
    const assembler = new Assembler8080();
    const source = `
        LXI BC, 1234H
        LXI DE, 5678H
        LXI HL, 9ABCH
    `;
    const result = assembler.assemble(source);
    const bin = result.binary;

    // LXI BC, 1234H -> 01 34 12
    assert.strictEqual(bin[0], 0x01);
    assert.strictEqual(bin[1], 0x34);
    assert.strictEqual(bin[2], 0x12);

    // LXI DE, 5678H -> 11 78 56
    assert.strictEqual(bin[3], 0x11);
    assert.strictEqual(bin[4], 0x78);
    assert.strictEqual(bin[5], 0x56);

    // LXI HL, 9ABCH -> 21 BC 9A
    assert.strictEqual(bin[6], 0x21);
    assert.strictEqual(bin[7], 0xBC);
    assert.strictEqual(bin[8], 0x9A);
});

runTest('Assembler Supports RST 0 - RST 7 Instructions', () => {
    const assembler = new Assembler8080();
    const source = `
        RST 0
        RST 3
        RST 7
    `;
    const result = assembler.assemble(source);
    const bin = result.binary;

    assert.strictEqual(bin[0], 0xC7); // RST 0
    assert.strictEqual(bin[1], 0xDF); // RST 3
    assert.strictEqual(bin[2], 0xFF); // RST 7
});

runTest('Assembler Rejects Invalid Code & Registers', () => {
    const assembler = new Assembler8080();

    // Test invalid register
    assert.throws(() => {
        assembler.assemble('MOV B, X');
    }, /Invalid register/i);

    // Test MOV M, M (illegal instruction on 8080)
    assert.throws(() => {
        assembler.assemble('MOV M, M');
    }, /Cannot use MOV M, M/i);

    // Test undefined labels
    assert.throws(() => {
        assembler.assemble('JMP UNDEFINED_LABEL');
    }, /Undefined label/i);
});

// ═══════════════════════════════════════════════════════════════════
// ═══ [FPU] TESTS DEL COPROCESADOR DE PUNTO FLOTANTE ═══════════════
// ═══════════════════════════════════════════════════════════════════

// Helper: crea un sistema CPU + FPU con RAM compartida
function makeSystem() {
    const cpu = new Intel8080();
    const fpu = new FPU(cpu.memory);
    cpu.attachFPU(fpu);
    return { cpu, fpu };
}

// Helper: ejecuta el CPU hasta que se detenga (HLT)
function runUntilHalt(cpu, maxSteps = 5000) {
    let steps = 0;
    while (!cpu.halted && steps < maxSteps) {
        cpu.step();
        steps++;
    }
    if (steps >= maxSteps) throw new Error(`El programa no terminó tras ${maxSteps} pasos`);
    return steps;
}

// Helper: ensambla, carga en memoria y ejecuta el programa completo
function assembleAndRun(source) {
    const { cpu, fpu } = makeSystem();
    const assembler = new Assembler8080();
    const result = assembler.assemble(source);
    cpu.memory.set(result.binary);
    runUntilHalt(cpu);
    return { cpu, fpu };
}

// ─── Tests de ensamblado ───

runTest('FPU Assembler: FLDI F0, 3.14 expande a 20 bytes', () => {
    const assembler = new Assembler8080();
    const result = assembler.assemble('FLDI F0, 3.14');
    assert.strictEqual(result.maxAddr, 20);
    // 4 pares MVI+STA apuntando a 0xFF01, 0xFF02, 0xFF03, 0xFF04
    const expectedAddrs = [0x01, 0x02, 0x03, 0x04];
    for (let i = 0; i < 4; i++) {
        const off = i * 5;
        assert.strictEqual(result.binary[off], 0x3E, `Par ${i}: debería ser MVI A`);
        assert.strictEqual(result.binary[off + 2], 0x32, `Par ${i}: debería ser STA`);
        assert.strictEqual(result.binary[off + 3], expectedAddrs[i], `Par ${i}: dirección baja`);
        assert.strictEqual(result.binary[off + 4], 0xFF, `Par ${i}: dirección alta`);
    }
});

runTest('FPU Assembler: FLDI F1, 2.71 apunta a 0xFF05-0xFF08', () => {
    const assembler = new Assembler8080();
    const result = assembler.assemble('FLDI F1, 2.71');
    const expectedAddrs = [0x05, 0x06, 0x07, 0x08];
    for (let i = 0; i < 4; i++) {
        const off = i * 5;
        assert.strictEqual(result.binary[off + 3], expectedAddrs[i], `Par ${i}: dirección baja`);
        assert.strictEqual(result.binary[off + 4], 0xFF, `Par ${i}: dirección alta`);
    }
});

runTest('FPU Assembler: operaciones aritméticas expanden a 5 bytes', () => {
    const assembler = new Assembler8080();
    const ops = [
        { src: 'FADD', cmd: 0x01 },
        { src: 'FSUB', cmd: 0x02 },
        { src: 'FMUL', cmd: 0x03 },
        { src: 'FDIV', cmd: 0x04 }
    ];
    for (const { src, cmd } of ops) {
        const result = assembler.assemble(src);
        assert.strictEqual(result.maxAddr, 5, `${src} debería ocupar 5 bytes`);
        assert.strictEqual(result.binary[0], 0x3E, `${src}: MVI A`);
        assert.strictEqual(result.binary[1], cmd, `${src}: comando correcto`);
        assert.strictEqual(result.binary[2], 0x32, `${src}: STA`);
        assert.strictEqual(result.binary[3], 0x00, `${src}: 0xFF00 low`);
        assert.strictEqual(result.binary[4], 0xFF, `${src}: 0xFF00 high`);
    }
});

runTest('FPU Assembler: FSTA 2000H expande a 24 bytes', () => {
    const assembler = new Assembler8080();
    const result = assembler.assemble('FSTA 2000H');
    assert.strictEqual(result.maxAddr, 24);
    // 4 pares LDA+STA
    const expectedSrc = [0x01, 0x02, 0x03, 0x04];
    const expectedDst = [0x00, 0x01, 0x02, 0x03];
    for (let i = 0; i < 4; i++) {
        const off = i * 6;
        assert.strictEqual(result.binary[off], 0x3A, `Par ${i}: LDA`);
        assert.strictEqual(result.binary[off + 1], expectedSrc[i], `Par ${i}: src low`);
        assert.strictEqual(result.binary[off + 2], 0xFF, `Par ${i}: src high`);
        assert.strictEqual(result.binary[off + 3], 0x32, `Par ${i}: STA`);
        assert.strictEqual(result.binary[off + 4], expectedDst[i], `Par ${i}: dst low`);
        assert.strictEqual(result.binary[off + 5], 0x20, `Par ${i}: dst high`);
    }
});

runTest('FPU Assembler: rechaza registro flotante inválido', () => {
    const assembler = new Assembler8080();
    assert.throws(() => assembler.assemble('FLDI F7, 1.0'), /Invalid FPU register/i);
    assert.throws(() => assembler.assemble('FLDI A, 1.0'), /Invalid FPU register/i);
});

runTest('FPU Assembler: rechaza valor flotante inválido', () => {
    const assembler = new Assembler8080();
    assert.throws(() => assembler.assemble('FLDI F0, abc'), /Invalid float value/i);
});

// ─── Tests de ejecución (end-to-end) ───

runTest('FPU Exec: FLDI F0, 3.14 carga el float en memoria', () => {
    const { fpu } = assembleAndRun('FLDI F0, 3.14\nHLT');
    const value = fpu.readFloat(0xFF01);
    assert.ok(Math.abs(value - 3.14) < 0.001, `Esperado ~3.14, obtenido ${value}`);
});

runTest('FPU Exec: FADD calcula 3.14 + 2.71', () => {
    const { fpu } = assembleAndRun(`
        FLDI F0, 3.14
        FLDI F1, 2.71
        FADD
        HLT
    `);
    const value = fpu.readFloat(0xFF01);
    assert.ok(Math.abs(value - 5.85) < 0.01, `Esperado ~5.85, obtenido ${value}`);
});

runTest('FPU Exec: FSUB calcula 10.0 - 3.5 = 6.5', () => {
    const { fpu } = assembleAndRun(`
        FLDI F0, 10.0
        FLDI F1, 3.5
        FSUB
        HLT
    `);
    const value = fpu.readFloat(0xFF01);
    assert.strictEqual(value, 6.5);
});

runTest('FPU Exec: FMUL calcula 3.0 * 4.0 = 12.0', () => {
    const { fpu } = assembleAndRun(`
        FLDI F0, 3.0
        FLDI F1, 4.0
        FMUL
        HLT
    `);
    const value = fpu.readFloat(0xFF01);
    assert.strictEqual(value, 12.0);
});

runTest('FPU Exec: FDIV calcula 15.0 / 4.0 = 3.75', () => {
    const { fpu } = assembleAndRun(`
        FLDI F0, 15.0
        FLDI F1, 4.0
        FDIV
        HLT
    `);
    const value = fpu.readFloat(0xFF01);
    assert.strictEqual(value, 3.75);
});

runTest('FPU Exec: FSTA guarda el resultado en memoria', () => {
    const { fpu } = assembleAndRun(`
        FLDI F0, 5.5
        FSTA 2000H
        HLT
    `);
    const value = fpu.readFloat(2000);
    assert.strictEqual(value, 5.5);
});

runTest('FPU Exec: pipeline completo (10.5 + 4.5) * 2 / 5 - 1 = 5.0', () => {
    const { fpu } = assembleAndRun(`
        FLDI F0, 10.5
        FLDI F1, 4.5
        FADD
        FLDI F1, 2.0
        FMUL
        FLDI F1, 5.0
        FDIV
        FLDI F1, 1.0
        FSUB
        FSTA 2000H
        HLT
    `);
    const value = fpu.readFloat(2000);
    assert.strictEqual(value, 5.0);
});

runTest('FPU Exec: FDIV por cero activa la bandera divByZero', () => {
    const { fpu } = assembleAndRun(`
        FLDI F0, 1.0
        FLDI F1, 0.0
        FDIV
        HLT
    `);
    assert.strictEqual(fpu.flags.divByZero, true);
});

runTest('FPU Exec: maneja números negativos', () => {
    const { fpu } = assembleAndRun(`
        FLDI F0, -3.5
        FLDI F1, 1.5
        FADD
        HLT
    `);
    const value = fpu.readFloat(0xFF01);
    assert.strictEqual(value, -2.0);
});

runTest('FPU Exec: el CPU puede disparar el FPU escribiendo en 0xFF00', () => {
    const { cpu, fpu } = makeSystem();
    fpu.writeFloat(0xFF01, 5.0);  // F0 = 5.0
    fpu.writeFloat(0xFF05, 3.0);  // F1 = 3.0

    // El CPU escribe directamente el comando ADD en 0xFF00
    cpu.writeMemory(0xFF00, 0x01);

    assert.strictEqual(fpu.registers.f0, 8.0);
});

console.log('All tests completed successfully!');