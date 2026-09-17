// fpu.js - Coprocesador de Punto Flotante (FPU) para el Intel 8080
// Comunicación con el CPU principal mediante memoria mapeada en 0xFF00 - 0xFF1F
//
// Mapa de memoria del FPU:
//   0xFF00  -> Comando (escritura dispara la operación)
//   0xFF01  -> Registro F0 (byte 0, LSB)
//   0xFF02  -> Registro F0 (byte 1)
//   0xFF03  -> Registro F0 (byte 2)
//   0xFF04  -> Registro F0 (byte 3, MSB)
//   0xFF05  -> Registro F1 (byte 0)
//   0xFF06  -> Registro F1 (byte 1)
//   0xFF07  -> Registro F1 (byte 2)
//   0xFF08  -> Registro F1 (byte 3)
//   0xFF09  -> Registro F2 (byte 0)
//   0xFF0A  -> Registro F2 (byte 1)
//   0xFF0B  -> Registro F2 (byte 2)
//   0xFF0C  -> Registro F2 (byte 3)
//   0xFF0D  -> Registro F3 (byte 0)
//   0xFF0E  -> Registro F3 (byte 1)
//   0xFF0F  -> Registro F3 (byte 2)
//   0xFF10  -> Registro F3 (byte 3)
//   0xFF11  -> FPU Status Word (FSW) - banderas
//   0xFF12  -> FPU Control Word (FCW) - modo de redondeo
//   0xFF13  -> Puntero de Pila del FPU (FSP) - byte bajo
//   0xFF14  -> Puntero de Pila del FPU (FSP) - byte alto
//   0xFF15  -> Comando de Pila (Push/Pop de registros flotantes)
//   0xFF16  -> Puerto libre / Reservado
//   0xFF17  -> Puerto libre / Reservado
//   0xFF18  -> Puerto libre / Reservado
//   0xFF19  -> Puerto libre / Reservado
//   0xFF1A  -> Puerto libre / Reservado
//   0xFF1B  -> Puerto libre / Reservado
//   0xFF1C  -> Puerto libre / Reservado
//   0xFF1D  -> Puerto libre / Reservado
//   0xFF1E  -> Puerto libre / Reservado
//   0xFF1F  -> Puerto libre / Reservado

class FPU {
    constructor(memory) {
        // El FPU comparte la misma RAM que el CPU principal (por referencia)
        this.memory = memory;

        // Mapa de direcciones base
        this.BASE = 0xFF00;
        this.ADDR_COMMAND = this.BASE + 0x00; // 0xFF00
        this.ADDR_F0 = this.BASE + 0x01;      // 0xFF01
        this.ADDR_F1 = this.BASE + 0x05;      // 0xFF05
        this.ADDR_F2 = this.BASE + 0x09;      // 0xFF09
        this.ADDR_F3 = this.BASE + 0x0D;      // 0xFF0D
        this.ADDR_STATUS = this.BASE + 0x11;  // 0xFF11
        this.ADDR_CONTROL = this.BASE + 0x12; // 0xFF12
        this.ADDR_FSP_L = this.BASE + 0x13;   // 0xFF13
        this.ADDR_FSP_H = this.BASE + 0x14;   // 0xFF14
        this.ADDR_STACK_CMD = this.BASE + 0x15; // 0xFF15

        this.reset();
    }

