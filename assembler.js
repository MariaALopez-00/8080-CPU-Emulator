class Assembler8080 {
    constructor() {
        this.opcodes = {
            'NOP': { code: 0x00, bytes: 1 },
            'LXI': { bytes: 3 },
            'STAX': { bytes: 1 },
            'INX': { bytes: 1 },
            'INR': { bytes: 1 },
            'DCR': { bytes: 1 },
            'MVI': { bytes: 2 },
            'RLC': { code: 0x07, bytes: 1 },
            'DAD': { bytes: 1 },
            'LDAX': { bytes: 1 },
            'DCX': { bytes: 1 },
            'RRC': { code: 0x0F, bytes: 1 },
            'RAL': { code: 0x17, bytes: 1 },
            'RAR': { code: 0x1F, bytes: 1 },
            'SHLD': { code: 0x22, bytes: 3 },
            'DAA': { code: 0x27, bytes: 1 },
            'LHLD': { code: 0x2A, bytes: 3 },
            'CMA': { code: 0x2F, bytes: 1 },
            'STA': { code: 0x32, bytes: 3 },
            'STC': { code: 0x37, bytes: 1 },
            'LDA': { code: 0x3A, bytes: 3 },
            'CMC': { code: 0x3F, bytes: 1 },
            'MOV': { bytes: 1 },
            'HLT': { code: 0x76, bytes: 1 },
            'ADD': { bytes: 1 },
            'ADC': { bytes: 1 },
            'SUB': { bytes: 1 },
            'SBB': { bytes: 1 },
            'ANA': { bytes: 1 },
            'XRA': { bytes: 1 },
            'ORA': { bytes: 1 },
            'CMP': { bytes: 1 },
            'RNZ': { code: 0xC0, bytes: 1 },
            'POP': { bytes: 1 },
            'JNZ': { code: 0xC2, bytes: 3 },
            'JMP': { code: 0xC3, bytes: 3 },
            'CNZ': { code: 0xC4, bytes: 3 },
            'PUSH': { bytes: 1 },
            'ADI': { code: 0xC6, bytes: 2 },
            'RZ': { code: 0xC8, bytes: 1 },
            'RET': { code: 0xC9, bytes: 1 },
            'JZ': { code: 0xCA, bytes: 3 },
            'CZ': { code: 0xCC, bytes: 3 },
            'CALL': { code: 0xCD, bytes: 3 },
            'ACI': { code: 0xCE, bytes: 2 },
            'RNC': { code: 0xD0, bytes: 1 },
            'JNC': { code: 0xD2, bytes: 3 },
            'OUT': { code: 0xD3, bytes: 2 },
            'CNC': { code: 0xD4, bytes: 3 },
            'SUI': { code: 0xD6, bytes: 2 },
            'RC': { code: 0xD8, bytes: 1 },
            'JC': { code: 0xDA, bytes: 3 },
            'IN': { code: 0xDB, bytes: 2 },
            'CC': { code: 0xDC, bytes: 3 },
            'SBI': { code: 0xDE, bytes: 2 },
            'RPO': { code: 0xE0, bytes: 1 },
            'JPO': { code: 0xE2, bytes: 3 },
            'XTHL': { code: 0xE3, bytes: 1 },
            'CPO': { code: 0xE4, bytes: 3 },
            'ANI': { code: 0xE6, bytes: 2 },
            'RPE': { code: 0xE8, bytes: 1 },
            'PCHL': { code: 0xE9, bytes: 1 },
            'JPE': { code: 0xEA, bytes: 3 },
            'XCHG': { code: 0xEB, bytes: 1 },
            'CPE': { code: 0xEC, bytes: 3 },
            'XRI': { code: 0xEE, bytes: 2 },
            'RP': { code: 0xF0, bytes: 1 },
            'JP': { code: 0xF2, bytes: 3 },
            'DI': { code: 0xF3, bytes: 1 },
            'CP': { code: 0xF4, bytes: 3 },
            'ORI': { code: 0xF6, bytes: 2 },
            'RM': { code: 0xF8, bytes: 1 },
            'SPHL': { code: 0xF9, bytes: 1 },
            'JM': { code: 0xFA, bytes: 3 },
            'EI': { code: 0xFB, bytes: 1 },
            'CM': { code: 0xFC, bytes: 3 },
            'CPI': { code: 0xFE, bytes: 2 },
            'RST': { bytes: 1 },
        };
        this.regs = { 'B': 0, 'C': 1, 'D': 2, 'E': 3, 'H': 4, 'L': 5, 'M': 6, 'A': 7 };
        this.rps = { 'B': 0, 'C': 0, 'D': 1, 'E': 1, 'H': 2, 'L': 2, 'SP': 3, 'PSW': 3, 'BC': 0, 'DE': 1, 'HL': 2 };

        // ═══════════════════════════════════════════════════════════════
        // ═══ [FPU] PSEUDO-INSTRUCCIONES DEL COPROCESADOR ═══════════════
        // ═══════════════════════════════════════════════════════════════
        // Direcciones base de los registros flotantes F0 y F1 en la zona
        // mapeada del FPU (ver fpu.js). Cada registro ocupa 4 bytes IEEE 754.
        // ═══════════════════════════════════════════════════════════════
        this.fpuRegs = {
            'F0': 0xFF01,
            'F1': 0xFF05
        };

        // Tabla de pseudo-instrucciones del FPU. Solo las 6 esenciales:
        //   - load_imm  ->  FLDI Fx, valor   (20 bytes)
        //   - store_mem ->  FSTA addr        (24 bytes)
        //   - cmd       ->  FADD/FSUB/FMUL/FDIV  (5 bytes cada una)
        this.fpuPseudos = {
            'FLDI': { type: 'load_imm',  size: 20 },
            'FSTA': { type: 'store_mem', size: 24 },
            'FADD': { type: 'cmd', cmd: 0x01, size: 5 },
            'FSUB': { type: 'cmd', cmd: 0x02, size: 5 },
            'FMUL': { type: 'cmd', cmd: 0x03, size: 5 },
            'FDIV': { type: 'cmd', cmd: 0x04, size: 5 }
        };
        // ═══════════════════════════════════════════════════════════════
    }

    assemble(source) {
        const lines = source.split('\n');
        const labels = {};
        let currentPC = 0;

        // First pass: Resolve labels
        const passes = lines.map(line => {
            line = line.split(';')[0].trim();
            if (!line) return null;

            let label = null;
            if (line.includes(':')) {
                const parts = line.split(':');
                label = parts[0].trim();
                line = parts[1].trim();
                if (label) labels[label] = currentPC;
            }
            if (!line) return null;

            const tokens = line.split(/[\s,]+/).filter(t => t);
            const mnemonic = tokens[0].toUpperCase();

            if (mnemonic === 'ORG') {
                currentPC = this.parseValue(tokens[1]);
                if (label) labels[label] = currentPC;
                return { type: 'directive', mnemonic, tokens, pc: currentPC };
            }
            if (mnemonic === 'DB') {
                const pc = currentPC;
                currentPC += tokens.length - 1;
                return { type: 'data', mnemonic, tokens, pc };
            }

            // ═══ [FPU] Chequeo de pseudo-instrucciones del coprocesador ═══
            if (this.fpuPseudos[mnemonic]) {
                const pc = currentPC;
                const size = this.fpuPseudos[mnemonic].size;
                currentPC += size;
                return { type: 'fpu', mnemonic, tokens, pc, size };
            }
            // ═══════════════════════════════════════════════════════════════

            const info = this.opcodes[mnemonic];
            if (!info) throw new Error(`Unknown mnemonic: ${mnemonic}`);
            const pc = currentPC;
            currentPC += info.bytes;
            return { type: 'instruction', mnemonic, tokens, pc, info };
        }).filter(l => l);

        // Second pass: Generate code
        const binary = new Uint8Array(65536);
        let maxAddr = 0;

        passes.forEach(line => {
            if (line.type === 'directive') return;
            let pc = line.pc;
            if (line.type === 'data') {
                for (let i = 1; i < line.tokens.length; i++) {
                    binary[pc++] = this.parseValue(line.tokens[i], labels);
                }
            } else if (line.type === 'fpu') {
                // ═══ [FPU] Expansión de pseudo-instrucciones del coprocesador ═══
                pc = this.generateFpuCode(line, labels, binary, pc);
                // ═══════════════════════════════════════════════════════════════
            } else {
                const code = this.generateOpcode(line, labels);
                binary[pc++] = code.byte1;
                if (line.info.bytes > 1) binary[pc++] = code.byte2;
                if (line.info.bytes > 2) binary[pc++] = code.byte3;
            }
            if (pc > maxAddr) maxAddr = pc;
        });

        return { binary, maxAddr };
    }

    generateOpcode(line, labels) {
        const mnemonic = line.mnemonic;
        const tokens = line.tokens;
        let byte1 = line.info.code;
        let byte2 = 0, byte3 = 0;

        const r1 = tokens[1] ? tokens[1].toUpperCase() : null;
        const r2 = tokens[2] ? tokens[2].toUpperCase() : null;

        if (mnemonic === 'MOV') {
            if (this.regs[r1] === undefined) throw new Error(`Invalid register: ${r1} in MOV instruction`);
            if (this.regs[r2] === undefined) throw new Error(`Invalid register: ${r2} in MOV instruction`);
            if (r1 === 'M' && r2 === 'M') throw new Error(`Cannot use MOV M, M (invalid instruction)`);
            byte1 = 0x40 | (this.regs[r1] << 3) | this.regs[r2];
        } else if (mnemonic === 'MVI') {
            if (this.regs[r1] === undefined) throw new Error(`Invalid register: ${r1} in MVI instruction`);
            byte1 = 0x06 | (this.regs[r1] << 3);
            byte2 = this.parseValue(tokens[2], labels) & 0xFF;
        } else if (mnemonic === 'LXI') {
            if (this.rps[r1] === undefined) throw new Error(`Invalid register pair: ${r1} in LXI instruction`);
            byte1 = 0x01 | (this.rps[r1] << 4);
            const val = this.parseValue(tokens[2], labels);
            byte2 = val & 0xFF;
            byte3 = (val >> 8) & 0xFF;
        } else if (['ADD', 'ADC', 'SUB', 'SBB', 'ANA', 'XRA', 'ORA', 'CMP'].includes(mnemonic)) {
            if (this.regs[r1] === undefined) throw new Error(`Invalid register: ${r1} in ${mnemonic} instruction`);
            const base = { 'ADD': 0x80, 'ADC': 0x88, 'SUB': 0x90, 'SBB': 0x98, 'ANA': 0xA0, 'XRA': 0xA8, 'ORA': 0xB0, 'CMP': 0xB8 };
            byte1 = base[mnemonic] | this.regs[r1];
        } else if (mnemonic === 'INR') {
            if (this.regs[r1] === undefined) throw new Error(`Invalid register: ${r1} in INR instruction`);
            byte1 = 0x04 | (this.regs[r1] << 3);
        } else if (mnemonic === 'DCR') {
            if (this.regs[r1] === undefined) throw new Error(`Invalid register: ${r1} in DCR instruction`);
            byte1 = 0x05 | (this.regs[r1] << 3);
        } else if (mnemonic === 'INX') {
            if (this.rps[r1] === undefined) throw new Error(`Invalid register pair: ${r1} in INX instruction`);
            byte1 = 0x03 | (this.rps[r1] << 4);
        } else if (mnemonic === 'DCX') {
            if (this.rps[r1] === undefined) throw new Error(`Invalid register pair: ${r1} in DCX instruction`);
            byte1 = 0x0B | (this.rps[r1] << 4);
        } else if (mnemonic === 'DAD') {
            if (this.rps[r1] === undefined) throw new Error(`Invalid register pair: ${r1} in DAD instruction`);
            byte1 = 0x09 | (this.rps[r1] << 4);
        } else if (mnemonic === 'PUSH') {
            if (this.rps[r1] === undefined) throw new Error(`Invalid register pair: ${r1} in PUSH instruction`);
            byte1 = 0xC5 | (this.rps[r1] << 4);
        } else if (mnemonic === 'POP') {
            if (this.rps[r1] === undefined) throw new Error(`Invalid register pair: ${r1} in POP instruction`);
            byte1 = 0xC1 | (this.rps[r1] << 4);
        } else if (mnemonic === 'STAX') {
            if (this.rps[r1] === undefined) throw new Error(`Invalid register pair: ${r1} in STAX instruction`);
            byte1 = 0x02 | (this.rps[r1] << 4);
        } else if (mnemonic === 'LDAX') {
            if (this.rps[r1] === undefined) throw new Error(`Invalid register pair: ${r1} in LDAX instruction`);
            byte1 = 0x0A | (this.rps[r1] << 4);
        } else if (mnemonic === 'RST') {
            const val = this.parseValue(tokens[1], labels);
            if (isNaN(val) || val < 0 || val > 7) {
                throw new Error(`Invalid RST number: ${tokens[1]}. Must be 0-7.`);
            }
            byte1 = 0xC7 | (val << 3);
        } else if (line.info.bytes === 3) { // JMP, CALL, etc.
            const val = this.parseValue(tokens[1], labels);
            byte2 = val & 0xFF;
            byte3 = (val >> 8) & 0xFF;
        } else if (line.info.bytes === 2) { // ADI, OUT, etc.
            byte2 = this.parseValue(tokens[1], labels) & 0xFF;
        }

        return { byte1, byte2, byte3 };
    }

    parseValue(val, labels = {}) {
        if (!val) return 0;
        if (labels[val] !== undefined) return labels[val];

        // If it starts with a letter and is not a hex constant, it might be an undefined label
        const isHexConstant = val.endsWith('H') || val.endsWith('h') || val.startsWith('0X') || val.startsWith('0x');

        let parsed;
        if (val.endsWith('H') || val.endsWith('h')) {
            parsed = parseInt(val.slice(0, -1), 16);
        } else if (val.startsWith('0X') || val.startsWith('0x')) {
            parsed = parseInt(val, 16);
        } else {
            parsed = parseInt(val, 10);
        }

        if (isNaN(parsed)) {
            // Check if it looks like a label (starts with letter)
            if (/^[A-Za-z_]/.test(val)) {
                throw new Error(`Undefined label: ${val}`);
            } else {
                throw new Error(`Invalid numeric value or token: ${val}`);
            }
        }
        return parsed;
    }

    // ═══════════════════════════════════════════════════════════════════
    // ═══ [FPU] GENERACIÓN DE CÓDIGO PARA PSEUDO-INSTRUCCIONES ═════════
    // ═══════════════════════════════════════════════════════════════════
    // Estas 6 pseudo-instrucciones se expanden a secuencias de 8080
    // nativo que leen/escriben la zona mapeada del FPU (0xFF00-0xFF1F).
    //
    // Mapa de direcciones usadas:
    //   0xFF00  -> Puerto de comando (dispara la operación en el FPU)
    //   0xFF01  -> Registro flotante F0 (4 bytes, IEEE 754, little-endian)
    //   0xFF05  -> Registro flotante F1 (4 bytes, IEEE 754, little-endian)
    // ═══════════════════════════════════════════════════════════════════

    // Convierte un número flotante a sus 4 bytes IEEE 754 (little-endian)
    floatToBytes(value) {
        const buf = new ArrayBuffer(4);
        const f32 = new Float32Array(buf);
        const u32 = new Uint32Array(buf);
        f32[0] = value;
        const bits = u32[0] >>> 0;
        return [
            bits & 0xFF,
            (bits >> 8) & 0xFF,
            (bits >> 16) & 0xFF,
            (bits >> 24) & 0xFF
        ];
    }

    // Expande una pseudo-instrucción del FPU a bytes nativos 8080.
    // Devuelve el nuevo PC después de escribir todos los bytes.
    generateFpuCode(line, labels, binary, pc) {
        const mnemonic = line.mnemonic;
        const tokens = line.tokens;
        const pseudo = this.fpuPseudos[mnemonic];

        if (pseudo.type === 'cmd') {
            // ── FADD / FSUB / FMUL / FDIV ──
            // Expansión:  MVI A, cmd  ;  STA 0FF00H     (5 bytes)
            // Al escribir en 0xFF00, el FPU ejecuta la operación.
            binary[pc++] = 0x3E;                 // MVI A, imm
            binary[pc++] = pseudo.cmd & 0xFF;
            binary[pc++] = 0x32;                 // STA addr
            binary[pc++] = 0x00;                 // addr low  = 0x00
            binary[pc++] = 0xFF;                 // addr high = 0xFF

        } else if (pseudo.type === 'load_imm') {
            // ── FLDI Fx, valor ──
            // Expansión:  4 × ( MVI A, byte ; STA reg+i )   (20 bytes)
            // Carga los 4 bytes del float en el registro indicado.
            const regName = tokens[1] ? tokens[1].toUpperCase() : '';
            if (this.fpuRegs[regName] === undefined) {
                throw new Error(`Invalid FPU register: ${tokens[1]} in ${mnemonic} instruction`);
            }
            const value = parseFloat(tokens[2]);
            if (isNaN(value)) {
                throw new Error(`Invalid float value: ${tokens[2]} in ${mnemonic} instruction`);
            }
            const baseAddr = this.fpuRegs[regName];
            const bytes = this.floatToBytes(value);
            for (let i = 0; i < 4; i++) {
                const addr = baseAddr + i;
                binary[pc++] = 0x3E;             // MVI A, byte
                binary[pc++] = bytes[i];
                binary[pc++] = 0x32;             // STA addr
                binary[pc++] = addr & 0xFF;
                binary[pc++] = (addr >> 8) & 0xFF;
            }

        } else if (pseudo.type === 'store_mem') {
            // ── FSTA addr ──
            // Expansión:  4 × ( LDA 0FF01+i ; STA addr+i )   (24 bytes)
            // Copia los 4 bytes del resultado F0 a la dirección indicada.
            const addr = this.parseValue(tokens[1], labels);
            for (let i = 0; i < 4; i++) {
                const srcAddr = 0xFF01 + i;
                const dstAddr = (addr + i) & 0xFFFF;
                binary[pc++] = 0x3A;             // LDA srcAddr
                binary[pc++] = srcAddr & 0xFF;
                binary[pc++] = (srcAddr >> 8) & 0xFF;
                binary[pc++] = 0x32;             // STA dstAddr
                binary[pc++] = dstAddr & 0xFF;
                binary[pc++] = (dstAddr >> 8) & 0xFF;
            }
        }

        return pc;
    }
    // ═══════════════════════════════════════════════════════════════════
    // ═══ [FPU] FIN DE LA GENERACIÓN DE PSEUDO-INSTRUCCIONES ══════════
    // ═══════════════════════════════════════════════════════════════════
}

if (typeof module !== 'undefined') {
    module.exports = Assembler8080;
}