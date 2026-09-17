# Intel 8080 Emulator + FPU Coprocessor

Emulador del microprocesador **Intel 8080** con un **coprocesador de punto flotante (FPU)** acoplado. Permite escribir programas en ensamblador, que realizan operaciones aritméticas con números reales mediante un coprocesador especializado que se comunica con la CPU a través de memoria compartida.

---

## 1. ¿Qué es un coprocesador?

Un **coprocesador** es un chip que se especializa en un tipo de operación que el CPU principal no puede realizar. El Intel 8080, siendo un procesador de **8 bits**, solo maneja números enteros entre `0` y `255`. No tiene forma nativa de trabajar con números decimales.

En la vida real, el Intel 8080 solía acompañarse de chips especializados para punto flotante así que este proyecto emula esa misma idea de forma virtual. El coprocesador tiene las siguientes características:

- Posee sus **propios registros** de 32 bits (F0, F1, F2, F3).
- Posee sus **propias banderas** de estado.
- Posee su **propia pila interna**.
- **Comparte la RAM** con el CPU principal, no tiene memoria propia.
- **No interactúa con el usuario directamente**, solo responde a comandos que le envía el CPU.

---

## 2. División de la memoria RAM

La RAM tiene **64 KB** (direcciones `0x0000` hasta `0xFFFF`), igual que el 8080 real. Esta se planteó para restringir una pequeña zona para la comunicación con el coprocesador:

- Desde `0x0000` hasta `0xFEFF`: **memoria general**. Aquí vive el código del programa, las variables, la pila del CPU, y todo lo que el usuario necesite. Son 65,280 bytes de uso libre.

- Desde `0xFF00` hasta `0xFF1F`: **zona mapeada del coprocesador**. Son 32 bytes reservados para la comunicación CPU ↔ FPU. Cada byte tiene un rol específico.

- Desde `0xFF20` hasta `0xFFFF`: **memoria general otra vez**. Otros 224 bytes libres para el usuario.

### Mapa detallado de la zona del coprocesador `0xFF00-0xFF1F`:

- **`0xFF00`** (1 byte) — **Puerto de comando.** Escribir aquí dispara una operación en el FPU. El valor escrito determina qué operación ejecutar (suma, resta, multiplicación, división).

- **`0xFF01` a `0xFF04`** (4 bytes) — **Registro F0.** Almacena un número flotante de 32 bits. Es el operando principal y también donde queda el resultado de cada operación.

- **`0xFF05` a `0xFF08`** (4 bytes) — **Registro F1.** Almacena el segundo operando flotante. No se modifica durante las operaciones.

- **`0xFF09` a `0xFF0C`** (4 bytes) — **Registro F2.** Reservado para futuras ampliaciones.

- **`0xFF0D` a `0xFF10`** (4 bytes) — **Registro F3.** Reservado para futuras ampliaciones.

- **`0xFF11`** (1 byte) — **FPU Status Word (FSW).** Cada bit empaqueta una de las 7 banderas de estado del coprocesador (Zero, Sign, Overflow, Underflow, Precision, Invalid, Divide by Zero).

- **`0xFF12`** (1 byte) — **FPU Control Word (FCW).** Almacena el modo de redondeo.

- **`0xFF13` a `0xFF14`** (2 bytes) — **Puntero de pila del (FSP).** Indica la posición actual de la pila interna del coprocesador.

- **`0xFF15`** (1 byte) — **Puerto de comandos de pila.** Permite hacer push/pop de registros flotantes a la pila del FPU.

- **`0xFF16` a `0xFF1F`** (10 bytes) — **Reservado.** Espacio libre para futuras ampliaciones.

### Importante: el FPU es opcional

Si el CPU no tiene asociado ningún FPU, la zona `0xFF00-0xFF1F` funciona como RAM normal. El CPU no distingue entre memoria normal y memoria mapeada: simplemente lee y escribe bytes. Es la **presencia del FPU** lo que activa el comportamiento especial.

---

## 3. Cómo se comunican el CPU y el FPU

El CPU y el FPU **no comparten registros**. Se comunican exclusivamente a través de la **memoria compartida** (memory-mapped I/O). El protocolo es simple pero riguroso:

### Protocolo paso a paso