    reset() {
        // Registros flotantes internos (32 bits cada uno, formato IEEE 754)
        this.registers = {
            f0: 0.0,
            f1: 0.0,
            f2: 0.0,
            f3: 0.0
        };

        // Banderas del FPU (FPU Status Word)
        this.flags = {
            zero: false,        // Bit 0: Resultado fue cero
            sign: false,        // Bit 1: Resultado negativo
            overflow: false,    // Bit 2: Desbordamiento (infinito)
            underflow: false,   // Bit 3: Subdesbordamiento (cero por precisión)
            precision: false,   // Bit 4: Pérdida de precisión
            invalid: false,     // Bit 5: Operación inválida (0/0, sqrt(-1))
            divByZero: false    // Bit 6: División por cero
        };

        // Modo de redondeo (FCW)
        // 0 = Redondeo al más cercano, 1 = Hacia abajo, 2 = Hacia arriba, 3 = Hacia cero
        this.roundingMode = 0;

        // Pila propia del FPU (guarda valores flotantes)
        this.stack = [];
        this.stackPointer = 0; // Índice en la pila del FPU (0 = vacía)

        // Estado de sincronización
        this.busy = false;      // Indica si el FPU está procesando
        this.lastCommand = 0;   // Último comando recibido
        this.operationCount = 0; // Contador total de operaciones realizadas

        // Búferes para conversión IEEE 754
        this._floatBuffer = new ArrayBuffer(4);
        this._floatView = new Float32Array(this._floatBuffer);
        this._uintView = new Uint32Array(this._floatBuffer);

        // Limpiar la zona de memoria del FPU
        if (this.memory) {
            for (let i = this.BASE; i < this.BASE + 0x20; i++) {
                this.memory[i & 0xFFFF] = 0;
            }
        }
    }

    // ============================================================
    // Conversión IEEE 754 <-> Memoria (Little Endian)
    // ============================================================

    // Lee 4 bytes de memoria y los convierte a un número flotante de 32 bits
    readFloat(addr) {
        const b0 = this.memory[addr & 0xFFFF];
        const b1 = this.memory[(addr + 1) & 0xFFFF];
        const b2 = this.memory[(addr + 2) & 0xFFFF];
        const b3 = this.memory[(addr + 3) & 0xFFFF];
        const bits = (b3 << 24) | (b2 << 16) | (b1 << 8) | b0;
        this._uintView[0] = bits >>> 0;
        return this._floatView[0];
    }

    // Escribe un número flotante en 4 bytes de memoria (Little Endian)
    writeFloat(addr, value) {
        this._floatView[0] = value;
        const bits = this._uintView[0];
        this.memory[addr & 0xFFFF] = bits & 0xFF;
        this.memory[(addr + 1) & 0xFFFF] = (bits >> 8) & 0xFF;
        this.memory[(addr + 2) & 0xFFFF] = (bits >> 16) & 0xFF;
        this.memory[(addr + 3) & 0xFFFF] = (bits >> 24) & 0xFF;
    }

    // Lee un registro flotante desde la memoria del FPU
    readRegister(addr) {
        return this.readFloat(addr);
    }

    // Escribe un registro flotante en la memoria del FPU
    writeRegister(addr, value) {
        this.writeFloat(addr, value);
    }

    // ============================================================
    // Banderas (FPU Status Word)
    // ============================================================

    getStatusByte() {
        let status = 0;
        if (this.flags.zero) status |= 0x01;
        if (this.flags.sign) status |= 0x02;
        if (this.flags.overflow) status |= 0x04;
        if (this.flags.underflow) status |= 0x08;
        if (this.flags.precision) status |= 0x10;
        if (this.flags.invalid) status |= 0x20;
        if (this.flags.divByZero) status |= 0x40;
        return status;
    }

    setStatusByte(val) {
        this.flags.zero = (val & 0x01) !== 0;
        this.flags.sign = (val & 0x02) !== 0;
        this.flags.overflow = (val & 0x04) !== 0;
        this.flags.underflow = (val & 0x08) !== 0;
        this.flags.precision = (val & 0x10) !== 0;
        this.flags.invalid = (val & 0x20) !== 0;
        this.flags.divByZero = (val & 0x40) !== 0;
    }

    updateFlags(result) {
        // Limpiar banderas de resultado
        this.flags.zero = (result === 0);
        this.flags.sign = (result < 0);
        this.flags.overflow = !isFinite(result) && result !== 0;
        this.flags.underflow = (result !== 0 && Math.abs(result) < 1.17549435e-38);
        this.flags.precision = false; // Simplificación: no simulamos precisión extendida
        this.flags.invalid = isNaN(result);
        // divByZero se maneja en la operación específica
    }

    // ============================================================
    // Pila del FPU
    // ============================================================

