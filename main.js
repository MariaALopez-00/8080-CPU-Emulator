const cpu = new Intel8080();
const assembler = new Assembler8080();
// ═══ [FPU] Instanciar el coprocesador y asociarlo al CPU ═══
const fpu = new FPU(cpu.memory);
cpu.attachFPU(fpu);
// ═══════════════════════════════════════════════════════════════

let runInterval = null;
let memoryStart = 0;

function updateUI() {
    // Registers
    document.getElementById('reg-a').textContent = cpu.registers.a.toString(16).toUpperCase().padStart(2, '0');
    document.getElementById('reg-b').textContent = cpu.registers.b.toString(16).toUpperCase().padStart(2, '0');
    document.getElementById('reg-c').textContent = cpu.registers.c.toString(16).toUpperCase().padStart(2, '0');
    document.getElementById('reg-d').textContent = cpu.registers.d.toString(16).toUpperCase().padStart(2, '0');
    document.getElementById('reg-e').textContent = cpu.registers.e.toString(16).toUpperCase().padStart(2, '0');
    document.getElementById('reg-h').textContent = cpu.registers.h.toString(16).toUpperCase().padStart(2, '0');
    document.getElementById('reg-l').textContent = cpu.registers.l.toString(16).toUpperCase().padStart(2, '0');
    document.getElementById('reg-pc').textContent = cpu.registers.pc.toString(16).toUpperCase().padStart(4, '0');
    document.getElementById('reg-sp').textContent = cpu.registers.sp.toString(16).toUpperCase().padStart(4, '0');
    document.getElementById('reg-f').textContent = cpu.getFlagByte().toString(16).toUpperCase().padStart(2, '0');

    // Flags
    document.getElementById('flag-s').textContent = cpu.flags.s ? '1' : '0';
    document.getElementById('flag-z').textContent = cpu.flags.z ? '1' : '0';
    document.getElementById('flag-ac').textContent = cpu.flags.ac ? '1' : '0';
    document.getElementById('flag-p').textContent = cpu.flags.p ? '1' : '0';
    document.getElementById('flag-cy').textContent = cpu.flags.cy ? '1' : '0';

    document.getElementById('status-badge').textContent = cpu.halted ? 'Halted' : (runInterval ? 'Running' : 'Idle');
    document.getElementById('status-badge').style.backgroundColor = cpu.halted ? '#fee2e2' : (runInterval ? '#f0fdf4' : '#e2e8f0');

    renderMemory();
    renderStack();
    // ═══ [FPU] Actualizar también la UI del coprocesador ═══
    updateFPUUI();
    // ═══════════════════════════════════════════════════════════════
}

function renderStack() {
    const table = document.getElementById('stack-table');
    if (!table) return;
    table.innerHTML = '';

    const currentSP = cpu.registers.sp;

    // Show 5 slots (2-byte aligned) from SP - 4 to SP + 6
    for (let offset = 6; offset >= -4; offset -= 2) {
        const addr = (currentSP + offset) & 0xFFFF;

        const row = document.createElement('div');
        row.className = 'stack-row';
        if (offset === 0) {
            row.classList.add('active');
        }

        const addrSpan = document.createElement('span');
        addrSpan.className = 'stack-addr';
        addrSpan.textContent = (offset === 0 ? 'SP ➔ ' : '     ') + addr.toString(16).toUpperCase().padStart(4, '0') + ':';

        const low = cpu.readMemory(addr);
        const high = cpu.readMemory((addr + 1) & 0xFFFF);
        const val16 = (high << 8) | low;

        const valSpan = document.createElement('span');
        valSpan.className = 'stack-val';
        valSpan.textContent = val16.toString(16).toUpperCase().padStart(4, '0') + 'H (' + high.toString(16).toUpperCase().padStart(2, '0') + ' ' + low.toString(16).toUpperCase().padStart(2, '0') + ')';

        row.appendChild(addrSpan);
        row.appendChild(valSpan);
        table.appendChild(row);
    }
}

function renderMemory() {
    const table = document.getElementById('memory-table');
    table.innerHTML = '';

    // Header
    const empty = document.createElement('div');
    empty.className = 'mem-cell mem-header';
    empty.textContent = '';
    table.appendChild(empty);

    for (let i = 0; i < 16; i++) {
        const h = document.createElement('div');
        h.className = 'mem-cell mem-header';
        h.textContent = i.toString(16).toUpperCase();
        table.appendChild(h);
    }

    // Rows
    for (let row = 0; row < 8; row++) {
        const addr = (memoryStart + row * 16) & 0xFFFF;
        const h = document.createElement('div');
        h.className = 'mem-cell mem-addr';
        h.textContent = addr.toString(16).toUpperCase().padStart(4, '0');
        table.appendChild(h);

        for (let col = 0; col < 16; col++) {
            const cellAddr = (addr + col) & 0xFFFF;
            const c = document.createElement('div');
            c.className = 'mem-cell';
            if (cellAddr === cpu.registers.pc) c.style.backgroundColor = '#fde047';
            c.textContent = cpu.readMemory(cellAddr).toString(16).toUpperCase().padStart(2, '0');
            table.appendChild(c);
        }
    }
}

// ═══════════════════════════════════════════════════════════════════
// ═══ [FPU] ACTUALIZACIÓN DE LA UI DEL COPROCESADOR ═══════════════
// ═══════════════════════════════════════════════════════════════════

// Lee los 4 registros flotantes desde la RAM (fuente de verdad) y
// actualiza sus valores y representación hexadecimal en la UI.
function updateFPUUI() {
    if (!fpu) return;

    // Registros flotantes: leemos de la RAM para reflejar siempre el
    // estado real, incluso si el CPU acaba de escribir un FLDI.
    updateFPURegister('fpu-f0', 'fpu-f0-hex', fpu.readFloat(0xFF01));
    updateFPURegister('fpu-f1', 'fpu-f1-hex', fpu.readFloat(0xFF05));
    updateFPURegister('fpu-f2', 'fpu-f2-hex', fpu.readFloat(0xFF09));
    updateFPURegister('fpu-f3', 'fpu-f3-hex', fpu.readFloat(0xFF0D));

    // Banderas del FPU
    document.getElementById('fpu-flag-z').textContent = fpu.flags.zero ? '1' : '0';
    document.getElementById('fpu-flag-s').textContent = fpu.flags.sign ? '1' : '0';
    document.getElementById('fpu-flag-ov').textContent = fpu.flags.overflow ? '1' : '0';
    document.getElementById('fpu-flag-un').textContent = fpu.flags.underflow ? '1' : '0';
    document.getElementById('fpu-flag-pr').textContent = fpu.flags.precision ? '1' : '0';
    document.getElementById('fpu-flag-inv').textContent = fpu.flags.invalid ? '1' : '0';
    document.getElementById('fpu-flag-dz').textContent = fpu.flags.divByZero ? '1' : '0';

    // Registros de estado y control
    document.getElementById('fpu-status-byte').textContent = fpu.getStatusByte().toString(16).toUpperCase().padStart(2, '0');
    document.getElementById('fpu-control-byte').textContent = fpu.roundingMode.toString(16).toUpperCase().padStart(2, '0');

    // Pila del FPU
    renderFPUStack();
}

// Actualiza un registro flotante en la UI (valor + hex IEEE 754)
function updateFPURegister(valueId, hexId, value) {
    const valueEl = document.getElementById(valueId);
    const hexEl = document.getElementById(hexId);
    if (!valueEl || !hexEl) return;

    valueEl.textContent = formatFloat(value);

    // Representación hexadecimal de los 32 bits IEEE 754
    const buf = new ArrayBuffer(4);
    const f32 = new Float32Array(buf);
    const u32 = new Uint32Array(buf);
    f32[0] = value;
    hexEl.textContent = u32[0].toString(16).toUpperCase().padStart(8, '0');
}

// Formatea un número flotante para mostrarlo de forma legible.
// Redondea a 7 dígitos significativos (precisión de float32) y
// elimina ceros finales innecesarios.
function formatFloat(v) {
    if (Number.isNaN(v)) return 'NaN';
    if (!isFinite(v)) return v > 0 ? '+∞' : '-∞';
    if (v === 0) return '0.0';

    const abs = Math.abs(v);
    if (abs >= 1e7 || abs < 1e-4) {
        return v.toExponential(4);
    }

    let s = v.toPrecision(7);
    if (s.includes('.')) {
        s = s.replace(/0+$/, '');
        if (s.endsWith('.')) s += '0';
    }
    return s;
}

// Renderiza la pila interna del FPU (máximo 8 valores)
function renderFPUStack() {
    const table = document.getElementById('fpu-stack-table');
    if (!table) return;
    table.innerHTML = '';

    document.getElementById('fpu-sp').textContent = fpu.stackPointer.toString();

    const topIndex = fpu.stackPointer - 1;

    // Mostrar 6 slots desde el índice 5 hasta el 0
    for (let i = 5; i >= 0; i--) {
        const row = document.createElement('div');
        row.className = 'fpu-stack-row';
        if (i === topIndex) row.classList.add('active');

        const idxSpan = document.createElement('span');
        idxSpan.className = 'fpu-stack-idx';
        idxSpan.textContent = (i === topIndex ? 'SP ➔ ' : '     ') + '[' + i + ']';

        const valSpan = document.createElement('span');
        valSpan.className = 'fpu-stack-val';
        if (i < fpu.stackPointer) {
            valSpan.textContent = formatFloat(fpu.stack[i]);
        } else {
            valSpan.textContent = '—';
        }

        row.appendChild(idxSpan);
        row.appendChild(valSpan);
        table.appendChild(row);
    }
}
// ═══════════════════════════════════════════════════════════════════
// ═══ [FPU] FIN DE LA ACTUALIZACIÓN DE LA UI DEL COPROCESADOR ═════
// ═══════════════════════════════════════════════════════════════════

document.getElementById('btn-assemble').addEventListener('click', () => {
    const source = document.getElementById('code-editor').value;
    const output = document.getElementById('assembler-output');
    try {
        const result = assembler.assemble(source);
        cpu.memory.set(result.binary);
        // ═══ [FPU] Reiniciar el coprocesador para empezar con estado limpio ═══
        fpu.reset();
        // ═══════════════════════════════════════════════════════════════
        output.textContent = 'Assembly successful! Loaded into memory.';
        output.className = 'success';
        updateUI();
    } catch (e) {
        output.textContent = 'Error: ' + e.message;
        output.className = 'error';
    }
});

document.getElementById('btn-clear-code').addEventListener('click', () => {
    document.getElementById('code-editor').value = '';
    const output = document.getElementById('assembler-output');
    if (output) {
        output.textContent = '';
        output.className = '';
    }
});

document.getElementById('btn-step').addEventListener('click', () => {
    cpu.step();
    updateUI();
});

document.getElementById('btn-run').addEventListener('click', () => {
    if (runInterval) return;
    runInterval = setInterval(() => {
        if (cpu.halted) {
            clearInterval(runInterval);
            runInterval = null;
            updateUI();
            return;
        }
        for (let i = 0; i < 100; i++) { // Execute in bursts
            cpu.step();
            if (cpu.halted) break;
        }
        updateUI();
    }, 10);
    updateUI();
});

document.getElementById('btn-stop').addEventListener('click', () => {
    if (runInterval) {
        clearInterval(runInterval);
        runInterval = null;
        updateUI();
    }
});

document.getElementById('btn-reset').addEventListener('click', () => {
    if (runInterval) {
        clearInterval(runInterval);
        runInterval = null;
    }
    cpu.reset(); // El reset del CPU también resetea el FPU (ver cpu.js)

    // Clear assembler output
    const output = document.getElementById('assembler-output');
    if (output) {
        output.textContent = '';
        output.className = '';
    }

    // Reset memory start address and variable
    const memStartInput = document.getElementById('mem-start-addr');
    if (memStartInput) {
        memStartInput.value = '0000';
    }
    memoryStart = 0;

    updateUI();
});

document.getElementById('btn-mem-go').addEventListener('click', () => {
    const val = document.getElementById('mem-start-addr').value;
    memoryStart = parseInt(val, 16) || 0;
    renderMemory();
});

// Initial UI update
updateUI();