Supongamos que queremos calcular `F0 = F0 + F1` con `F0 = 3.14` y `F1 = 2.71`:

1. **El CPU escribe los bytes de `3.14` en `F0`.** Esto se hace con 4 pares de instrucciones `MVI A, byte` + `STA 0FF01H+i`, uno por cada byte del número flotante. El CPU no sabe que está escribiendo un flotante: solo escribe 4 bytes en 4 direcciones consecutivas.

2. **El CPU escribe los bytes de `2.71` en `F1`.** Mismo procedimiento pero apuntando a `0xFF05-0xFF08`.

3. **El CPU escribe el comando `0x01` (ADD) en `0xFF00`.** Esta escritura es la que **dispara la operación**. En cuanto el CPU escribe ese byte, el FPU "despierta".

4. **El coprocesador detecta la escritura.** Su método `handleWrite()` fue invocado automáticamente por el CPU, porque la dirección está en el rango mapeado.

5. **El coprocesador lee los operandos desde la RAM.** Lee 4 bytes desde `0xFF01` y los convierte a un número flotante. Hace lo mismo con `0xFF05`. Ahora tiene `3.14` y `2.71` en memoria interna.

6. **El coprocesador ejecuta la operación.** Calcula `3.14 + 2.71 = 5.85`.

7. **El coprocesador escribe el resultado en la RAM.** Escribe los 4 bytes de `5.85` en `0xFF01-0xFF04` (es decir, sobreescribe F0).

8. **El CPU puede leer el resultado.** Con 4 pares de `LDA 0FF01H+i` + `STA destino+i`, copia el resultado a donde quiera.

### Puntos clave del proyecto

- **El CPU es el maestro, el coprocesador es el esclavo.** El coprocesador nunca inicia una comunicación por sí mismo. Solo responde a escrituras del CPU en su zona de memoria.

- **La RAM es la única fuente de verdad.** Los operandos y resultados viven en la RAM, no en registros ocultos del coprocesador. Esto permite que el CPU lea los resultados con instrucciones `LDA` normales, y que el programador inspeccione la memoria para depurar.

- **El disparador es la escritura en `0xFF00`.** Cualquier byte escrito en esa dirección es interpretado como un comando. El valor `0x01` es suma, `0x02` es resta, `0x03` es multiplicación, `0x04` es división.

- **El CPU no se bloquea esperando al coprocesador.** En el emulador, el coprocesador es síncrono con el CPU: cuando el CPU escribe en `0xFF00`, el coprocesador completa la operación inmediatamente y el control vuelve al CPU con el resultado ya escrito en RAM.

### Cómo se intercepta la comunicación

El CPU 8080 fue modificado con un "hook" en sus métodos `readMemory()` y `writeMemory()`. Cuando detecta una dirección en el rango `0xFF00-0xFF1F`, delega la operación al coprocesador antes de tocar la RAM normal.

---

## 4. Nuevas instrucciones

Se añadieron **6 instrucciones** al ensamblador.

### 4.1. `FLDI Fx, valor` — Cargar flotante inmediato

Carga un número decimal directamente en uno de los registros flotantes `F0` o `F1`.

Ejemplos de uso:

- `FLDI F0, 3.14` carga el número `3.14` en el registro F0.
- `FLDI F1, 2.71` carga el número `2.71` en el registro F1.
- `FLDI F0, -0.0025` carga un número negativo.
- `FLDI F1, 100` carga un entero.

**Regla:** solo se permiten los registros `F0` y `F1`, los dos usados por las operaciones aritméticas.

### 4.2. `FSTA addr` — Guardar F0 en memoria

Guarda el contenido del registro `F0` (usualmente el resultado de una operación) en 4 bytes consecutivos de memoria.

Ejemplo:

- `FSTA 2000H` guarda el resultado en las direcciones `2000H-2003H`.

### 4.3. Operaciones aritméticas: `FADD`, `FSUB`, `FMUL`, `FDIV`

Son las 4 operaciones básicas. En todos los casos, el resultado se almacena **siempre en `F0`**, y `F1` se usa como segundo operando (no se modifica).