    pushStack(value) {
        if (this.stackPointer >= 8) {
            // Desbordamiento de pila del FPU
            this.flags.invalid = true;
            return false;
        }
        this.stack[this.stackPointer] = value;
        this.stackPointer++;
        this.updateFSPMemory();
        return true;
    }

    popStack() {
        if (this.stackPointer <= 0) {
            // Subdesbordamiento de pila del FPU
            this.flags.invalid = true;
            return 0;
        }
        this.stackPointer--;
        const value = this.stack[this.stackPointer];
        this.updateFSPMemory();
        return value;
    }

    updateFSPMemory() {
        this.memory[this.ADDR_FSP_L & 0xFFFF] = this.stackPointer & 0xFF;
        this.memory[this.ADDR_FSP_H & 0xFFFF] = (this.stackPointer >> 8) & 0xFF;
    }

    // ============================================================
    // Operaciones Aritméticas
    // ============================================================

    // Comandos disponibles (escritos por el CPU en 0xFF00)
    static get COMMANDS() {
        return {
            NOP: 0x00,
            ADD: 0x01,   // F0 = F0 + F1
            SUB: 0x02,   // F0 = F0 - F1
            MUL: 0x03,   // F0 = F0 * F1
            DIV: 0x04,   // F0 = F0 / F1
            SQRT: 0x05,  // F0 = sqrt(F0)
            ABS: 0x06,   // F0 = |F0|
            NEG: 0x07,   // F0 = -F0
            CMP: 0x08,   // Compara F0 con F1 (actualiza banderas)
            LOAD: 0x09,  // Carga F0 desde memoria (dirección en F1)
            STORE: 0x0A, // Almacena F0 en memoria (dirección en F1)
            PUSH_F0: 0x0B,
            POP_F0: 0x0C,
            PUSH_F1: 0x0D,
            POP_F1: 0x0E,
            INT_TO_FLOAT: 0x0F,  // F0 = (float) F0 (interpreta F0 como entero)
            FLOAT_TO_INT: 0x10,  // F0 = (int) F0 (trunca)
            SIN: 0x11,
            COS: 0x12,
            TAN: 0x13,
            LOG: 0x14,   // Logaritmo natural
            EXP: 0x15,   // e^x
            POW: 0x16,   // F0 = F0 ^ F1
            CLEAR_FLAGS: 0x17,
            RESET: 0x18
        };
    }

    // Ejecuta una operación basada en el comando actual
    executeCommand(cmd) {
        this.lastCommand = cmd;
        this.busy = true;

        const CMD = FPU.COMMANDS;
        let result = 0;

        switch (cmd) {
            case CMD.NOP:
                break;

            case CMD.ADD:
                result = this.registers.f0 + this.registers.f1;
                this.registers.f0 = result;
                this.updateFlags(result);
                break;

            case CMD.SUB:
                result = this.registers.f0 - this.registers.f1;
                this.registers.f0 = result;
                this.updateFlags(result);
                break;

            case CMD.MUL:
                result = this.registers.f0 * this.registers.f1;
                this.registers.f0 = result;
                this.updateFlags(result);
                break;

            case CMD.DIV:
                if (this.registers.f1 === 0) {
                    this.flags.divByZero = true;
                    this.flags.invalid = true;
                    this.registers.f0 = 0;
                } else {
                    result = this.registers.f0 / this.registers.f1;
                    this.registers.f0 = result;
                    this.updateFlags(result);
                }
                break;

            case CMD.SQRT:
                if (this.registers.f0 < 0) {
                    this.flags.invalid = true;
                    this.registers.f0 = 0;
                } else {
                    result = Math.sqrt(this.registers.f0);
                    this.registers.f0 = result;
                    this.updateFlags(result);
                }
                break;

            case CMD.ABS:
                result = Math.abs(this.registers.f0);
                this.registers.f0 = result;
                this.updateFlags(result);
                break;

            case CMD.NEG:
                result = -this.registers.f0;
                this.registers.f0 = result;
                this.updateFlags(result);
                break;

            case CMD.CMP: {
                const a = this.registers.f0;
                const b = this.registers.f1;
                this.flags.zero = (a === b);
                this.flags.sign = (a < b);
                break;
            }

            case CMD.LOAD: {
                const addr = this.registers.f1 | 0; // Truncar a entero
                this.registers.f0 = this.readFloat(addr);
                this.updateFlags(this.registers.f0);
                break;
            }

            case CMD.STORE: {
                const addr = this.registers.f1 | 0;
                this.writeFloat(addr, this.registers.f0);
                break;
            }

            case CMD.PUSH_F0:
                this.pushStack(this.registers.f0);
                break;

            case CMD.POP_F0:
                this.registers.f0 = this.popStack();
                this.updateFlags(this.registers.f0);
                break;

            case CMD.PUSH_F1:
                this.pushStack(this.registers.f1);
                break;

            case CMD.POP_F1:
                this.registers.f1 = this.popStack();
                this.updateFlags(this.registers.f1);
                break;

            case CMD.INT_TO_FLOAT: {
                // Reinterpreta el patrón de bits de F0 como entero de 32 bits
                this._floatView[0] = this.registers.f0;
                const intVal = this._uintView[0] | 0;
                this.registers.f0 = intVal;
                this.updateFlags(this.registers.f0);
                break;
            }

            case CMD.FLOAT_TO_INT: {
                const intVal = Math.trunc(this.registers.f0);
                this.registers.f0 = intVal;
                this.updateFlags(this.registers.f0);
                break;
            }

            case CMD.SIN:
                result = Math.sin(this.registers.f0);
                this.registers.f0 = result;
                this.updateFlags(result);
                break;

            case CMD.COS:
                result = Math.cos(this.registers.f0);
                this.registers.f0 = result;
                this.updateFlags(result);
                break;

            case CMD.TAN:
                result = Math.tan(this.registers.f0);
                this.registers.f0 = result;
                this.updateFlags(result);
                break;

            case CMD.LOG:
                if (this.registers.f0 <= 0) {
                    this.flags.invalid = true;
                    this.registers.f0 = 0;
                } else {
                    result = Math.log(this.registers.f0);
                    this.registers.f0 = result;
                    this.updateFlags(result);
                }
                break;

            case CMD.EXP:
                result = Math.exp(this.registers.f0);
                this.registers.f0 = result;
                this.updateFlags(result);
                break;

            case CMD.POW:
                result = Math.pow(this.registers.f0, this.registers.f1);
                this.registers.f0 = result;
                this.updateFlags(result);
                break;

            case CMD.CLEAR_FLAGS:
                this.flags.zero = false;
                this.flags.sign = false;
                this.flags.overflow = false;
                this.flags.underflow = false;
                this.flags.precision = false;
                this.flags.invalid = false;
                this.flags.divByZero = false;
                break;

            case CMD.RESET:
                this.reset();
                break;

            default:
                this.flags.invalid = true;
                break;
        }

        // Escribir los resultados en la memoria mapeada
        this.writeRegister(this.ADDR_F0, this.registers.f0);
        this.writeRegister(this.ADDR_F1, this.registers.f1);
        this.memory[this.ADDR_STATUS & 0xFFFF] = this.getStatusByte();
        this.operationCount++;
        this.busy = false;
    }

    // ============================================================
    // Interfaz con el CPU principal
    // ============================================================

    // Llamado por el CPU cuando escribe en la zona de memoria del FPU
    // Devuelve true si el FPU manejó la escritura
    handleWrite(addr, value) {
        addr &= 0xFFFF;
        if (addr < this.BASE || addr > this.BASE + 0x1F) return false;

        // Si el CPU escribe en el registro de comando, disparamos la operación
        if (addr === this.ADDR_COMMAND) {
            this.executeCommand(value);
            return true;
        }

        // Si el CPU escribe en el registro de comando de pila
        if (addr === this.ADDR_STACK_CMD) {
            this.handleStackCommand(value);
            return true;
        }

        // Si el CPU escribe en el registro de control, actualizamos el modo de redondeo
        if (addr === this.ADDR_CONTROL) {
            this.roundingMode = value & 0x03;
            return true;
        }

        // Si el CPU escribe en el puerto de estado, actualizamos las banderas
        if (addr === this.ADDR_STATUS) {
            this.setStatusByte(value);
            return true;
        }

        // Si el CPU escribe en los registros flotantes, actualizamos nuestros registros internos
        if (addr >= this.ADDR_F0 && addr <= this.ADDR_F3 + 3) {
            this.syncFromMemory();
            return true;
        }

        // Cualquier otra escritura en la zona del FPU se ignora (o se maneja como dato)
        return true;
    }

    // Llamado por el CPU cuando lee de la zona de memoria del FPU
    // Devuelve el valor leído (o undefined si no está mapeado)
    handleRead(addr) {
        addr &= 0xFFFF;
        if (addr < this.BASE || addr > this.BASE + 0x1F) return undefined;

        // Sincronizamos el estado del FPU con la memoria antes de leer
        this.syncToMemory();
        return this.memory[addr];
    }

    // Sincroniza los registros internos del FPU con la memoria mapeada
    syncToMemory() {
        this.writeRegister(this.ADDR_F0, this.registers.f0);
        this.writeRegister(this.ADDR_F1, this.registers.f1);
        this.writeRegister(this.ADDR_F2, this.registers.f2);
        this.writeRegister(this.ADDR_F3, this.registers.f3);
        this.memory[this.ADDR_STATUS & 0xFFFF] = this.getStatusByte();
        this.memory[this.ADDR_CONTROL & 0xFFFF] = this.roundingMode;
        this.updateFSPMemory();
    }

    // Sincroniza la memoria mapeada con los registros internos del FPU
    syncFromMemory() {
        this.registers.f0 = this.readRegister(this.ADDR_F0);
        this.registers.f1 = this.readRegister(this.ADDR_F1);
        this.registers.f2 = this.readRegister(this.ADDR_F2);
        this.registers.f3 = this.readRegister(this.ADDR_F3);
        this.setStatusByte(this.memory[this.ADDR_STATUS & 0xFFFF]);
        this.roundingMode = this.memory[this.ADDR_CONTROL & 0xFFFF] & 0x03;
        this.stackPointer = this.memory[this.ADDR_FSP_L & 0xFFFF] |
                            (this.memory[this.ADDR_FSP_H & 0xFFFF] << 8);
    }

    // Maneja comandos de pila enviados por el CPU
    handleStackCommand(cmd) {
        switch (cmd) {
            case 0x01: // Push F0
                this.pushStack(this.registers.f0);
                break;
            case 0x02: // Pop F0
                this.registers.f0 = this.popStack();
                this.updateFlags(this.registers.f0);
                break;
            case 0x03: // Push F1
                this.pushStack(this.registers.f1);
                break;
            case 0x04: // Pop F1
                this.registers.f1 = this.popStack();
                this.updateFlags(this.registers.f1);
                break;
            case 0x05: // Clear stack
                this.stack = [];
                this.stackPointer = 0;
                this.updateFSPMemory();
                break;
            default:
                this.flags.invalid = true;
                break;
        }
        this.syncToMemory();
    }

    // ============================================================
    // Utilidades de depuración / UI
    // ============================================================

    // Devuelve un snapshot del estado del FPU para la UI
    getState() {
        return {
            registers: {
                f0: this.registers.f0,
                f1: this.registers.f1,
                f2: this.registers.f2,
                f3: this.registers.f3
            },
            flags: { ...this.flags },
            statusByte: this.getStatusByte(),
            roundingMode: this.roundingMode,
            stackPointer: this.stackPointer,
            stack: [...this.stack],
            busy: this.busy,
            lastCommand: this.lastCommand,
            operationCount: this.operationCount
        };
    }

    // Devuelve el nombre legible de un comando
    static getCommandName(cmd) {
        const CMD = FPU.COMMANDS;
        for (const [name, value] of Object.entries(CMD)) {
            if (value === cmd) return name;
        }
        return `UNKNOWN(0x${cmd.toString(16).padStart(2, '0')})`;
    }
}

// Exportar para Node.js (pruebas) y navegador
if (typeof module !== 'undefined' && module.exports) {
    module.exports = FPU;
}
if (typeof window !== 'undefined') {
    window.FPU = FPU;
}