- **`FADD`** realiza `F0 = F0 + F1`. Comando interno: `0x01`.
- **`FSUB`** realiza `F0 = F0 - F1`. Comando interno: `0x02`.
- **`FMUL`** realiza `F0 = F0 * F1`. Comando interno: `0x03`.
- **`FDIV`** realiza `F0 = F0 / F1`. Comando interno: `0x04`.

**Patrón de uso:** `F0` actúa como acumulador. Después de cada operación, solo hay que recargar `F1` con el siguiente operando. `F0` conserva el resultado.

### 4.4. Resumen de tamaños

Las pseudo-instrucciones ocupan los siguientes bytes en memoria:

- `FLDI Fx, valor` ocupa **20 bytes**.
- `FSTA addr` ocupa **24 bytes**.
- `FADD`, `FSUB`, `FMUL`, `FDIV` ocupan **5 bytes cada una**.

---

## 5. Formato de los números flotantes

Los números se almacenan en formato **IEEE 754 de 32 bits (precisión simple)**, en **little-endian** (byte menos significativo primero).

### Estructura de un float de 32 bits

Un número flotante de 32 bits se compone internamente de tres partes:

- **Bit 31 (1 bit):** el **signo**. `0` significa positivo, `1` significa negativo.
- **Bits 30 a 23 (8 bits):** el **exponente**. Representa la magnitud del número en potencias de 2, con un sesgo de 127.
- **Bits 22 a 0 (23 bits):** la **mantisa**. Contiene los dígitos significativos del número.

### Ejemplos concretos

Algunos números comunes y cómo se ven en memoria:

- El número `3.14` en hexadecimal es `4048F5C3`, y en RAM se guarda como `C3 F5 48 40`.
- El número `2.71` en hexadecimal es `402D70A4`, y en RAM se guarda como `A4 70 2D 40`.
- El número `5.85` en hexadecimal es `40BB3333`, y en RAM se guarda como `33 33 BB 40`.
- El número `-2.0` en hexadecimal es `C0000000`, y en RAM se guarda como `00 00 00 C0`.
- El número `0.0` en hexadecimal es `00000000`, y en RAM se guarda como `00 00 00 00`.

### ¿Por qué little-endian?

El Intel 8080 es little-endian de forma nativa: cuando ejecuta `LXI HL, 1234H`, guarda el byte bajo `34` en la dirección baja y el byte alto `12` en la dirección alta. El FPU respeta esta convención para que las operaciones de lectura/escritura de 4 bytes sean coherentes con el resto del sistema.

### Precisión

El formato de 32 bits tiene una precisión de aproximadamente **7 dígitos decimales significativos**. Esto significa que:

- `3.14 + 2.71` se calcula como `5.8499999...`, aunque al mostrarlo se redondea a `5.85`.
- Operaciones con números muy grandes (más de 10^38) pueden desbordarse a infinito.
- Operaciones con números muy pequeños (menos de 10^-38) pueden redondearse a cero.

Para la mayoría de propósitos didácticos, esta precisión es más que suficiente y refleja fielmente las limitaciones de los coprocesadores reales de los años 80.

---

## 6. Banderas del FPU

El FPU tiene su propio registro de estado, llamado **FSW (FPU Status Word)**, ubicado en la dirección `0xFF11`. Es independiente de las banderas del 8080. Se compone de **7 bits**, cada uno con un significado específico:

- **Bit 0 — Z (Zero):** se activa cuando el resultado de la última operación fue exactamente `0.0`.
- **Bit 1 — S (Sign):** se activa cuando el resultado es negativo.
- **Bit 2 — OV (Overflow):** se activa cuando el resultado es infinito (magnitud demasiado grande para representar).
- **Bit 3 — UN (Underflow):** se activa cuando el resultado es tan pequeño que se redondea a `0.0` por límite de precisión.
- **Bit 4 — PR (Precision):** se activa cuando se pierden bits significativos por redondeo.
- **Bit 5 — INV (Invalid):** se activa en operaciones indefinidas, como `0/0`, `√(-1)` o `log(-1)`.
- **Bit 6 — DZ (Divide by Zero):** se activa cuando se intenta dividir entre `0.0`.

### Cómo consultarlas desde el 8080

El CPU puede leer el byte de estado del FPU con una instrucción `LDA` normal. Por ejemplo, para comprobar si el resultado fue cero:
